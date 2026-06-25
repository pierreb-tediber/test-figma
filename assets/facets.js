class FacetFiltersForm extends HTMLElement {
	constructor() {
		super();
		this.onActiveFilterClick = this.onActiveFilterClick.bind(this);

		this.debouncedOnSubmit = debounce((event) => {
			this.onSubmitHandler(event);
		}, 800);

		const facetForm = this.querySelector('form');
		facetForm.addEventListener('input', this.debouncedOnSubmit.bind(this));

		const facetWrapper = this.querySelector('#FacetsWrapperDesktop');
		if (facetWrapper) facetWrapper.addEventListener('keyup', onKeyUpEscape);
	}

	static setListeners() {
		const onHistoryChange = (event) => {
			const searchParams = event.state
				? event.state.searchParams
				: FacetFiltersForm.searchParamsInitial;
			if (searchParams === FacetFiltersForm.searchParamsPrev) return;
			FacetFiltersForm.renderPage(searchParams, null, false);
		};
		window.addEventListener('popstate', onHistoryChange);
	}

	static toggleActiveFacets(disable = true) {
		document.querySelectorAll('.js-facet-remove').forEach((element) => {
			element.classList.toggle('disabled', disable);
		});
	}

	static renderPage(searchParams, event, updateURLHash = true) {
		FacetFiltersForm.searchParamsPrev = searchParams;
		const sections = FacetFiltersForm.getSections();

		const countContainer = document.getElementById('ProductCount');
		const countContainerDesktop = document.getElementById('ProductCountDesktop');
		const loadingSpinners = document.querySelectorAll(
			'.facets-container .loading__spinner, facet-filters-form .loading__spinner',
		);
		loadingSpinners.forEach((spinner) => spinner.classList.remove('hidden'));
		const productGridContainer = document.getElementById('ProductGridContainer');
		if (productGridContainer) {
			const collectionElement = productGridContainer.querySelector('.collection');
			if (collectionElement) {
				collectionElement.classList.add('loading');
			}
		}
		if (countContainer) {
			countContainer.classList.add('loading');
		}
		if (countContainerDesktop) {
			countContainerDesktop.classList.add('loading');
		}

		sections.forEach((section) => {
			const url = `${window.location.pathname}?section_id=${section.section}&${searchParams}`;
			const filterDataUrl = (element) => element.url === url;

			if (section.section.includes('product-grid') || section.type === 'product-grid') {
				FacetFiltersForm.filterData.some(filterDataUrl)
					? FacetFiltersForm.renderSectionFromCache(filterDataUrl, event)
					: FacetFiltersForm.renderSectionFromFetch(url, event);
			} else {
				FacetFiltersForm.renderSectionVariantFromFetch(url, event);
			}
		});

		if (updateURLHash) FacetFiltersForm.updateURLHash(searchParams);
	}

	static renderSectionVariantFromFetch(url, event) {
		fetch(url)
			.then((response) => {
				return response.text();
			})
			.then((responseText) => {
				const html = responseText;
				FacetFiltersForm.renderVariantGridContainer(html);
				if (typeof initializeScrollAnimationTrigger === 'function')
					initializeScrollAnimationTrigger(html.innerHTML);
			})
			.catch((error) => {
				console.error('❌ Variant fetch error:', error);
			});
	}

	static renderSectionFromFetch(url, event) {
		fetch(url)
			.then((response) => {
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				return response.text();
			})
			.then((responseText) => {
				const html = responseText;
				FacetFiltersForm.filterData = [...FacetFiltersForm.filterData, { html, url }];
				FacetFiltersForm.renderFilters(html, event);
				FacetFiltersForm.renderProductGridContainer(html);
				FacetFiltersForm.renderProductCount(html);
				if (typeof initializeScrollAnimationTrigger === 'function')
					initializeScrollAnimationTrigger(html.innerHTML);
			})
			.catch((error) => {
				console.error('❌ Fetch error:', error);
			});
	}

	static renderSectionFromCache(filterDataUrl, event) {
		const html = FacetFiltersForm.filterData.find(filterDataUrl).html;
		FacetFiltersForm.renderFilters(html, event);
		FacetFiltersForm.renderProductGridContainer(html);
		FacetFiltersForm.renderProductCount(html);
		if (typeof initializeScrollAnimationTrigger === 'function')
			initializeScrollAnimationTrigger(html.innerHTML);
	}

	static renderProductGridContainer(html) {
		const currentContainer = document.getElementById('ProductGridContainer');
		if (!currentContainer) {
			return;
		}

		const parsedHTML = new DOMParser().parseFromString(html, 'text/html');
		const parsedContainer = parsedHTML.getElementById('ProductGridContainer');
		if (!parsedContainer) {
			return;
		}

		currentContainer.innerHTML = parsedContainer.innerHTML;

		// Remove loading class from collection if it exists
		const collectionElement = currentContainer.querySelector('.collection');
		if (collectionElement) {
			collectionElement.classList.remove('loading');
		}

		// Reload Trustpilot widgets pour les cartes chargées dynamiquement
		if (typeof Trustpilot !== 'undefined') {
			currentContainer.querySelectorAll('.trustpilot-widget').forEach((el) => {
				Trustpilot.loadFromElement(el, true);
			});
		}

		// Réactiver le lazy observer pour les nouvelles images
		document.dispatchEvent(new CustomEvent('reactivateLazyObserver'));

		document
			.getElementById('ProductGridContainer')
			.querySelectorAll('.scroll-trigger')
			.forEach((element) => {
				element.classList.add('scroll-trigger--cancel');
			});
	}

	static renderVariantGridContainer(html) {
		const variantsContainer = document.getElementById('VariantsGridContainer');
		if (!variantsContainer) return;

		const parsedHTML = new DOMParser().parseFromString(html, 'text/html');
		const parsedContainer = parsedHTML.getElementById('VariantsGridContainer');
		if (!parsedContainer) return;

		variantsContainer.innerHTML = parsedContainer.innerHTML;

		// Réactiver le lazy observer pour les nouvelles images
		document.dispatchEvent(new CustomEvent('reactivateLazyObserver'));

		document
			.getElementById('VariantsGridContainer')
			.querySelectorAll('.scroll-trigger')
			.forEach((element) => {
				element.classList.add('scroll-trigger--cancel');
			});
	}

	static renderProductCount(html) {
		const parsedHTML = new DOMParser().parseFromString(html, 'text/html');

		// Try to get count from ProductCount first, then ProductCountDesktop as fallback
		let countElement = parsedHTML.getElementById('ProductCount');
		if (!countElement) {
			countElement = parsedHTML.getElementById('ProductCountDesktop');
		}

		if (!countElement) {
			return;
		}

		const count = countElement.innerHTML;
		const container = document.getElementById('ProductCount');
		const containerDesktop = document.getElementById('ProductCountDesktop');

		if (container) {
			container.innerHTML = count;
			container.classList.remove('loading');
		}
		if (containerDesktop) {
			containerDesktop.innerHTML = count;
			containerDesktop.classList.remove('loading');
		}

		const loadingSpinners = document.querySelectorAll(
			'.facets-container .loading__spinner, facet-filters-form .loading__spinner',
		);
		loadingSpinners.forEach((spinner) => spinner.classList.add('hidden'));
	}

	static renderFilters(html, event) {
		const parsedHTML = new DOMParser().parseFromString(html, 'text/html');
		const facetDetailsElementsFromFetch = parsedHTML.querySelectorAll(
			'#FacetFiltersForm .js-filter, #FacetFiltersFormMobile .js-filter, #FacetFiltersPillsForm .js-filter',
		);
		const facetDetailsElementsFromDom = document.querySelectorAll(
			'#FacetFiltersForm .js-filter, #FacetFiltersFormMobile .js-filter, #FacetFiltersPillsForm .js-filter',
		);

		// Remove facets that are no longer returned from the server
		Array.from(facetDetailsElementsFromDom).forEach((currentElement) => {
			if (!Array.from(facetDetailsElementsFromFetch).some(({ id }) => currentElement.id === id)) {
				currentElement.remove();
			}
		});

		const matchesId = (element) => {
			const jsFilter = event ? event.target.closest('.js-filter') : undefined;
			return jsFilter ? element.id === jsFilter.id : false;
		};

		const facetsToRender = Array.from(facetDetailsElementsFromFetch).filter(
			(element) => !matchesId(element),
		);
		const countsToRender = Array.from(facetDetailsElementsFromFetch).find(matchesId);

		facetsToRender.forEach((elementToRender, index) => {
			const currentElement = document.getElementById(elementToRender.id);
			// Element already rendered in the DOM so just update the innerHTML
			if (currentElement) {
				document.getElementById(elementToRender.id).innerHTML = elementToRender.innerHTML;
			} else {
				if (index > 0) {
					const { className: previousElementClassName, id: previousElementId } =
						facetsToRender[index - 1];
					// Same facet type (eg horizontal/vertical or drawer/mobile)
					if (elementToRender.className === previousElementClassName) {
						document.getElementById(previousElementId).after(elementToRender);
						return;
					}
				}

				if (elementToRender.parentElement) {
					document
						.querySelector(`#${elementToRender.parentElement.id} .js-filter`)
						.before(elementToRender);
				}
			}
		});

		FacetFiltersForm.renderActiveFacets(parsedHTML);
		FacetFiltersForm.renderAdditionalElements(parsedHTML);

		if (countsToRender) {
			const closestJSFilterID = event.target.closest('.js-filter').id;

			if (closestJSFilterID) {
				FacetFiltersForm.renderCounts(countsToRender, event.target.closest('.js-filter'));
				FacetFiltersForm.renderMobileCounts(
					countsToRender,
					document.getElementById(closestJSFilterID),
				);

				const newFacetDetailsElement = document.getElementById(closestJSFilterID);
				const newElementSelector = newFacetDetailsElement.classList.contains(
					'mobile-facets__details',
				)
					? `.mobile-facets__close-button`
					: `.facets__summary`;
				const newElementToActivate = newFacetDetailsElement.querySelector(newElementSelector);

				const isTextInput = event.target.getAttribute('type') === 'text';

				if (newElementToActivate && !isTextInput) newElementToActivate.focus();
			}
		}
	}

	static renderActiveFacets(html) {
		const activeFacetElementSelectors = ['.active-facets-mobile', '.active-facets-desktop'];

		activeFacetElementSelectors.forEach((selector) => {
			const activeFacetsElement = html.querySelector(selector);
			if (!activeFacetsElement) return;
			document.querySelector(selector).innerHTML = activeFacetsElement.innerHTML;
		});

		FacetFiltersForm.toggleActiveFacets(false);
	}

	static renderAdditionalElements(html) {
		const mobileElementSelectors = ['.mobile-facets__open', '.mobile-facets__count', '.sorting'];

		mobileElementSelectors.forEach((selector) => {
			if (!html.querySelector(selector)) return;
			document.querySelector(selector).innerHTML = html.querySelector(selector).innerHTML;
		});

		document.getElementById('FacetFiltersFormMobile').closest('menu-drawer').bindEvents();
	}

	static renderCounts(source, target) {
		const targetSummary = target.querySelector('.facets__summary');
		const sourceSummary = source.querySelector('.facets__summary');

		if (sourceSummary && targetSummary) {
			targetSummary.outerHTML = sourceSummary.outerHTML;
		}

		const targetHeaderElement = target.querySelector('.facets__header');
		const sourceHeaderElement = source.querySelector('.facets__header');

		if (sourceHeaderElement && targetHeaderElement) {
			targetHeaderElement.outerHTML = sourceHeaderElement.outerHTML;
		}

		const targetWrapElement = target.querySelector('.facets-wrap');
		const sourceWrapElement = source.querySelector('.facets-wrap');

		if (sourceWrapElement && targetWrapElement) {
			const isShowingMore = Boolean(
				target.querySelector('show-more-button .label-show-more.hidden'),
			);
			if (isShowingMore) {
				sourceWrapElement
					.querySelectorAll('.facets__item.hidden')
					.forEach((hiddenItem) => hiddenItem.classList.replace('hidden', 'show-more-item'));
			}

			targetWrapElement.outerHTML = sourceWrapElement.outerHTML;
		}
	}

	static renderMobileCounts(source, target) {
		const targetFacetsList = target.querySelector('.mobile-facets__list');
		const sourceFacetsList = source.querySelector('.mobile-facets__list');

		if (sourceFacetsList && targetFacetsList) {
			targetFacetsList.outerHTML = sourceFacetsList.outerHTML;
		}
	}

	static updateURLHash(searchParams) {
		history.pushState(
			{ searchParams },
			'',
			`${window.location.pathname}${searchParams && '?'.concat(searchParams)}`,
		);
	}

	static getSections() {
		const sections = [];

		const productGrid = document.getElementById('product-grid');
		if (productGrid && productGrid.dataset.id) {
			sections.push({
				section: productGrid.dataset.id,
				type: productGrid.dataset.type || 'default',
			});
		}

		const variantsGrid = document.getElementById('VariantsGridContainer');
		if (variantsGrid && variantsGrid.dataset.id) {
			sections.push({
				section: variantsGrid.dataset.id,
				type: 'variants',
			});
		}

		return sections;
	}

	createSearchParams(form) {
		const formData = new FormData(form);
		return new URLSearchParams(formData).toString();
	}

	onSubmitForm(searchParams, event) {
		FacetFiltersForm.renderPage(searchParams, event);
	}

	onSubmitHandler(event) {
		event.preventDefault();
		const sortFilterForms = document.querySelectorAll('facet-filters-form form');
		if (event.srcElement.className == 'mobile-facets__checkbox') {
			const searchParams = this.createSearchParams(event.target.closest('form'));
			this.onSubmitForm(searchParams, event);
		} else {
			const forms = [];
			const isMobile = event.target.closest('form').id === 'FacetFiltersFormMobile';

			sortFilterForms.forEach((form) => {
				if (!isMobile) {
					if (
						form.id === 'FacetSortForm' ||
						form.id === 'FacetFiltersForm' ||
						form.id === 'FacetSortDrawerForm'
					) {
						forms.push(this.createSearchParams(form));
					}
				} else if (form.id === 'FacetFiltersFormMobile') {
					forms.push(this.createSearchParams(form));
				}
			});
			this.onSubmitForm(forms.join('&'), event);
		}
	}

	onActiveFilterClick(event) {
		event.preventDefault();
		FacetFiltersForm.toggleActiveFacets();
		const url =
			event.currentTarget.href.indexOf('?') == -1
				? ''
				: event.currentTarget.href.slice(event.currentTarget.href.indexOf('?') + 1);
		FacetFiltersForm.renderPage(url);
	}
}

