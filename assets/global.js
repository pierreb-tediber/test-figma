function getFocusableElements(container) {
	return Array.from(
		container.querySelectorAll(
			"summary, a[href], button:enabled, [tabindex]:not([tabindex^='-']), [draggable], area, input:not([type=hidden]):enabled, select:enabled, textarea:enabled, object, iframe",
		),
	);
}

class SectionId {
	static #separator = '__';

	// for a qualified section id (e.g. 'template--22224696705326__main'), return just the section id (e.g. 'template--22224696705326')
	static parseId(qualifiedSectionId) {
		return qualifiedSectionId.split(SectionId.#separator)[0];
	}

	// for a qualified section id (e.g. 'template--22224696705326__main'), return just the section name (e.g. 'main')
	static parseSectionName(qualifiedSectionId) {
		return qualifiedSectionId.split(SectionId.#separator)[1];
	}

	// for a section id (e.g. 'template--22224696705326') and a section name (e.g. 'recommended-products'), return a qualified section id (e.g. 'template--22224696705326__recommended-products')
	static getIdForSection(sectionId, sectionName) {
		return `${sectionId}${SectionId.#separator}${sectionName}`;
	}
}

class HTMLUpdateUtility {
	/**
	 * Used to swap an HTML node with a new node.
	 * The new node is inserted as a previous sibling to the old node, the old node is hidden, and then the old node is removed.
	 *
	 * The function currently uses a double buffer approach, but this should be replaced by a view transition once it is more widely supported https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
	 */
	static viewTransition(oldNode, newContent, preProcessCallbacks = [], postProcessCallbacks = []) {
		preProcessCallbacks?.forEach((callback) => callback(newContent));

		const newNodeWrapper = document.createElement('div');
		HTMLUpdateUtility.setInnerHTML(newNodeWrapper, newContent.outerHTML);
		const newNode = newNodeWrapper.firstChild;

		// dedupe IDs
		const uniqueKey = Date.now();
		oldNode.querySelectorAll('[id], [form]').forEach((element) => {
			element.id && (element.id = `${element.id}-${uniqueKey}`);
			element.form &&
				element.setAttribute('form', `${element.form.getAttribute('id')}-${uniqueKey}`);
		});

		oldNode.parentNode.insertBefore(newNode, oldNode);
		oldNode.style.display = 'none';

		postProcessCallbacks?.forEach((callback) => callback(newNode));

		setTimeout(() => oldNode.remove(), 500);
	}

	// Sets inner HTML and reinjects the script tags to allow execution. By default, scripts are disabled when using element.innerHTML.
	static setInnerHTML(element, html) {
		element.innerHTML = html;
		element.querySelectorAll('script').forEach((oldScriptTag) => {
			const newScriptTag = document.createElement('script');
			Array.from(oldScriptTag.attributes).forEach((attribute) => {
				newScriptTag.setAttribute(attribute.name, attribute.value);
			});
			newScriptTag.appendChild(document.createTextNode(oldScriptTag.innerHTML));
			oldScriptTag.parentNode.replaceChild(newScriptTag, oldScriptTag);
		});
	}
}

document.querySelectorAll('[id^="Details-"] summary').forEach((summary) => {
	summary.setAttribute('role', 'button');
	summary.setAttribute('aria-expanded', summary.parentNode.hasAttribute('open'));

	if (summary.nextElementSibling.getAttribute('id')) {
		summary.setAttribute('aria-controls', summary.nextElementSibling.id);
	}

	summary.addEventListener('click', (event) => {
		event.currentTarget.setAttribute(
			'aria-expanded',
			!event.currentTarget.closest('details').hasAttribute('open'),
		);
	});

	if (summary.closest('header-drawer, menu-drawer')) return;
	summary.parentElement.addEventListener('keyup', onKeyUpEscape);
});

const trapFocusHandlers = {};

function trapFocus(container, elementToFocus = container) {
	var elements = getFocusableElements(container);
	var first = elements[0];
	var last = elements[elements.length - 1];

	removeTrapFocus();

	trapFocusHandlers.focusin = (event) => {
		if (event.target !== container && event.target !== last && event.target !== first) return;

		document.addEventListener('keydown', trapFocusHandlers.keydown);
	};

	trapFocusHandlers.focusout = function () {
		document.removeEventListener('keydown', trapFocusHandlers.keydown);
	};

	trapFocusHandlers.keydown = function (event) {
		if (event.code.toUpperCase() !== 'TAB') return; // If not TAB key
		// On the last focusable element and tab forward, focus the first element.
		if (event.target === last && !event.shiftKey) {
			event.preventDefault();
			first.focus();
		}

		//  On the first focusable element and tab backward, focus the last element.
		if ((event.target === container || event.target === first) && event.shiftKey) {
			event.preventDefault();
			last.focus();
		}
	};

	document.addEventListener('focusout', trapFocusHandlers.focusout);
	document.addEventListener('focusin', trapFocusHandlers.focusin);

	// Vérifier que elementToFocus existe avant d'appeler focus()
	if (elementToFocus) {
		elementToFocus.focus();

		if (
			elementToFocus.tagName === 'INPUT' &&
			['search', 'text', 'email', 'url'].includes(elementToFocus.type) &&
			elementToFocus.value
		) {
			elementToFocus.setSelectionRange(0, elementToFocus.value.length);
		}
	}
}

// Here run the querySelector to figure out if the browser supports :focus-visible or not and run code based on it.
try {
	document.querySelector(':focus-visible');
} catch (e) {
	focusVisiblePolyfill();
}

function focusVisiblePolyfill() {
	const navKeys = [
		'ARROWUP',
		'ARROWDOWN',
		'ARROWLEFT',
		'ARROWRIGHT',
		'TAB',
		'ENTER',
		'SPACE',
		'ESCAPE',
		'HOME',
		'END',
		'PAGEUP',
		'PAGEDOWN',
	];
	let currentFocusedElement = null;
	let mouseClick = null;

	window.addEventListener('keydown', (event) => {
		if (navKeys.includes(event.code.toUpperCase())) {
			mouseClick = false;
		}
	});

	window.addEventListener('mousedown', (event) => {
		mouseClick = true;
	});

	window.addEventListener(
		'focus',
		() => {
			if (currentFocusedElement) currentFocusedElement.classList.remove('focused');

			if (mouseClick) return;

			currentFocusedElement = document.activeElement;
			currentFocusedElement.classList.add('focused');
		},
		true,
	);
}

function pauseAllMedia() {
	document.querySelectorAll('.js-youtube').forEach((video) => {
		video.contentWindow.postMessage(
			'{"event":"command","func":"' + 'pauseVideo' + '","args":""}',
			'*',
		);
	});
	document.querySelectorAll('.js-vimeo').forEach((video) => {
		video.contentWindow.postMessage('{"method":"pause"}', '*');
	});
	document.querySelectorAll('video').forEach((video) => video.pause());
	document.querySelectorAll('product-model').forEach((model) => {
		if (model.modelViewerUI) model.modelViewerUI.pause();
	});
}

function removeTrapFocus(elementToFocus = null) {
	document.removeEventListener('focusin', trapFocusHandlers.focusin);
	document.removeEventListener('focusout', trapFocusHandlers.focusout);
	document.removeEventListener('keydown', trapFocusHandlers.keydown);

	if (elementToFocus) elementToFocus.focus();
}

function onKeyUpEscape(event) {
	if (event.code.toUpperCase() !== 'ESCAPE') return;

	const openDetailsElement = event.target.closest('details[open]');
	if (!openDetailsElement) return;

	const summaryElement = openDetailsElement.querySelector('summary');
	openDetailsElement.removeAttribute('open');
	summaryElement.setAttribute('aria-expanded', false);
	summaryElement.focus();
}

class QuantityInput extends HTMLElement {
	constructor() {
		super();
	}

	quantityUpdateUnsubscriber = undefined;

	connectedCallback() {
		this.bindEvents();
	}

	disconnectedCallback() {
		this.removeEvents();
	}

	updatedCallback() {
		this.removeEvents();
		this.bindEvents();
	}

	bindEvents() {
		this.input = this.querySelector('input');
		this.changeEvent = new Event('change', { bubbles: true });

		// Stocker les références des fonctions bindées
		this.boundInputChange = this.onInputChange.bind(this);
		this.boundButtonClick = this.onButtonClick.bind(this);
		this.boundValidateQtyRules = this.validateQtyRules.bind(this);

		this.input.addEventListener('change', this.boundInputChange);
		this.querySelectorAll('button').forEach((button) =>
			button.addEventListener('click', this.boundButtonClick),
		);

		this.validateQtyRules();
		this.quantityUpdateUnsubscriber = subscribe(
			PUB_SUB_EVENTS.quantityUpdate,
			this.boundValidateQtyRules,
		);
	}

	removeEvents() {
		this.input?.removeEventListener('change', this.boundInputChange);
		this.querySelectorAll('button').forEach((button) =>
			button?.removeEventListener('click', this.boundButtonClick),
		);

		if (this.quantityUpdateUnsubscriber) {
			this.quantityUpdateUnsubscriber();
		}
	}

	onInputChange(event) {
		this.validateQtyRules();
		this.#emitQuantityChange();
	}

	onButtonClick(event) {
		event.preventDefault();
		const previousValue = this.input.value;

		if (event.target.name === 'plus') {
			if (parseInt(this.input.dataset.min) > parseInt(this.input.step) && this.input.value == 0) {
				this.input.value = this.input.dataset.min;
			} else {
				this.input.stepUp();
			}
		} else {
			this.input.stepDown();
		}

		if (previousValue !== this.input.value) {
			this.input.dispatchEvent(this.changeEvent);
			this.#emitQuantityChange();
		}

		if (this.input.dataset.min === previousValue && event.target.name === 'minus') {
			this.input.value = parseInt(this.input.min);
		}
	}

	/**
	 * Émet un événement personnalisé quand la quantité change
	 * @private
	 */
	#emitQuantityChange() {
		const quantity = parseInt(this.input.value) || 0;
		const quantityChangeEvent = new CustomEvent('quantity-change', {
			bubbles: true,
			detail: {
				quantity: quantity,
				element: this,
			},
		});
		this.dispatchEvent(quantityChangeEvent);
	}

	validateQtyRules() {
		const value = parseInt(this.input.value);
		if (this.input.min) {
			const buttonMinus = this.querySelector(".quantity__button[name='minus']");
			buttonMinus.classList.toggle('disabled', parseInt(value) <= parseInt(this.input.min));
		}
		if (this.input.max) {
			const max = parseInt(this.input.max);
			const buttonPlus = this.querySelector(".quantity__button[name='plus']");
			buttonPlus.classList.toggle('disabled', value >= max);
		}
	}
}

customElements.define('quantity-input', QuantityInput);

function debounce(fn, wait) {
	let t;
	return (...args) => {
		clearTimeout(t);
		t = setTimeout(() => fn.apply(this, args), wait);
	};
}

function throttle(fn, delay) {
	let lastCall = 0;
	return function (...args) {
		const now = new Date().getTime();
		if (now - lastCall < delay) {
			return;
		}
		lastCall = now;
		return fn(...args);
	};
}

function fetchConfig(type = 'json') {
	return {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: `application/${type}` },
	};
}

