class DetailsDisclosure extends HTMLElement {
	constructor() {
		super();
		this.mainDetailsToggle = this.querySelector('details');
		this.content = this.mainDetailsToggle.querySelector('summary').nextElementSibling;

		this.mainDetailsToggle.addEventListener('focusout', this.onFocusOut.bind(this));
		this.mainDetailsToggle.addEventListener('toggle', this.onToggle.bind(this));
	}

	onFocusOut() {
		setTimeout(() => {
			if (!this.contains(document.activeElement)) this.close();
		});
	}

	onToggle() {
		if (!this.animations) this.animations = this.content.getAnimations();

		if (this.mainDetailsToggle.hasAttribute('open')) {
			this.animations.forEach((animation) => animation.play());
		} else {
			this.animations.forEach((animation) => animation.cancel());
		}
	}

	close() {
		this.mainDetailsToggle.removeAttribute('open');
		this.mainDetailsToggle.querySelector('summary').setAttribute('aria-expanded', false);
	}
}

customElements.define('details-disclosure', DetailsDisclosure);

class HeaderMenu extends DetailsDisclosure {
	static hasMenuContentFetched = false;
	static hasMenuContentFetchedLoading = false;

	constructor() {
		super();
		this.bindEvents();

		this.sectionId = this.closest('header-menu')?.dataset.sectionId;
	}

	bindEvents() {
		this.header = document.querySelector('.header-wrapper');
		this.itemMenu = document.querySelectorAll('.header-wrapper a.header__menu-item');
		this.mainDetailsToggle.addEventListener('mouseenter', this.onMouseEnter.bind(this));
		this.mainDetailsToggle
			.closest('.section-header')
			.addEventListener('mouseleave', this.onMouseLeave.bind(this));

		for (const item of this.itemMenu) {
			item.addEventListener('mouseenter', this.onRemoveActive.bind(this));
		}
	}

	async fetchMenuContent() {
		HeaderMenu.hasMenuContentFetchedLoading = true;
		const loadingSpinners = this.header.querySelectorAll('.loading__spinner');
		loadingSpinners.forEach((spinner) => spinner.classList.remove('hidden'));

		let url = `${window.location.pathname}?section_id=${this.sectionId}`;
		if (window.routes.template_name === '404') {
			url = `/?section_id=${this.sectionId}`;
		}

		try {
			const response = await fetch(url);
			const html = await response.text();

			const doc = new DOMParser().parseFromString(html, 'text/html');
			const newMegaMenus = doc.querySelectorAll('.mega-menu__content');

			this.header.querySelectorAll('.mega-menu__content').forEach((container, index) => {
				if (newMegaMenus[index]) {
					container.innerHTML = newMegaMenus[index].innerHTML;
				}
			});

			// Reload Trustpilot widgets pour les cartes chargées dynamiquement
			if (typeof Trustpilot !== 'undefined') {
				this.header.querySelectorAll('.trustpilot-widget').forEach((el) => {
					Trustpilot.loadFromElement(el, true);
				});
			}

			HeaderMenu.hasMenuContentFetched = true;
			this.bindEvents();
		} catch (error) {
			console.error('Error loading mega menu content:', error);
			this.header.querySelectorAll('.mega-menu__content').forEach((container) => {
				container.innerHTML = '<p>Error loading menu content</p>';
			});
		} finally {
			HeaderMenu.hasMenuContentFetchedLoading = false;
			loadingSpinners.forEach((spinner) => spinner.classList.add('hidden'));
		}
	}

	onToggle() {
		if (!this.header) return;

		this.header.preventHide = this.mainDetailsToggle.open;

		const elements = {
			header: this.header,
			sectionHeader: document.querySelector('.section-header'),
			body: document.body,
		};

		const toggleClasses = (isOpen) => {
			elements.header.classList.toggle('transparent-menu-open', isOpen);
			elements.sectionHeader.classList.toggle('menu-open', isOpen);
			elements.body.classList.toggle('has-overlay', isOpen);
		};

		toggleClasses(this.header.preventHide);

		if (document.documentElement.style.getPropertyValue('--header-bottom-position-desktop') !== '')
			return;
		document.documentElement.style.setProperty(
			'--header-bottom-position-desktop',
			`${Math.floor(this.header.getBoundingClientRect().bottom)}px`,
		);
	}

	onRemoveActive() {
		for (const itemMegaMenu of this.header.querySelectorAll('details')) {
			itemMegaMenu.removeAttribute('open');
			itemMegaMenu.querySelector('summary').setAttribute('aria-expanded', false);
		}
	}

	async onMouseEnter() {
		if (this.mainDetailsToggle.hasAttribute('open')) return;
		for (const itemMegaMenu of this.header.querySelectorAll('details')) {
			itemMegaMenu.removeAttribute('open');
			itemMegaMenu.querySelector('summary').setAttribute('aria-expanded', false);
		}
		this.mainDetailsToggle.setAttribute('open', '');
		this.mainDetailsToggle.querySelector('summary').setAttribute('aria-expanded', 'true');

		if (this.sectionId && !HeaderMenu.hasMenuContentFetched && !HeaderMenu.hasMenuContentFetchedLoading) {
			await this.fetchMenuContent();
		}
	}

	onMouseLeave() {
		setTimeout(() => {
			if (!this.contains(document.activeElement)) this.close();
		});
	}

	close() {
		this.mainDetailsToggle.removeAttribute('open');
		this.mainDetailsToggle.querySelector('summary').setAttribute('aria-expanded', false);
	}
}

customElements.define('header-menu', HeaderMenu);