FacetFiltersForm.filterData = [];
FacetFiltersForm.searchParamsInitial = window.location.search.slice(1);
FacetFiltersForm.searchParamsPrev = window.location.search.slice(1);
customElements.define('facet-filters-form', FacetFiltersForm);
FacetFiltersForm.setListeners();

class PriceRange extends HTMLElement {
	constructor() {
		super();
		// Sélectionner les éléments
		this.rangeInputs = Array.from(this.querySelectorAll('input[type="range"]'));
		this.rangeMin = this.querySelector('.range-min');
		this.rangeMax = this.querySelector('.range-max');
		this.progressBar = this.querySelector('.slider-price-range .progress');
		this.minPrice = this.querySelector('.inputValues span:first-child');
		this.maxPrice = this.querySelector('.inputValues span:last-child');

		// Définir l'écart minimum (en euros)
		this.priceGap = 10;

		if (this.rangeInputs.length === 2 && this.progressBar && this.minPrice && this.maxPrice) {
			// Initialiser les écouteurs d'événements
			this.rangeInputs.forEach((input) => {
				input.addEventListener('input', this.updateRangeValue.bind(this));
			});

			// S'assurer que la propriété right est supprimée pour éviter les conflits
			if (this.progressBar) {
				this.progressBar.style.right = 'auto';
			}

			// Initialiser la barre de progression
			this.updateRangeValue({ target: this.rangeMin });
		} else {
			console.warn('PriceRange: éléments manquants', {
				rangeInputs: this.rangeInputs.length === 2,
				progressBar: !!this.progressBar,
				minPrice: !!this.minPrice,
				maxPrice: !!this.maxPrice,
			});
		}

		// Ajouter un délai d'initialisation au cas où le DOM n'est pas entièrement chargé
		setTimeout(() => {
			if (this.progressBar && this.rangeMin && this.rangeMax) {
				this.updateRangeValue({ target: this.rangeMin });
			}
		}, 100);
	}

