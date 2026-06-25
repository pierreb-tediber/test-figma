// Fonction utilitaire pour faire un focus sans scroll automatique sur iOS
function focusWithoutScroll(element) {
	if (!element) return;

	const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
	if (isIOS) {
		// Sauvegarder la position de scroll actuelle
		const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
		const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

		element.focus();

		// Restaurer la position de scroll si elle a changé
		if (window.pageYOffset !== scrollTop || window.pageXOffset !== scrollLeft) {
			window.scrollTo(scrollLeft, scrollTop);
		}
	} else {
		element.focus();
	}
}

class CartNotification extends HTMLElement {
	constructor() {
		super();

		this.notification = document.getElementById('cart-notification');
		this.header = document.querySelector('sticky-header');
		this.onBodyClick = this.handleBodyClick.bind(this);

		this.notification.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
		this.querySelectorAll('button[type="button"]').forEach((closeButton) =>
			closeButton.addEventListener('click', this.close.bind(this)),
		);
	}

	open() {
		this.notification.classList.add('animate', 'active');

		this.notification.addEventListener(
			'transitionend',
			() => {
				focusWithoutScroll(this.notification);
				trapFocus(this.notification);
			},
			{ once: true },
		);

		document.body.addEventListener('click', this.onBodyClick);
	}

	close() {
		this.notification.classList.remove('active');
		document.body.removeEventListener('click', this.onBodyClick);

		removeTrapFocus(this.activeElement);
	}

	renderContents(parsedState) {
		this.cartItemKey = parsedState.key;
		this.getSectionsToRender().forEach((section) => {
			document.getElementById(section.id).innerHTML = this.getSectionInnerHTML(
				parsedState.sections[section.id],
				section.selector,
			);
		});

		if (this.header) this.header.reveal();
		this.open();
	}

	getSectionsToRender() {
		return [
			{
				id: 'cart-notification-product',
				selector: `[id="cart-notification-product-${this.cartItemKey}"]`,
			},
			{
				id: 'cart-notification-button',
			},
			{
				id: 'cart-icon-bubble',
			},
		];
	}

	getSectionInnerHTML(html, selector = '.shopify-section') {
		return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
	}

	handleBodyClick(evt) {
		const target = evt.target;
		if (target !== this.notification && !target.closest('cart-notification')) {
			const disclosure = target.closest('details-disclosure, header-menu');
			this.activeElement = disclosure ? disclosure.querySelector('summary') : null;
			this.close();
		}
	}

	setActiveElement(element) {
		this.activeElement = element;
	}
}

customElements.define('cart-notification', CartNotification);