/*
 * Shopify Common JS
 *
 */
if (typeof window.Shopify == 'undefined') {
	window.Shopify = {};
}

Shopify.bind = function (fn, scope) {
	return function () {
		return fn.apply(scope, arguments);
	};
};

Shopify.setSelectorByValue = function (selector, value) {
	for (var i = 0, count = selector.options.length; i < count; i++) {
		var option = selector.options[i];
		if (value == option.value || value == option.innerHTML) {
			selector.selectedIndex = i;
			return i;
		}
	}
};

Shopify.addListener = function (target, eventName, callback) {
	target.addEventListener
		? target.addEventListener(eventName, callback, false)
		: target.attachEvent('on' + eventName, callback);
};

Shopify.postLink = function (path, options) {
	options = options || {};
	var method = options['method'] || 'post';
	var params = options['parameters'] || {};

	var form = document.createElement('form');
	form.setAttribute('method', method);
	form.setAttribute('action', path);

	for (var key in params) {
		var hiddenField = document.createElement('input');
		hiddenField.setAttribute('type', 'hidden');
		hiddenField.setAttribute('name', key);
		hiddenField.setAttribute('value', params[key]);
		form.appendChild(hiddenField);
	}
	document.body.appendChild(form);
	form.submit();
	document.body.removeChild(form);
};