	updateRangeValue(event) {
		// Obtenir les valeurs actuelles
		let minVal = parseFloat(this.rangeMin.value);
		let maxVal = parseFloat(this.rangeMax.value);
		let minRange = parseFloat(this.rangeMin.min || 0);
		let maxRange = parseFloat(this.rangeMax.max);

		// Vérifier que nous avons des valeurs valides
		if (isNaN(minVal) || isNaN(maxVal) || isNaN(maxRange)) {
			console.warn('PriceRange: valeurs invalides', { minVal, maxVal, maxRange });
			return;
		}

		// Appliquer l'écart minimum
		if (maxVal - minVal < this.priceGap) {
			if (event.target === this.rangeMin) {
				this.rangeMin.value = maxVal - this.priceGap;
				minVal = parseFloat(this.rangeMin.value);
			} else {
				this.rangeMax.value = minVal + this.priceGap;
				maxVal = parseFloat(this.rangeMax.value);
			}
		}

		// Mise à jour de l'affichage des prix
		if (this.minPrice && this.maxPrice) {
			this.minPrice.textContent = new Intl.NumberFormat('fr-FR', {
				style: 'currency',
				currency: 'EUR',
			}).format(minVal);

			this.maxPrice.textContent = new Intl.NumberFormat('fr-FR', {
				style: 'currency',
				currency: 'EUR',
			}).format(maxVal);
		}

		// Mise à jour de la barre de progression
		if (this.progressBar) {
			// Calcul des positions en pourcentage en tenant compte du range complet
			const totalRange = maxRange - minRange;

			// Ajout d'un facteur de correction pour compenser les différences visuelles
			// entre les curseurs et la barre de progression
			const correctionFactor = 0.015; // 1.5% de correction

			let minPercent = ((minVal - minRange) / totalRange) * 100;
			let maxPercent = ((maxVal - minRange) / totalRange) * 100;

			// Application des corrections pour améliorer l'alignement visuel
			minPercent = Math.max(0, minPercent - minPercent * correctionFactor);
			maxPercent = Math.min(100, maxPercent + (100 - maxPercent) * correctionFactor);

			// Si les valeurs sont proches des extrémités, ajuster pour parfait alignement
			if (minVal <= minRange + totalRange * 0.05) minPercent = 0;
			if (maxVal >= maxRange - totalRange * 0.05) maxPercent = 100;

			// Appliquer les styles
			this.progressBar.style.left = minPercent + '%';
			this.progressBar.style.width = maxPercent - minPercent + '%';
		}
	}
}

