if (!customElements.get('pickup-availability')) {
	customElements.define(
		'pickup-availability',
		class PickupAvailability extends HTMLElement {
			constructor() {
				super();

				if (!this.hasAttribute('available')) return;

				this.errorHtml = this.querySelector('template').content.firstElementChild.cloneNode(true);
				this.onClickRefreshList = this.onClickRefreshList.bind(this);
				this.fetchAvailability(this.dataset.variantId);
			}

			fetchAvailability(variantId) {
				if (!variantId) return;

				let rootUrl = this.dataset.rootUrl;
				if (!rootUrl.endsWith('/')) {
					rootUrl = rootUrl + '/';
				}
				const variantSectionUrl = `${rootUrl}variants/${variantId}/?section_id=pickup-availability`;

				fetch(variantSectionUrl)
					.then((response) => response.text())
					.then((text) => {
						const sectionInnerHTML = new DOMParser()
							.parseFromString(text, 'text/html')
							.querySelector('.shopify-section');
						this.renderPreview(sectionInnerHTML);
					})
					.catch((e) => {
						const button = this.querySelector('button');
						if (button) button.removeEventListener('click', this.onClickRefreshList);
						this.renderError();
					});
			}

			onClickRefreshList() {
				this.fetchAvailability(this.dataset.variantId);
			}

			update(variant) {
				if (variant?.available) {
					this.fetchAvailability(variant.id);
				} else {
					this.removeAttribute('available');
					this.innerHTML = '';
				}
			}

			renderError() {
				this.innerHTML = '';
				this.appendChild(this.errorHtml);

				this.querySelector('button').addEventListener('click', this.onClickRefreshList);
			}

			renderPreview(sectionInnerHTML) {
				const drawer = document.querySelector('pickup-availability-drawer');
				if (drawer) drawer.remove();
				if (!sectionInnerHTML.querySelector('pickup-availability-preview')) {
					this.innerHTML = '';
					this.removeAttribute('available');
					return;
				}

				this.innerHTML = sectionInnerHTML.querySelector('pickup-availability-preview').outerHTML;
				this.setAttribute('available', '');

				document.body.appendChild(sectionInnerHTML.querySelector('pickup-availability-drawer'));
				const colorClassesToApply = this.dataset.productPageColorScheme.split(' ');
				colorClassesToApply.forEach((colorClass) => {
					document.querySelector('pickup-availability-drawer').classList.add(colorClass);
				});

				const button = this.querySelector('button');
				if (button)
					button.addEventListener('click', (evt) => {
						evt.preventDefault();
						document.querySelector('pickup-availability-drawer').show(evt.target);
					});
			}
		},
	);
}

if (!customElements.get('pickup-availability-drawer')) {
	customElements.define(
		'pickup-availability-drawer',
		class PickupAvailabilityDrawer extends HTMLElement {
			constructor() {
				super();

				this.onBodyClick = this.handleBodyClick.bind(this);

				this.querySelector('button').addEventListener('click', () => {
					this.hide();
				});

				this.addEventListener('keyup', (event) => {
					if (event.code.toUpperCase() === 'ESCAPE') this.hide();
				});
			}

			handleBodyClick(evt) {
				const target = evt.target;
				if (
					target != this &&
					!target.closest('pickup-availability-drawer') &&
					target.id != 'ShowPickupAvailabilityDrawer'
				) {
					this.hide();
				}
			}

			hide() {
				this.removeAttribute('open');
				document.body.removeEventListener('click', this.onBodyClick);
				document.body.classList.remove('overflow-hidden');

				// Restaurer la position de scroll sur iOS
				const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
				if (isIOS && this.savedScrollPosition !== undefined) {
					// Restaurer le style du body
					document.body.style.position = '';
					document.body.style.top = '';
					document.body.style.width = '';
					// Restaurer la position de scroll
					window.scrollTo(0, this.savedScrollPosition);
					this.savedScrollPosition = undefined;
				}

				removeTrapFocus(this.focusElement);
			}

			show(focusElement) {
				this.focusElement = focusElement;

				// Prévenir le scroll sur iOS
				const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
				if (isIOS) {
					// Sauvegarder la position de scroll avant d'ouvrir la modal
					this.savedScrollPosition = window.pageYOffset;
					// Fixer la position du body pour éviter le scroll
					document.body.style.position = 'fixed';
					document.body.style.top = `-${this.savedScrollPosition}px`;
					document.body.style.width = '100%';
				}

				this.setAttribute('open', '');
				document.body.addEventListener('click', this.onBodyClick);
				document.body.classList.add('overflow-hidden');
				trapFocus(this);
			}
		},
	);
}