Shopify.CountryProvinceSelector = function (country_domid, province_domid, options) {
	this.countryEl = document.getElementById(country_domid);
	this.provinceEl = document.getElementById(province_domid);
	this.provinceContainer = document.getElementById(options['hideElement'] || province_domid);

	Shopify.addListener(this.countryEl, 'change', Shopify.bind(this.countryHandler, this));

	this.initCountry();
	this.initProvince();
};

Shopify.CountryProvinceSelector.prototype = {
	initCountry: function () {
		var value = this.countryEl.getAttribute('data-default');
		Shopify.setSelectorByValue(this.countryEl, value);
		this.countryHandler();
	},

	initProvince: function () {
		var value = this.provinceEl.getAttribute('data-default');
		if (value && this.provinceEl.options.length > 0) {
			Shopify.setSelectorByValue(this.provinceEl, value);
		}
	},

	countryHandler: function (e) {
		var opt = this.countryEl.options[this.countryEl.selectedIndex];
		var raw = opt.getAttribute('data-provinces');
		var provinces = JSON.parse(raw);

		this.clearOptions(this.provinceEl);
		if (provinces && provinces.length == 0) {
			this.provinceContainer.style.display = 'none';
		} else {
			for (var i = 0; i < provinces.length; i++) {
				var opt = document.createElement('option');
				opt.value = provinces[i][0];
				opt.innerHTML = provinces[i][1];
				this.provinceEl.appendChild(opt);
			}

			this.provinceContainer.style.display = '';
		}
	},

	clearOptions: function (selector) {
		while (selector.firstChild) {
			selector.removeChild(selector.firstChild);
		}
	},

	setOptions: function (selector, values) {
		for (var i = 0, count = values.length; i < values.length; i++) {
			var opt = document.createElement('option');
			opt.value = values[i];
			opt.innerHTML = values[i];
			selector.appendChild(opt);
		}
	},
};

class MenuDrawer extends HTMLElement {
	static hasMenuContentFetched = false;
	constructor() {
		super();

		this.mainDetailsToggle = this.querySelector('details');
		this.sectionId = this.dataset.sectionId;

		this.addEventListener('keyup', this.onKeyUp.bind(this));
		this.addEventListener('focusout', this.onFocusOut.bind(this));
		this.bindEvents();
	}

	bindEvents() {
		this.querySelectorAll('summary').forEach((summary) =>
			summary.addEventListener('click', this.onSummaryClick.bind(this)),
		);
		this.querySelectorAll(
			'button:not(.localization-selector):not(.country-selector__close-button):not(.country-filter__reset-button)',
		).forEach((button) => button.addEventListener('click', this.onCloseButtonClick.bind(this)));
	}

	async fetchMenuContent() {
		const loadingSpinners = this.querySelectorAll('.loading__spinner');
		loadingSpinners.forEach((spinner) => spinner.classList.remove('hidden'));

		let url = `${window.location.pathname}?section_id=${this.sectionId}`;
		if (window.routes.template_name === '404') {
			url = `/?section_id=${this.sectionId}`;
		}

		try {
			const response = await fetch(url);
			const html = await response.text();

			const doc = new DOMParser().parseFromString(html, 'text/html');
			const newDrawerMenus = doc.querySelectorAll('.menu-drawer__submenu');

			this.querySelectorAll('.menu-drawer__submenu').forEach((container, index) => {
				if (newDrawerMenus[index]) {
					container.innerHTML = newDrawerMenus[index].innerHTML;
				}
			});

			// Reload Trustpilot widgets pour les cartes chargées dynamiquement
			if (typeof Trustpilot !== 'undefined') {
				this.querySelectorAll('.trustpilot-widget').forEach((el) => {
					Trustpilot.loadFromElement(el, true);
				});
			}

			MenuDrawer.hasMenuContentFetched = true;
			this.bindEvents();
		} catch (error) {
			console.error('Error loading menu drawer content:', error);
			this.querySelectorAll('.menu-drawer__submenu').forEach((container) => {
				container.innerHTML = '<p>Error loading menu content</p>';
			});
		} finally {
			loadingSpinners.forEach((spinner) => spinner.classList.add('hidden'));
		}
	}

	onKeyUp(event) {
		if (event.code.toUpperCase() !== 'ESCAPE') return;

		const openDetailsElement = event.target.closest('details[open]');
		if (!openDetailsElement) return;

		openDetailsElement === this.mainDetailsToggle
			? this.closeMenuDrawer(event, this.mainDetailsToggle.querySelector('summary'))
			: this.closeSubmenu(openDetailsElement);
	}

	async onSummaryClick(event) {
		const summaryElement = event.currentTarget;
		const detailsElement = summaryElement.parentNode;
		const parentMenuElement = detailsElement.closest('.has-submenu');
		const isOpen = detailsElement.hasAttribute('open');
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

		function addTrapFocus() {
			trapFocus(summaryElement.nextElementSibling, detailsElement.querySelector('button'));
			summaryElement.nextElementSibling.removeEventListener('transitionend', addTrapFocus);
		}

		if (detailsElement === this.mainDetailsToggle) {
			if (isOpen) event.preventDefault();
			if (isOpen) {
				this.closeMenuDrawer(event, summaryElement);
			} else {
				this.openMenuDrawer(summaryElement);
				// Fetch le contenu du menu si ce n'est pas déjà fait
				if (
					this.sectionId &&
					!MenuDrawer.hasMenuContentFetched &&
					summaryElement.classList.contains('header__icon--menu')
				) {
					await this.fetchMenuContent();
				}
			}

			if (window.matchMedia('(max-width: 990px)')) {
				document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
			}
		} else {
			setTimeout(() => {
				detailsElement.classList.add('menu-opening');
				summaryElement.setAttribute('aria-expanded', true);
				parentMenuElement && parentMenuElement.classList.add('submenu-open');
				!reducedMotion || reducedMotion.matches
					? addTrapFocus()
					: summaryElement.nextElementSibling.addEventListener('transitionend', addTrapFocus);
			}, 100);
		}
	}