customElements.define('price-range', PriceRange);

class FacetRemove extends HTMLElement {
	constructor() {
		super();
		const facetLink = this.querySelector('a');
		facetLink.setAttribute('role', 'button');
		facetLink.addEventListener('click', this.closeFilter.bind(this));
		facetLink.addEventListener('keyup', (event) => {
			event.preventDefault();
			if (event.code.toUpperCase() === 'SPACE') this.closeFilter(event);
		});
	}

	closeFilter(event) {
		event.preventDefault();
		const form = this.closest('facet-filters-form') || document.querySelector('facet-filters-form');
		form.onActiveFilterClick(event);
	}
}

customElements.define('facet-remove', FacetRemove);

for (const el of document.querySelectorAll('.mobile-facets__details.details-animate')) {
	// S'assurer que l'élément est ouvert par défaut
	if (!el.hasAttribute('open')) {
		el.setAttribute('open', '');
	}

	new window.DetailsAnimate(el, {
		animateProperties: {
			height: true,
			opacity: false,
			transformY: true,
		},
		animateContentOnly: true,
		animateOnShrink: true,
		duration: 300,
		easing: 'ease-out',
	});
}

// Écouteur pour restaurer l'état ouvert des facettes quand le drawer est ouvert
document.addEventListener('DOMContentLoaded', function () {
	const mobileDrawer = document.querySelector('menu-drawer.mobile-facets__wrapper');
	if (mobileDrawer) {
		const mainDetails = mobileDrawer.querySelector('details');
		if (mainDetails) {
			mainDetails.addEventListener('toggle', function (event) {
				if (mainDetails.open) {
					// Quand le drawer s'ouvre, s'assurer que les filtres sont ouverts
					setTimeout(() => {
						const facetsDetails = document.querySelectorAll(
							'.mobile-facets__details.details-animate',
						);
						facetsDetails.forEach((el) => {
							if (!el.hasAttribute('open')) {
								el.setAttribute('open', '');
							}
						});
					}, 100); // Attendre que le drawer soit complètement ouvert
				}
			});
		}
	}
});