	openMenuDrawer(summaryElement) {
		setTimeout(() => {
			this.mainDetailsToggle.classList.add('menu-opening');
		});
		summaryElement.setAttribute('aria-expanded', true);
		trapFocus(this.mainDetailsToggle, summaryElement);
		document.body.classList.add(`overflow-hidden-${this.dataset.breakpoint}`);
	}

	closeMenuDrawer(event, elementToFocus = false) {
		if (event === undefined) return;

		this.mainDetailsToggle.classList.remove('menu-opening');

		// Sélectionner uniquement les details qui ne sont pas des filtres de facets
		this.mainDetailsToggle
			.querySelectorAll('details:not(.mobile-facets__details)')
			.forEach((details) => {
				details.removeAttribute('open');
				details.classList.remove('menu-opening');
			});

		this.mainDetailsToggle.querySelectorAll('.submenu-open').forEach((submenu) => {
			submenu.classList.remove('submenu-open');
		});
		document.body.classList.remove(`overflow-hidden-${this.dataset.breakpoint}`);
		removeTrapFocus(elementToFocus);
		this.closeAnimation(this.mainDetailsToggle);

		if (event instanceof KeyboardEvent) elementToFocus?.setAttribute('aria-expanded', false);
	}

	onFocusOut() {
		setTimeout(() => {
			if (
				this.mainDetailsToggle.hasAttribute('open') &&
				!this.mainDetailsToggle.contains(document.activeElement)
			)
				this.closeMenuDrawer();
		});
	}

	onCloseButtonClick(event) {
		const detailsElement = event.currentTarget.closest('details');
		this.closeSubmenu(detailsElement);
	}

	closeSubmenu(detailsElement) {
		const parentMenuElement = detailsElement.closest('.submenu-open');
		parentMenuElement && parentMenuElement.classList.remove('submenu-open');
		detailsElement.classList.remove('menu-opening');
		detailsElement.querySelector('summary').setAttribute('aria-expanded', false);
		removeTrapFocus(detailsElement.querySelector('summary'));
		this.closeAnimation(detailsElement);
	}

	closeAnimation(detailsElement) {
		let animationStart;

		const handleAnimation = (time) => {
			if (animationStart === undefined) {
				animationStart = time;
			}

			const elapsedTime = time - animationStart;

			if (elapsedTime < 400) {
				window.requestAnimationFrame(handleAnimation);
			} else {
				detailsElement.removeAttribute('open');
				if (detailsElement.closest('details[open]')) {
					trapFocus(
						detailsElement.closest('details[open]'),
						detailsElement.querySelector('summary'),
					);
				}
			}
		};

		window.requestAnimationFrame(handleAnimation);
	}
}

customElements.define('menu-drawer', MenuDrawer);

class HeaderDrawer extends MenuDrawer {
	constructor() {
		super();
	}

	openMenuDrawer(summaryElement) {
		this.header = this.header || document.querySelector('.section-header');
		this.borderOffset =
			this.borderOffset ||
			this.closest('.header-wrapper').classList.contains('header-wrapper--border-bottom')
				? 1
				: 0;
		const navBar = this.header.querySelector('.header__nav-bar');
		const navBarHeight = navBar ? navBar.getBoundingClientRect().height : 0;
		document.documentElement.style.setProperty(
			'--header-bottom-position',
			`${parseInt(this.header.getBoundingClientRect().bottom - this.borderOffset - navBarHeight)}px`,
		);
		this.header.classList.add('menu-open');

		setTimeout(() => {
			this.mainDetailsToggle.classList.add('menu-opening');
		});

		summaryElement.setAttribute('aria-expanded', true);
		window.addEventListener('resize', this.onResize);
		trapFocus(this.mainDetailsToggle, summaryElement);
		document.body.classList.add(`overflow-hidden-${this.dataset.breakpoint}`);
	}

	closeMenuDrawer(event, elementToFocus) {
		if (!elementToFocus) return;
		super.closeMenuDrawer(event, elementToFocus);
		this.header.classList.remove('menu-open');
		window.removeEventListener('resize', this.onResize);
	}

	onResize = () => {
		if (this.header) {
			const navBar = this.header.querySelector('.header__nav-bar');
			const navBarHeight = navBar ? navBar.getBoundingClientRect().height : 0;
			document.documentElement.style.setProperty(
				'--header-bottom-position',
				`${parseInt(this.header.getBoundingClientRect().bottom - this.borderOffset - navBarHeight)}px`,
			);
		}
		document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
	};
}

customElements.define('header-drawer', HeaderDrawer);

class ModalDialog extends HTMLElement {
	constructor() {
		super();
		this.querySelector('[id^="ModalClose-"]').addEventListener(
			'click',
			this.hide.bind(this, false),
		);
		this.addEventListener('keyup', (event) => {
			if (event.code.toUpperCase() === 'ESCAPE') this.hide();
		});
		if (this.classList.contains('media-modal')) {
			this.addEventListener('pointerup', (event) => {
				if (event.pointerType === 'mouse' && !event.target.closest('deferred-media, product-model'))
					this.hide();
			});
		} else {
			this.addEventListener('click', (event) => {
				if (event.target === this) this.hide();
			});
		}
	}

	connectedCallback() {
		if (this.moved) return;
		this.moved = true;
		this.dataset.section = this.closest('.shopify-section').id.replace('shopify-section-', '');
		if (this.dataset.noAppend === 'true') return;
		document.body.appendChild(this);
	}

	show(opener) {
		this.openedBy = opener;
		const popup = this.querySelector('.template-popup');
		document.body.classList.add('overflow-hidden');
		this.setAttribute('open', '');
		if (popup) popup.loadContent();
		trapFocus(this, this.querySelector('[role="dialog"]'));
		window.pauseAllMedia();
	}

	hide() {
		document.body.classList.remove('overflow-hidden');
		document.body.dispatchEvent(new CustomEvent('modalClosed'));
		this.removeAttribute('open');
		removeTrapFocus(this.openedBy);
		window.pauseAllMedia();
	}
}
customElements.define('modal-dialog', ModalDialog);

class BulkModal extends HTMLElement {
	constructor() {
		super();
	}

	connectedCallback() {
		const handleIntersection = (entries, observer) => {
			if (!entries[0].isIntersecting) return;
			observer.unobserve(this);
			if (this.innerHTML.trim() === '') {
				const productUrl = this.dataset.url.split('?')[0];
				fetch(`${productUrl}?section_id=bulk-quick-order-list`)
					.then((response) => response.text())
					.then((responseText) => {
						const html = new DOMParser().parseFromString(responseText, 'text/html');
						const sourceQty = html.querySelector('.quick-order-list-container').parentNode;
						this.innerHTML = sourceQty.innerHTML;
					})
					.catch((e) => {
						console.error(e);
					});
			}
		};

		new IntersectionObserver(handleIntersection.bind(this)).observe(
			document.querySelector(`#QuickBulk-${this.dataset.productId}-${this.dataset.sectionId}`),
		);
	}
}

customElements.define('bulk-modal', BulkModal);

class ModalOpener extends HTMLElement {
	constructor() {
		super();

		this.bindEvents();
	}

	bindEvents() {
		const button = this.querySelector('button');
		if (!button) return;
		button.addEventListener('click', () => {
			const modalDialog = document.querySelector(this.getAttribute('data-modal'));
			if (modalDialog) modalDialog.show(button);
		});
	}

	updatedCallback() {
		const modalDialog = document.querySelector(this.getAttribute('data-modal'));
		if (modalDialog && !modalDialog.classList.contains('product-media-modal')) modalDialog.remove();
		this.bindEvents();
	}
}
customElements.define('modal-opener', ModalOpener);

class DeferredMedia extends HTMLElement {
	constructor() {
		super();
		const poster = this.querySelector('[id^="Deferred-Poster-"]');
		if (!poster) return;
		poster.addEventListener('click', this.loadContent.bind(this));
	}

	loadContent(focus = true) {
		window.pauseAllMedia();
		if (!this.getAttribute('loaded')) {
			const content = document.createElement('div');
			content.appendChild(this.querySelector('template').content.firstElementChild.cloneNode(true));

			this.setAttribute('loaded', true);
			const deferredElement = this.appendChild(
				content.querySelector('video, model-viewer, iframe'),
			);
			if (focus) deferredElement.focus();
			if (deferredElement.nodeName == 'VIDEO' && deferredElement.getAttribute('autoplay')) {
				// force autoplay for safari
				deferredElement.play();
			}

			// Workaround for safari iframe bug
			const formerStyle = deferredElement.getAttribute('style');
			deferredElement.setAttribute('style', 'display: block;');
			window.setTimeout(() => {
				deferredElement.setAttribute('style', formerStyle);
			}, 0);
		}
	}
}

customElements.define('deferred-media', DeferredMedia);

class SliderComponent extends HTMLElement {
	constructor() {
		super();

		this.bindConnectedCallback();
	}

	bindConnectedCallback() {
		this.slider = this.querySelector('[id^="Slider-"]');
		this.sliderItems = this.querySelectorAll('[id^="Slide-"]');
		this.enableSliderLooping = false;
		this.currentPageElement = this.querySelector('.slider-counter--current');
		this.pageTotalElement = this.querySelector('.slider-counter--total');
		this.prevButton = this.querySelector('button[name="previous"]');
		this.nextButton = this.querySelector('button[name="next"]');

		if (!this.slider || !this.nextButton) return;

		this.initPages();
		const resizeObserver = new ResizeObserver((entries) => this.initPages());
		resizeObserver.observe(this.slider);

		this.addDots =
			this.querySelector('.slider-buttons')?.classList.contains('slider-buttons-with-dots') &&
			window.innerWidth < 750;
		this.attachEventSliderBtn();

		this.slider.addEventListener('scroll', this.update.bind(this));
		this.prevButton.addEventListener('click', this.onButtonClick.bind(this));
		this.nextButton.addEventListener('click', this.onButtonClick.bind(this));
	}

	updatedCallback() {
		this.bindConnectedCallback();
	}

	initPages() {
		// Filtrer les slides selon la logique de visibilité
		this.sliderItemsToShow = this.getVisibleSlides();

		if (this.sliderItemsToShow.length < 2) return;
		this.sliderItemOffset =
			this.sliderItemsToShow[1].offsetLeft - this.sliderItemsToShow[0].offsetLeft;
		this.slidesPerPage = Math.floor(
			(this.slider.clientWidth - this.sliderItemsToShow[0].offsetLeft) / this.sliderItemOffset,
		);
		this.totalPages = this.sliderItemsToShow.length - this.slidesPerPage + 1;
		this.update();
	}

	resetPages() {
		this.sliderItems = this.querySelectorAll('[id^="Slide-"]');
		this.initPages();

		this.attachEventSliderBtn();
	}

	// Méthode pour obtenir les slides visibles selon la logique de média avec alt
	getVisibleSlides() {
		let visibleSlides = Array.from(this.sliderItems).filter((element) => element.clientWidth > 0);

		return visibleSlides;
	}

	// Méthode publique pour recalculer les pages après changement de variante
	recalculatePages() {
		this.sliderItems = this.querySelectorAll('[id^="Slide-"]');
		this.initPages();
	}

	attachEventSliderBtn() {
		if (!this.addDots) return;
		this.sliderControlWrapper = this.querySelector('.slider-buttons');
		if (!this.sliderControlWrapper) return;

		this.sliderFirstItemNode = this.sliderItemsToShow[0];
		this.sliderControlLinksArray = Array.from(
			this.sliderControlWrapper.querySelectorAll('.slider-counter__link'),
		);
		this.sliderControlLinksArray.forEach((link) =>
			link.addEventListener('click', this.linkToSlide.bind(this)),
		);
	}

	update() {
		// Temporarily prevents unneeded updates resulting from variant changes
		// This should be refactored as part of https://github.com/Shopify/dawn/issues/2057
		if (!this.slider || !this.nextButton) return;

		const previousPage = this.currentPage;
		this.currentPage = Math.round(this.slider.scrollLeft / this.sliderItemOffset) + 1;

		if (this.currentPageElement && this.pageTotalElement) {
			this.currentPageElement.textContent = this.currentPage;
			this.pageTotalElement.textContent = this.totalPages;
		}

		if (this.currentPage != previousPage) {
			this.dispatchEvent(
				new CustomEvent('slideChanged', {
					detail: {
						currentPage: this.currentPage,
						currentElement: this.sliderItemsToShow[this.currentPage - 1],
					},
				}),
			);
		}

		if (this.enableSliderLooping) return;

		if (this.isSlideVisible(this.sliderItemsToShow[0]) && this.slider.scrollLeft === 0) {
			this.prevButton.setAttribute('disabled', 'disabled');
		} else {
			this.prevButton.removeAttribute('disabled');
		}

		if (this.isSlideVisible(this.sliderItemsToShow[this.sliderItemsToShow.length - 1])) {
			this.nextButton.setAttribute('disabled', 'disabled');
		} else {
			this.nextButton.removeAttribute('disabled');
		}

		if (!this.addDots) return;
		this.sliderControlButtons = this.querySelectorAll('.slider-counter__link');

		if (!this.sliderControlButtons.length) return;

		this.sliderControlButtons.forEach((link) => {
			link.classList.remove('slider-counter__link--active');
			link.removeAttribute('aria-current');
		});

		this.sliderControlButtons[this.currentPage - 1].classList.add('slider-counter__link--active');
		this.sliderControlButtons[this.currentPage - 1].setAttribute('aria-current', true);
	}

	isSlideVisible(element, offset = 0) {
		const lastVisibleSlide = this.slider.clientWidth + this.slider.scrollLeft - offset;
		return (
			element.offsetLeft + element.clientWidth <= lastVisibleSlide &&
			element.offsetLeft >= this.slider.scrollLeft
		);
	}

	onButtonClick(event) {
		event.preventDefault();
		const step = event.currentTarget.dataset.step || 1;
		this.slideScrollPosition =
			event.currentTarget.name === 'next'
				? this.slider.scrollLeft + step * this.sliderItemOffset
				: this.slider.scrollLeft - step * this.sliderItemOffset;
		this.setSlidePosition(this.slideScrollPosition);
	}

	setSlidePosition(position) {
		this.slider.scrollTo({
			left: position,
		});
	}

	linkToSlide(event) {
		event.preventDefault();
		const slideScrollPosition =
			this.slider.scrollLeft +
			this.sliderFirstItemNode.clientWidth *
				(this.sliderControlLinksArray.indexOf(event.currentTarget) + 1 - this.currentPage);

		this.slider.scrollTo({
			left: slideScrollPosition,
		});
	}
}

customElements.define('slider-component', SliderComponent);

class SlideshowComponent extends SliderComponent {
	constructor() {
		super();
		this.sliderControlWrapper = this.querySelector('.slider-buttons');
		this.enableSliderLooping = true;

		if (!this.sliderControlWrapper) return;

		this.sliderFirstItemNode = this.slider.querySelector('.slideshow__slide');
		if (this.sliderItemsToShow.length > 0) this.currentPage = 1;

		this.announcementBarSlider = this.querySelector('.announcement-bar-slider');
		// Value below should match --duration-announcement-bar CSS value
		this.announcerBarAnimationDelay = this.announcementBarSlider ? 250 : 0;

		this.sliderControlLinksArray = Array.from(
			this.sliderControlWrapper.querySelectorAll('.slider-counter__link'),
		);
		this.sliderControlLinksArray.forEach((link) =>
			link.addEventListener('click', this.linkToSlide.bind(this)),
		);
		this.slider.addEventListener('scroll', this.setSlideVisibility.bind(this));
		this.setSlideVisibility();

		if (this.announcementBarSlider) {
			this.announcementBarArrowButtonWasClicked = false;

			this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
			this.reducedMotion.addEventListener('change', () => {
				if (this.slider.getAttribute('data-autoplay') === 'true') this.setAutoPlay();
			});

			[this.prevButton, this.nextButton].forEach((button) => {
				button.addEventListener(
					'click',
					() => {
						this.announcementBarArrowButtonWasClicked = true;
					},
					{ once: true },
				);
			});
		}

		if (this.slider.getAttribute('data-autoplay') === 'true') this.setAutoPlay();
	}

	setAutoPlay() {
		this.autoplaySpeed = this.slider.dataset.speed * 1000;
		this.addEventListener('mouseover', this.focusInHandling.bind(this));
		this.addEventListener('mouseleave', this.focusOutHandling.bind(this));
		this.addEventListener('focusin', this.focusInHandling.bind(this));
		this.addEventListener('focusout', this.focusOutHandling.bind(this));

		if (this.querySelector('.slideshow__autoplay')) {
			this.sliderAutoplayButton = this.querySelector('.slideshow__autoplay');
			this.sliderAutoplayButton.addEventListener('click', this.autoPlayToggle.bind(this));
			this.autoplayButtonIsSetToPlay = true;
			this.play();
		} else {
			this.reducedMotion.matches || this.announcementBarArrowButtonWasClicked
				? this.pause()
				: this.play();
		}
	}

	onButtonClick(event) {
		super.onButtonClick(event);
		this.wasClicked = true;

		const isFirstSlide = this.currentPage === 1;
		const isLastSlide = this.currentPage === this.sliderItemsToShow.length;

		if (!isFirstSlide && !isLastSlide) {
			this.applyAnimationToAnnouncementBar(event.currentTarget.name);
			return;
		}

		if (isFirstSlide && event.currentTarget.name === 'previous') {
			this.slideScrollPosition =
				this.slider.scrollLeft +
				this.sliderFirstItemNode.clientWidth * this.sliderItemsToShow.length;
		} else if (isLastSlide && event.currentTarget.name === 'next') {
			this.slideScrollPosition = 0;
		}

		this.setSlidePosition(this.slideScrollPosition);

		this.applyAnimationToAnnouncementBar(event.currentTarget.name);
	}

	setSlidePosition(position) {
		if (this.setPositionTimeout) clearTimeout(this.setPositionTimeout);
		this.setPositionTimeout = setTimeout(() => {
			this.slider.scrollTo({
				left: position,
			});
		}, this.announcerBarAnimationDelay);
	}

	update() {
		super.update();
		this.sliderControlButtons = this.querySelectorAll('.slider-counter__link');
		this.prevButton.removeAttribute('disabled');

		if (!this.sliderControlButtons.length) return;

		this.sliderControlButtons.forEach((link) => {
			link.classList.remove('slider-counter__link--active');
			link.removeAttribute('aria-current');
		});
		this.sliderControlButtons[this.currentPage - 1].classList.add('slider-counter__link--active');
		this.sliderControlButtons[this.currentPage - 1].setAttribute('aria-current', true);
	}

	autoPlayToggle() {
		this.togglePlayButtonState(this.autoplayButtonIsSetToPlay);
		this.autoplayButtonIsSetToPlay ? this.pause() : this.play();
		this.autoplayButtonIsSetToPlay = !this.autoplayButtonIsSetToPlay;
	}

	focusOutHandling(event) {
		if (this.sliderAutoplayButton) {
			const focusedOnAutoplayButton =
				event.target === this.sliderAutoplayButton ||
				this.sliderAutoplayButton.contains(event.target);
			if (!this.autoplayButtonIsSetToPlay || focusedOnAutoplayButton) return;
			this.play();
		} else if (!this.reducedMotion.matches && !this.announcementBarArrowButtonWasClicked) {
			this.play();
		}
	}

	focusInHandling(event) {
		if (this.sliderAutoplayButton) {
			const focusedOnAutoplayButton =
				event.target === this.sliderAutoplayButton ||
				this.sliderAutoplayButton.contains(event.target);
			if (focusedOnAutoplayButton && this.autoplayButtonIsSetToPlay) {
				this.play();
			} else if (this.autoplayButtonIsSetToPlay) {
				this.pause();
			}
		} else if (this.announcementBarSlider.contains(event.target)) {
			this.pause();
		}
	}

	play() {
		this.slider.setAttribute('aria-live', 'off');
		clearInterval(this.autoplay);
		this.autoplay = setInterval(this.autoRotateSlides.bind(this), this.autoplaySpeed);
	}

	pause() {
		this.slider.setAttribute('aria-live', 'polite');
		clearInterval(this.autoplay);
	}

	togglePlayButtonState(pauseAutoplay) {
		if (pauseAutoplay) {
			this.sliderAutoplayButton.classList.add('slideshow__autoplay--paused');
			this.sliderAutoplayButton.setAttribute(
				'aria-label',
				window.accessibilityStrings.playSlideshow,
			);
		} else {
			this.sliderAutoplayButton.classList.remove('slideshow__autoplay--paused');
			this.sliderAutoplayButton.setAttribute(
				'aria-label',
				window.accessibilityStrings.pauseSlideshow,
			);
		}
	}

	autoRotateSlides() {
		const slideScrollPosition =
			this.currentPage === this.sliderItems.length
				? 0
				: this.slider.scrollLeft + this.sliderItemOffset;

		this.setSlidePosition(slideScrollPosition);
		this.applyAnimationToAnnouncementBar();
	}

	setSlideVisibility(event) {
		this.sliderItemsToShow.forEach((item, index) => {
			const linkElements = item.querySelectorAll('a');
			if (index === this.currentPage - 1) {
				if (linkElements.length)
					linkElements.forEach((button) => {
						button.removeAttribute('tabindex');
					});
				item.setAttribute('aria-hidden', 'false');
				item.removeAttribute('tabindex');
			} else {
				if (linkElements.length)
					linkElements.forEach((button) => {
						button.setAttribute('tabindex', '-1');
					});
				item.setAttribute('aria-hidden', 'true');
				item.setAttribute('tabindex', '-1');
			}
		});
		this.wasClicked = false;
	}

	applyAnimationToAnnouncementBar(button = 'next') {
		if (!this.announcementBarSlider) return;

		const itemsCount = this.sliderItems.length;
		const increment = button === 'next' ? 1 : -1;

		const currentIndex = this.currentPage - 1;
		let nextIndex = (currentIndex + increment) % itemsCount;
		nextIndex = nextIndex === -1 ? itemsCount - 1 : nextIndex;

		const nextSlide = this.sliderItems[nextIndex];
		const currentSlide = this.sliderItems[currentIndex];

		const animationClassIn = 'announcement-bar-slider--fade-in';
		const animationClassOut = 'announcement-bar-slider--fade-out';

		const isFirstSlide = currentIndex === 0;
		const isLastSlide = currentIndex === itemsCount - 1;

		const shouldMoveNext =
			(button === 'next' && !isLastSlide) || (button === 'previous' && isFirstSlide);
		const direction = shouldMoveNext ? 'next' : 'previous';

		currentSlide.classList.add(`${animationClassOut}-${direction}`);
		nextSlide.classList.add(`${animationClassIn}-${direction}`);

		setTimeout(() => {
			currentSlide.classList.remove(`${animationClassOut}-${direction}`);
			nextSlide.classList.remove(`${animationClassIn}-${direction}`);
		}, this.announcerBarAnimationDelay * 2);
	}

	linkToSlide(event) {
		event.preventDefault();
		const slideScrollPosition =
			this.slider.scrollLeft +
			this.sliderFirstItemNode.clientWidth *
				(this.sliderControlLinksArray.indexOf(event.currentTarget) + 1 - this.currentPage);
		this.slider.scrollTo({
			left: slideScrollPosition,
		});
	}
}

customElements.define('slideshow-component', SlideshowComponent);

class ProductRecommendations extends HTMLElement {
	observer = undefined;

	constructor() {
		super();
	}

	connectedCallback() {
		this.initializeRecommendations(this.dataset.productId);
	}

	disconnectedCallback() {
		this.observer?.disconnect();
	}

	updatedCallback() {
		this.observer?.disconnect();
		this.initializeRecommendations(this.dataset.productId);
	}

	initializeRecommendations(productId) {
		this.observer?.unobserve(this);
		this.observer = new IntersectionObserver(
			(entries, observer) => {
				if (!entries[0].isIntersecting) return;
				observer.unobserve(this);
				this.loadRecommendations(productId);
			},
			{ rootMargin: '0px 0px 400px 0px' },
		);
		this.observer.observe(this);
	}

	loadRecommendations(productId) {
		fetch(`${this.dataset.url}&product_id=${productId}&section_id=${this.dataset.sectionId}`)
			.then((response) => response.text())
			.then((text) => {
				const html = document.createElement('div');
				html.innerHTML = text;
				const recommendations = html.querySelector('product-recommendations');

				if (recommendations?.innerHTML.trim().length) {
					this.innerHTML = recommendations.innerHTML;

					// Réinitialiser CardProduct pour les nouvelles cartes chargées dynamiquement
					window.cardProduct &&
						this.querySelectorAll('.product-card-wrapper').forEach((card) => {
							card.dataset.colorHoverInitialized = 'false';
							window.cardProduct.setupCard(card);
						});

					// Reload Trustpilot widgets pour les cartes chargées dynamiquement
					if (typeof Trustpilot !== 'undefined') {
						this.querySelectorAll('.trustpilot-widget').forEach((el) => {
							Trustpilot.loadFromElement(el, true);
						});
					}
				}

				if (
					!this.querySelector('slideshow-component') &&
					this.classList.contains('complementary-products')
				) {
					this.remove();
				}

				if (html.querySelector('.grid__item')) {
					this.classList.add('product-recommendations--loaded');
				}
			})
			.catch((e) => {
				console.error(e);
			});
	}
}

customElements.define('product-recommendations', ProductRecommendations);

class AccountIcon extends HTMLElement {
	constructor() {
		super();

		this.icon = this.querySelector('.icon');
	}

	connectedCallback() {
		document.addEventListener(
			'storefront:signincompleted',
			this.handleStorefrontSignInCompleted.bind(this),
		);
	}

	handleStorefrontSignInCompleted(event) {
		if (event?.detail?.avatar) {
			this.icon?.replaceWith(event.detail.avatar.cloneNode());
		}
	}
}

customElements.define('account-icon', AccountIcon);

class BulkAdd extends HTMLElement {
	static ASYNC_REQUEST_DELAY = 250;

	constructor() {
		super();
		this.queue = [];
		this.setRequestStarted(false);
		this.ids = [];
	}

	startQueue(id, quantity) {
		this.queue.push({ id, quantity });

		const interval = setInterval(() => {
			if (this.queue.length > 0) {
				if (!this.requestStarted) {
					this.sendRequest(this.queue);
				}
			} else {
				clearInterval(interval);
			}
		}, BulkAdd.ASYNC_REQUEST_DELAY);
	}

	sendRequest(queue) {
		this.setRequestStarted(true);
		const items = {};

		queue.forEach((queueItem) => {
			items[parseInt(queueItem.id)] = queueItem.quantity;
		});
		this.queue = this.queue.filter((queueElement) => !queue.includes(queueElement));

		this.updateMultipleQty(items);
	}

	setRequestStarted(requestStarted) {
		this._requestStarted = requestStarted;
	}

	get requestStarted() {
		return this._requestStarted;
	}

	resetQuantityInput(id) {
		const input = this.querySelector(`#Quantity-${id}`);
		input.value = input.getAttribute('value');
		this.isEnterPressed = false;
	}

	setValidity(event, index, message) {
		event.target.setCustomValidity(message);
		event.target.reportValidity();
		this.resetQuantityInput(index);
		event.target.select();
	}

	validateQuantity(event) {
		const inputValue = parseInt(event.target.value);
		const index = event.target.dataset.index;

		if (inputValue < event.target.dataset.min) {
			this.setValidity(
				event,
				index,
				window.quickOrderListStrings.min_error.replace('[min]', event.target.dataset.min),
			);
		} else if (inputValue > parseInt(event.target.max)) {
			this.setValidity(
				event,
				index,
				window.quickOrderListStrings.max_error.replace('[max]', event.target.max),
			);
		} else if (inputValue % parseInt(event.target.step) != 0) {
			this.setValidity(
				event,
				index,
				window.quickOrderListStrings.step_error.replace('[step]', event.target.step),
			);
		} else {
			event.target.setCustomValidity('');
			event.target.reportValidity();
			event.target.setAttribute('value', inputValue);
			this.startQueue(index, inputValue);
		}
	}

	getSectionInnerHTML(html, selector) {
		return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
	}
}

if (!customElements.get('bulk-add')) {
	customElements.define('bulk-add', BulkAdd);
}

class CartPerformance {
	static #metric_prefix = 'cart-performance';

	static createStartingMarker(benchmarkName) {
		const metricName = `${CartPerformance.#metric_prefix}:${benchmarkName}`;
		return performance.mark(`${metricName}:start`);
	}

	static measureFromEvent(benchmarkName, event) {
		const metricName = `${CartPerformance.#metric_prefix}:${benchmarkName}`;
		const startMarker = performance.mark(`${metricName}:start`, {
			startTime: event.timeStamp,
		});

		const endMarker = performance.mark(`${metricName}:end`);

		performance.measure(benchmarkName, `${metricName}:start`, `${metricName}:end`);
	}

	static measureFromMarker(benchmarkName, startMarker) {
		const metricName = `${CartPerformance.#metric_prefix}:${benchmarkName}`;
		const endMarker = performance.mark(`${metricName}:end`);

		performance.measure(benchmarkName, startMarker.name, `${metricName}:end`);
	}

	static measure(benchmarkName, callback) {
		const metricName = `${CartPerformance.#metric_prefix}:${benchmarkName}`;
		const startMarker = performance.mark(`${metricName}:start`);

		callback();

		const endMarker = performance.mark(`${metricName}:end`);

		performance.measure(benchmarkName, `${metricName}:start`, `${metricName}:end`);
	}
}
