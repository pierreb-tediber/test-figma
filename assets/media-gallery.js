if (!customElements.get('media-gallery')) {
	customElements.define(
		'media-gallery',
		class MediaGallery extends HTMLElement {
			constructor() {
				super();
				// Stocker les références des handlers pour pouvoir les retirer
				this.boundHandlers = {
					onSlideChanged: null,
					thumbnailClickHandlers: new Map(),
					showMoreButtonHandler: null,
					visibilityChangeHandler: null,
				};
				// Observer pour l'auto-play des vidéos au scroll
				this.videoObserver = null;
				// Map pour stocker les vidéos actives
				this.activeVideos = new Map();
			}

			connectedCallback() {
				this.initMediaGallery();
			}

			initMediaGallery() {
				this.elements = {
					liveRegion: this.querySelector('[id^="GalleryStatus"]'),
					viewer: this.querySelector('[id^="GalleryViewer"]'),
					thumbnails: this.querySelector('[id^="GalleryThumbnails"]'),
					showMoreButton: this.querySelector('[id^="ShowMoreMedia"]'),
					badgesContainer: this.querySelector('[id^="ProductMediaBadges"]'),
				};
				this.mql = window.matchMedia('(min-width: 750px)');

				// Créer les handlers avec bind une seule fois
				this.boundHandlers.onSlideChanged = debounce(this.onSlideChanged.bind(this), 500);

				if (this.elements.viewer) {
					this.elements.viewer.addEventListener('slideChanged', this.boundHandlers.onSlideChanged);
				}

				// Stocker les handlers pour chaque thumbnail (si thumbnails existe)
				if (this.elements.thumbnails) {
					this.elements.thumbnails.querySelectorAll('[data-target]').forEach((mediaToSwitch) => {
						const handler = this.setActiveMedia.bind(this, mediaToSwitch.dataset.target, false);
						this.boundHandlers.thumbnailClickHandlers.set(mediaToSwitch, handler);

						mediaToSwitch.querySelector('button').addEventListener('click', handler);
					});
				}

				// Initialiser le bouton "Show more/less" pour le layout stacked
				if (this.elements.showMoreButton) {
					this.boundHandlers.showMoreButtonHandler = this.toggleShowMoreMedia.bind(this);
					this.elements.showMoreButton.addEventListener(
						'click',
						this.boundHandlers.showMoreButtonHandler,
					);
					// Initialiser l'état du bouton
					this.elements.showMoreButton.setAttribute('data-state', 'collapsed');
				}

				if (this.dataset.desktopLayout.includes('thumbnail') && this.mql.matches)
					this.removeListSemantic();

				// Initialiser les badges sur la première image visible au chargement
				if (this.elements.badgesContainer && this.elements.viewer) {
					const firstVisibleMedia =
						this.elements.viewer.querySelector(
							'.product__media-item:not(.product__media-item--hidden).is-active',
						) ||
						this.elements.viewer.querySelector(
							'.product__media-item:not(.product__media-item--hidden)',
						);
					if (firstVisibleMedia) {
						this.moveBadgesToFirstVisibleMedia(firstVisibleMedia);
					}
				}

				// Initialiser l'auto-play des vidéos au scroll pour template new-offer sur desktop
				if (this.dataset.templateNewOffer === 'true') {
					if (this.mql.matches) {
						// Desktop : Intersection Observer pour auto-play au scroll
						this.initVideoAutoPlay();
					}
					// Desktop et mobile : gestion du changement d'onglet
					this.initVideoVisibilityHandler();
				}
			}

			disconnectedCallback() {
				this.removeEvents();
				this.cleanupVideoObserver();
			}

			removeEvents() {
				// Retirer l'event listener du viewer
				if (this.elements?.viewer && this.boundHandlers.onSlideChanged) {
					this.elements.viewer.removeEventListener(
						'slideChanged',
						this.boundHandlers.onSlideChanged,
					);
				}

				// Retirer tous les event listeners des thumbnails
				if (this.elements?.thumbnails && this.boundHandlers.thumbnailClickHandlers.size > 0) {
					this.boundHandlers.thumbnailClickHandlers.forEach((handler, mediaToSwitch) => {
						const button = mediaToSwitch.querySelector('button');
						if (button) {
							button.removeEventListener('click', handler);
						}
					});
					// Nettoyer la Map
					this.boundHandlers.thumbnailClickHandlers.clear();
				}

				// Retirer l'event listener du bouton "Show more"
				if (this.elements?.showMoreButton && this.boundHandlers.showMoreButtonHandler) {
					this.elements.showMoreButton.removeEventListener(
						'click',
						this.boundHandlers.showMoreButtonHandler,
					);
					this.boundHandlers.showMoreButtonHandler = null;
				}

				// Réinitialiser les handlers
				this.boundHandlers.onSlideChanged = null;
				if (this.boundHandlers.visibilityChangeHandler) {
					document.removeEventListener(
						'visibilitychange',
						this.boundHandlers.visibilityChangeHandler,
					);
					this.boundHandlers.visibilityChangeHandler = null;
				}
			}

			cleanupVideoObserver() {
				if (this.videoObserver) {
					this.videoObserver.disconnect();
					this.videoObserver = null;
				}
				// Mettre en pause toutes les vidéos actives et réafficher les previews
				this.activeVideos.forEach((video, deferredMedia) => {
					if (video && video.tagName === 'VIDEO' && !video.paused) {
						video.pause();
					}
					// Réafficher l'image preview
					this.showVideoPreview(deferredMedia);
				});
				this.activeVideos.clear();
			}

			updatedCallback() {
				this.removeEvents();
				this.initMediaGallery();
			}

			onSlideChanged(event) {
				// Vérifier que currentElement existe avant d'accéder à ses propriétés
				if (!event.detail?.currentElement || !this.elements.thumbnails) return;

				const mediaId = event.detail.currentElement.dataset?.mediaId;
				if (!mediaId) return;

				const thumbnail = this.elements.thumbnails.querySelector(`[data-target="${mediaId}"]`);
				this.setActiveThumbnail(thumbnail);

				// Gérer l'auto-play des vidéos lors du changement de slide
				// Desktop : avec Intersection Observer au scroll
				// Mobile : directement lors du swipe
				if (this.dataset.templateNewOffer === 'true') {
					this.handleVideoOnSlideChange(event.detail.currentElement);
				}
			}

			/**
			 * Gère l'auto-play des vidéos lors du changement de slide
			 * @param {HTMLElement} activeMediaElement - L'élément média actif
			 * @private
			 */
			handleVideoOnSlideChange(activeMediaElement) {
				if (!activeMediaElement) return;

				const isDesktop = this.mql.matches;

				// Mettre en pause toutes les vidéos actives sauf celle du slide actif
				this.activeVideos.forEach((video, deferredMedia) => {
					const mediaItem = deferredMedia.closest('.product__media-item');
					if (mediaItem !== activeMediaElement) {
						this.pauseVideo(deferredMedia);
						// Réafficher l'image preview pour les vidéos qui ne sont plus actives
						this.showVideoPreview(deferredMedia);
					}
				});

				// Vérifier si le slide actif contient une vidéo
				const deferredMedia = activeMediaElement.querySelector(
					'deferred-media[data-media-type="video"], deferred-media[data-media-type="external_video"]',
				);

				if (deferredMedia) {
					if (isDesktop) {
						// Sur desktop : vérifier si la vidéo est suffisamment visible dans le viewport
						const rect = deferredMedia.getBoundingClientRect();
						const viewportHeight = window.innerHeight;
						const viewportWidth = window.innerWidth;
						const isVisible =
							rect.top < viewportHeight &&
							rect.bottom > 0 &&
							rect.left < viewportWidth &&
							rect.right > 0 &&
							rect.height > 0 &&
							rect.width > 0;

						if (isVisible) {
							// Vérifier que la vidéo est suffisamment visible (au moins 50%)
							const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
							const visibleWidth = Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0);
							const visibleArea = visibleHeight * visibleWidth;
							const totalArea = rect.height * rect.width;
							const visibilityRatio = visibleArea / totalArea;

							if (visibilityRatio >= 0.5) {
								this.playVideo(deferredMedia);
							}
						}
					} else {
						// Sur mobile : lancer directement la vidéo lors du swipe
						this.playVideo(deferredMedia);
					}
				}
			}

			setActiveMedia(mediaId, prepend) {
				const activeMedia =
					this.elements.viewer.querySelector(`[data-media-id="${mediaId}"]`) ||
					this.elements.viewer.querySelector('[data-media-id]');
				if (!activeMedia) {
					return;
				}

				// Convertir lazy-src en src pour l'image qui va devenir active
				this.removeLazyLoad(activeMedia);

				this.elements.viewer.querySelectorAll('[data-media-id]').forEach((element) => {
					element.classList.remove('is-active');
				});
				activeMedia?.classList?.add('is-active');

				if (prepend) {
					activeMedia.parentElement.firstChild !== activeMedia &&
						activeMedia.parentElement.prepend(activeMedia);

					if (this.elements.thumbnails) {
						const activeThumbnail = this.elements.thumbnails.querySelector(
							`[data-target="${mediaId}"]`,
						);
						activeThumbnail?.parentElement?.firstChild !== activeThumbnail &&
							activeThumbnail?.parentElement?.prepend(activeThumbnail);
					}

					if (this.elements.viewer.slider) this.elements.viewer.resetPages();
				}

				this.preventStickyHeader();
				window.setTimeout(() => {
					if (!this.mql.matches || this.elements.thumbnails) {
						activeMedia.parentElement.scrollTo({ left: activeMedia.offsetLeft });
					}
				});
				this.playActiveMedia(activeMedia);

				// Gérer l'auto-play des vidéos lors du changement de média actif (swipe mobile)
				if (this.dataset.templateNewOffer === 'true') {
					this.handleVideoOnSlideChange(activeMedia);
				}

				if (!this.elements.thumbnails) return;
				const activeThumbnail = this.elements.thumbnails.querySelector(
					`[data-target="${mediaId}"]`,
				);

				if (activeThumbnail) {
					this.setActiveThumbnail(activeThumbnail);
					this.announceLiveRegion(activeMedia, activeThumbnail.dataset.mediaPosition);
				}
			}

			setActiveThumbnail(thumbnail) {
				if (!this.elements.thumbnails || !thumbnail) return;

				// Convertir lazy-src en src pour le thumbnail actif
				this.removeLazyLoad(thumbnail);

				this.elements.thumbnails
					.querySelectorAll('button')
					.forEach((element) => element.removeAttribute('aria-current'));
				thumbnail.querySelector('button').setAttribute('aria-current', true);
				if (this.elements.thumbnails.isSlideVisible(thumbnail, 10)) return;

				this.elements.thumbnails.slider.scrollTo({ left: thumbnail.offsetLeft });
			}

			/**
			 * Retire le lazy loading d'un élément et charge l'image
			 * @param {HTMLElement} element - L'élément contenant l'image
			 */
			removeLazyLoad(element) {
				if (!element) return;

				// Gérer le cas où element est lui-même un img avec lazy-src
				let images = element.querySelectorAll('img[lazy-src]');
				if (images.length === 0 && element.tagName === 'IMG' && element.hasAttribute('lazy-src')) {
					images = [element];
				}
				if (images.length === 0) return;

				images.forEach((img) => {
					const lazySrc = img.getAttribute('lazy-src');
					const lazySrcset = img.getAttribute('lazy-srcset');

					if (!lazySrc) return;

					// Récupérer les containers parents
					const mediaItem = img.closest('.product__media-item');
					const thumbnailItem = img.closest('.thumbnail-list__item');
					const container = mediaItem || thumbnailItem;

					// Si l'image n'a pas de src, ajouter la classe de chargement au container
					const isFirstLoad = !img.hasAttribute('src') || img.getAttribute('src') === '';

					if (isFirstLoad && container) {
						container.classList.add('has-loading-image');
					}

					img.setAttribute('src', lazySrc);
					img.removeAttribute('lazy-src');

					if (lazySrcset) {
						img.setAttribute('srcset', lazySrcset);
						img.removeAttribute('lazy-srcset');
					}

					// Animation de fade-in sur le container
					if (container) {
						container.classList.add('media-loaded');

						// Retirer les classes après l'animation
						setTimeout(() => {
							container.classList.remove('has-loading-image', 'media-loaded');
						}, 400);
					}
				});
			}

			/**
			 * Met à jour l'affichage des médias selon les options de la variante
			 * @param {Object} variant - La variante sélectionnée
			 * @param {Object} variantOptionString - La chaîne d'options de la variante
			 * @public
			 */
			updateMediaByVariantOptions(variant, variantOptionString = null) {
				if (variantOptionString) {
					this.filterMediaByOptions(variantOptionString, variant);
					return;
				}

				if (!variant || !variant.options) return;

				// Construire la chaîne d'options selon la logique liquid
				const variantOptionStringBuild = this.buildVariantOptionString(variant);
				if (!variantOptionStringBuild) return;

				// Mettre à jour l'affichage des médias
				this.filterMediaByOptions(variantOptionStringBuild, variant);
			}

			/**
			 * Construit la chaîne d'options de la variante selon la logique liquid
			 * @param {Object} variant - La variante sélectionnée
			 * @returns {string} La chaîne d'options construite
			 * @private
			 */
			buildVariantOptionString(variant) {
				// Récupérer les données depuis les attributs data
				const sizeOptionPositionArray = parseInt(this.dataset.optionPositionSizeArray);
				const footOptionPositionArray = parseInt(this.dataset.optionPositionFootArray);

				let variantOptionString = '';

				variant.options.forEach((option, index) => {
					let optionValue = option;

					// Si c'est l'option de taille, vérifier les exceptions puis extraire la partie après le tiret
					if (!isNaN(sizeOptionPositionArray) && index === sizeOptionPositionArray) {
						let hasValueExcept = false;

						// Vérifier si cette option est dans les exceptions (seulement si elle contient un tiret)
						if (window.accessibilityStrings?.optionsNamesForSizeValueExcept) {
							const optionNameArray = optionValue.toLowerCase().split(' ');
							const exceptionsArray = window.accessibilityStrings.optionsNamesForSizeValueExcept
								.toLowerCase()
								.split(',');

							for (const optionName of optionNameArray) {
								if (exceptionsArray.includes(optionName.trim())) {
									hasValueExcept = true;
									break;
								}
							}
						}

						let hasValueExceptStrict = false;
						if (window.accessibilityStrings?.optionsNamesForSizeValueStrictExcept) {
							const exceptionsArray =
								window.accessibilityStrings.optionsNamesForSizeValueStrictExcept
									.toLowerCase()
									.split(',');

							if (exceptionsArray.includes(optionValue)) {
								hasValueExceptStrict = true;
							}
						}

						// Si ce n'est pas une exception, extraire la partie après le tiret
						if (!hasValueExcept && !hasValueExceptStrict) {
							const optionParts = optionValue.split('-');
							if (optionParts.length > 1) {
								optionValue = optionParts[1].trim();
							} else {
								optionValue = '';
							}

							// Skip le format par défaut ("Monobloc") — côté admin les alt
							// média sont saisis sans ce segment car implicite. Sans ce
							// strip, le rebuild JS après changement de variante inclut
							// "Monobloc" → mismatch avec mediaAlt → aucune image visible.
							const defaultFormat =
								window.accessibilityStrings?.defaultFormatForSizeValue?.toLowerCase();
							if (defaultFormat && optionValue.toLowerCase() === defaultFormat) {
								optionValue = '';
							}
						}
					}
					// Si c'est l'option de pied, vérifier les exceptions puis extraire la partie après le tiret
					else if (!isNaN(footOptionPositionArray) && index === footOptionPositionArray) {
						let hasValueExcept = false;

						// Vérifier si cette option est dans les exceptions pour les pieds
						if (window.accessibilityStrings?.optionsNamesForFootValueExcept) {
							const optionNameArray = optionValue.toLowerCase().split(' ');
							const exceptionsArray = window.accessibilityStrings.optionsNamesForFootValueExcept
								.toLowerCase()
								.split(',');

							for (const optionName of optionNameArray) {
								if (exceptionsArray.includes(optionName.trim())) {
									hasValueExcept = true;
									break;
								}
							}
						}

						// Si ce n'est pas une exception, extraire la partie après le tiret
						if (!hasValueExcept) {
							const optionParts = optionValue.split('-');
							if (optionParts.length > 1) {
								optionValue = optionParts[1].trim();
							} else {
								optionValue = '';
							}
						}
					}

					// Ignorer les valeurs vides ou "Default Title"
					if (!optionValue || optionValue === 'Default Title') {
						return;
					}

					// Construire la chaîne avec des |
					if (variantOptionString === '') {
						variantOptionString = optionValue;
					} else {
						variantOptionString += '|' + optionValue;
					}
				});

				return variantOptionString;
			}

			/**
			 * Filtre l'affichage des médias selon les options
			 * @param {string} variantOptionString - La chaîne d'options de la variante
			 * @param {Object} variant - La variante sélectionnée (optionnel)
			 * @private
			 */
			filterMediaByOptions(variantOptionString, variant = null) {
				// Toujours sauvegarder la variantOptionString pour filterModalItems (appelé après fetch lazy de la modal)
				this.dataset.variantOptions = variantOptionString;

				// Récupérer tous les éléments média
				const mediaItems = this.querySelectorAll('.product__media-item[data-media-alt]');
				const thumbnailItems = this.querySelectorAll('.thumbnail-list__item[data-media-alt]');

				let hasVisibleMedia = false;
				let firstVisibleMedia = null;
				let featuredMediaId = variant?.featured_media?.id
					? `${this.id.split('-')[1]}-${variant.featured_media.id}`
					: null;

				// Filtrer les médias principaux
				mediaItems.forEach((mediaItem) => {
					const mediaAlt = mediaItem.dataset.mediaAlt;
					const hasAltCustom = mediaItem.dataset.hasAltCustom;
					const isFeaturedMedia = featuredMediaId && mediaItem.dataset.mediaId === featuredMediaId;

					// D'abord traiter les images avec alt custom
					if (hasAltCustom) {
						// L'image featured est toujours visible, sinon vérifier l'alt
						const isVisible =
							isFeaturedMedia || this.shouldShowMedia(mediaAlt, variantOptionString);

						// Ajouter/retirer les classes de visibilité
						if (isVisible) {
							mediaItem.classList.add('is-active');
							mediaItem.classList.remove('product__media-item--hidden');
							if (!firstVisibleMedia || isFeaturedMedia) {
								firstVisibleMedia = mediaItem;
							}
							hasVisibleMedia = true;
						} else {
							mediaItem.classList.remove('is-active');
							mediaItem.classList.add('product__media-item--hidden');
						}
					} else {
						// Pour les images sans alt custom, les cacher par défaut mais garder disponibles
						mediaItem.classList.remove('is-active');
						mediaItem.classList.remove('product__media-item--hidden');
					}
				});

				// Si aucune image avec alt custom n'est visible, activer la première image disponible
				if (!hasVisibleMedia) {
					// D'abord essayer de trouver une image sans alt custom
					let firstGeneralMedia = Array.from(mediaItems).find((item) => !item.dataset.hasAltCustom);

					// Si pas d'image sans alt custom, prendre la première image disponible
					if (!firstGeneralMedia && mediaItems.length > 0) {
						firstGeneralMedia = mediaItems[0];
					}

					if (firstGeneralMedia) {
						firstGeneralMedia.classList.add('is-active');
						firstGeneralMedia.classList.remove('product__media-item--hidden');
						firstVisibleMedia = firstGeneralMedia;
						hasVisibleMedia = true;
					}
				}

				// Filtrer les thumbnails
				let hasVisibleThumbnails = false;
				thumbnailItems.forEach((thumbnailItem) => {
					const thumbnailAlt = thumbnailItem.dataset.mediaAlt;
					const hasAltCustom = thumbnailItem.dataset.hasAltCustom;
					const thumbnailTarget = thumbnailItem.dataset.target;
					const isFeaturedThumbnail = featuredMediaId && thumbnailTarget === featuredMediaId;

					// Traiter les thumbnails avec alt custom
					if (hasAltCustom) {
						// Le thumbnail featured est toujours visible, sinon vérifier l'alt
						const isVisible =
							isFeaturedThumbnail || this.shouldShowMedia(thumbnailAlt, variantOptionString);

						// Ajouter/retirer les classes de visibilité
						if (isVisible) {
							thumbnailItem.classList.remove('thumbnail-list__item--hidden');
							hasVisibleThumbnails = true;
						} else {
							thumbnailItem.classList.add('thumbnail-list__item--hidden');
						}
					} else {
						// Pour les thumbnails sans alt custom, les cacher par défaut mais garder disponibles
						thumbnailItem.classList.remove('thumbnail-list__item--hidden');
					}

					// Retirer aria-current de tous les thumbnails
					const thumbnailButton = thumbnailItem.querySelector('button');
					if (thumbnailButton) {
						thumbnailButton.removeAttribute('aria-current');
					}
				});

				// Si aucun thumbnail avec alt custom n'est visible, s'assurer que les thumbnails sont visibles
				if (!hasVisibleThumbnails) {
					// D'abord essayer de rendre visibles les thumbnails sans alt custom
					let hasGeneralThumbnails = false;
					thumbnailItems.forEach((thumbnailItem) => {
						if (!thumbnailItem.dataset.hasAltCustom) {
							thumbnailItem.classList.remove('thumbnail-list__item--hidden');
							hasGeneralThumbnails = true;
						}
					});

					// Si pas de thumbnail sans alt custom, rendre visible au moins le premier thumbnail
					if (!hasGeneralThumbnails && thumbnailItems.length > 0) {
						thumbnailItems[0].classList.remove('thumbnail-list__item--hidden');
					}
				}

				// Convertir lazy-src en src pour toutes les images visibles
				const visibleMediaItems = this.querySelectorAll(
					'.product__media-item:not(.product__media-item--hidden)',
				);
				visibleMediaItems.forEach((item) => this.removeLazyLoad(item));

				// Convertir lazy-src en src pour tous les thumbnails visibles
				const visibleThumbnails = this.querySelectorAll(
					'.thumbnail-list__item:not(.thumbnail-list__item--hidden)',
				);
				visibleThumbnails.forEach((item) => this.removeLazyLoad(item));

				// Gérer le système stacked : cacher les médias au-delà de la 7ème si layout stacked
				const isStackedLayout = this.dataset.desktopLayout === 'stacked';
				if (isStackedLayout) {
					// Compter tous les médias visibles (images, vidéos, modèles 3D, etc.)
					const visibleMediaItems = Array.from(mediaItems).filter(
						(item) => !item.classList.contains('product__media-item--hidden'),
					);
					let visibleCount = 0;

					visibleMediaItems.forEach((item) => {
						visibleCount++;
						// Retirer d'abord la classe hidden-stacked pour réinitialiser
						item.classList.remove('product__media-item--hidden-stacked');
						// Si plus de 7 médias visibles, cacher ceux au-delà
						if (visibleCount > 7) {
							item.classList.add('product__media-item--hidden-stacked');
						}
					});

					// Afficher ou cacher le bouton selon le nombre de médias visibles
					if (this.elements.showMoreButton) {
						const wrapper = this.elements.showMoreButton.closest(
							'.product__media-show-more-wrapper',
						);
						if (visibleCount > 7 && wrapper) {
							wrapper.style.display = '';
							// Réinitialiser l'état du bouton à "collapsed" lors du filtrage
							const moreLabel = this.elements.showMoreButton.dataset.moreLabel;
							if (moreLabel) {
								this.elements.showMoreButton.textContent = moreLabel;
								this.elements.showMoreButton.setAttribute('aria-label', moreLabel);
								this.elements.showMoreButton.setAttribute('data-state', 'collapsed');
							}
						} else if (wrapper) {
							wrapper.style.display = 'none';
						}
					}
				}

				// Activer le premier média visible (priorité à la featured media)
				if (firstVisibleMedia) {
					const mediaId = firstVisibleMedia.dataset.mediaId;
					// Utiliser setActiveMedia pour activer le premier média visible
					this.setActiveMedia(mediaId, false);

					// Mettre à jour l'attribut data-first-visible-media-shown avec l'URL de la première image visible
					this.updateFirstVisibleMediaUrl(firstVisibleMedia);

					// Déplacer les badges vers la première image visible
					this.moveBadgesToFirstVisibleMedia(firstVisibleMedia);

					// Réinitialiser l'observer vidéo après le filtrage pour prendre en compte les nouveaux médias visibles
					if (this.dataset.templateNewOffer === 'true' && this.mql.matches) {
						this.cleanupVideoObserver();
						setTimeout(() => {
							this.initVideoAutoPlay();
						}, 100);
					}
				}

				// Filtrer les médias modaux (appelé aussi par product-modal après le fetch)
				this.filterModalItems();
			}

			/**
			 * Filtre les médias modaux selon les options de variante
			 * Appelé depuis filterMediaByOptions ET depuis product-modal après le fetch lazy
			 * @public
			 */
			filterModalItems() {
				const variantOptionString = this.dataset.variantOptions;
				if (!variantOptionString) return;

				const modalItems = document.querySelectorAll(
					'.product-media-modal__content--item[data-media-alt]',
				);

				if (modalItems.length === 0) return;

				let featuredMediaId = null;
				// Récupérer le featuredMediaId depuis le premier média actif de la galerie
				const activeMedia = this.querySelector('.product__media-item.is-active');
				if (activeMedia) {
					featuredMediaId = activeMedia.dataset.mediaId;
				}

				let hasVisibleModal = false;
				modalItems.forEach((modalItem) => {
					const modalAlt = modalItem.dataset.mediaAlt;
					const modalTarget = modalItem.dataset.target;
					const isFeaturedModal = featuredMediaId && modalTarget === featuredMediaId;
					const hasAltCustom = modalItem.dataset.hasAltCustom;

					if (hasAltCustom) {
						const isVisible =
							isFeaturedModal || this.shouldShowMedia(modalAlt, variantOptionString);

						if (isVisible) {
							modalItem.classList.remove('product-media-modal__content--item--hidden');
							hasVisibleModal = true;
						} else {
							modalItem.classList.add('product-media-modal__content--item--hidden');
						}
					} else {
						modalItem.classList.remove('product-media-modal__content--item--hidden');
					}
				});

				if (!hasVisibleModal) {
					let hasGeneralModals = false;
					modalItems.forEach((modalItem) => {
						if (!modalItem.dataset.hasAltCustom) {
							modalItem.classList.remove('product-media-modal__content--item--hidden');
							hasGeneralModals = true;
						}
					});

					if (!hasGeneralModals && modalItems.length > 0) {
						modalItems[0].classList.remove('product-media-modal__content--item--hidden');
					}
				}

				// Convertir lazy-src en src pour les modal items visibles
				const visibleModalItems = document.querySelectorAll(
					'.product-media-modal__content--item:not(.product-media-modal__content--item--hidden)',
				);
				visibleModalItems.forEach((item) => this.removeLazyLoad(item));
			}

			/**
			 * Détermine si un média doit être affiché selon les options de variante
			 * @param {string} mediaAlt - La valeur data-media-alt du média
			 * @param {string} variantOptionString - La chaîne d'options de la variante
			 * @returns {boolean} True si le média doit être affiché
			 * @private
			 */
			shouldShowMedia(mediaAlt, variantOptionString) {
				if (!mediaAlt) return true;

				return mediaAlt === variantOptionString;
			}

			/**
			 * Met à jour l'attribut data-first-visible-media-shown avec l'URL de la première image visible
			 * @param {HTMLElement} mediaElement - L'élément média de la première image visible
			 * @private
			 */
			updateFirstVisibleMediaUrl(mediaElement) {
				if (!mediaElement) return;

				// D'abord supprimer l'attribut de tous les éléments médias
				const allMediaItems = this.querySelectorAll('.product__media-item');
				allMediaItems.forEach((item) => {
					item.removeAttribute('data-first-visible-media-shown');
				});

				// Rechercher l'image dans l'élément média
				const img = mediaElement.querySelector('img');

				if (img) {
					// Récupérer l'URL de l'image - préférer l'attribut src/lazy-src au lieu de la propriété src
					let imageUrl = img.getAttribute('src') || img.getAttribute('lazy-src');

					// Si on n'a toujours pas d'URL valide ou si c'est une URL relative sans chemin d'image
					if (!imageUrl || imageUrl === '') {
						// Essayer de récupérer depuis srcset ou lazy-srcset
						const srcset = img.getAttribute('srcset') || img.getAttribute('lazy-srcset');
						if (srcset) {
							// Extraire la première URL du srcset
							const firstUrl = srcset.split(',')[0].trim().split(' ')[0];
							if (firstUrl) {
								imageUrl = firstUrl;
							}
						}
					}

					// Vérifier que c'est bien une URL d'image Shopify valide
					const isValidImageUrl =
						imageUrl &&
						// URL du CDN Shopify
						(imageUrl.includes('cdn.shopify.com') ||
							// URL avec extension d'image
							imageUrl.match(/\.(jpg|jpeg|png|gif|webp|avif)/i) ||
							// URL de fichiers Shopify
							imageUrl.includes('/files/') ||
							// URL commençant par //
							imageUrl.startsWith('//'));

					// Exclure les URLs de pages produits
					const isProductPageUrl =
						imageUrl &&
						imageUrl.includes('/products/') &&
						!imageUrl.includes('cdn.shopify.com') &&
						!imageUrl.includes('/files/');

					if (isValidImageUrl && !isProductPageUrl) {
						// C'est une URL d'image valide

						// Si l'URL commence par //, ajouter le protocole
						if (imageUrl.startsWith('//')) {
							imageUrl = window.location.protocol + imageUrl;
						}

						// Remplacer un domaine shopifypreview par le domaine de la boutique (Shopify.shop)
						try {
							if (
								typeof Shopify !== 'undefined' &&
								Shopify.shop &&
								imageUrl.includes('shopifypreview')
							) {
								const urlObj = new URL(imageUrl);
								urlObj.hostname = Shopify.shop;
								urlObj.protocol = window.location.protocol;
								imageUrl = urlObj.toString();
							}
						} catch (e) {
							// Fallback en cas d'URL invalide pour le constructeur URL
							if (typeof Shopify !== 'undefined' && Shopify.shop) {
								imageUrl = imageUrl.replace(
									/^https?:\/\/[^/]+/i,
									`${window.location.protocol}//${Shopify.shop}`,
								);
							}
						}

						// Ajouter ?width=300 si ce n'est pas déjà présent
						if (!imageUrl.includes('width=')) {
							imageUrl = imageUrl.includes('?') ? `${imageUrl}&width=300` : `${imageUrl}?width=300`;
						}

						mediaElement.setAttribute('data-first-visible-media-shown', imageUrl);

						// Émettre l'événement
						const event = new CustomEvent('media-gallery:first-visible-image-updated', {
							bubbles: true,
							detail: {
								imageUrl: imageUrl,
								mediaElement: mediaElement,
							},
						});

						document.dispatchEvent(event);
					} else {
						console.error('URL invalide - ne correspond pas à une image:', imageUrl);
					}
				} else {
					console.error('Aucune image trouvée dans mediaElement');
				}
			}

			announceLiveRegion(activeItem, position) {
				const image = activeItem.querySelector('.product__modal-opener--image img');
				if (!image) return;
				image.onload = () => {
					this.elements.liveRegion.setAttribute('aria-hidden', false);
					this.elements.liveRegion.innerHTML = window.accessibilityStrings.imageAvailable.replace(
						'[index]',
						position,
					);
					setTimeout(() => {
						this.elements.liveRegion.setAttribute('aria-hidden', true);
					}, 2000);
				};
				image.src = image.src;
			}

			playActiveMedia(activeItem) {
				window.pauseAllMedia();
				const deferredMedia = activeItem.querySelector('.deferred-media');
				if (deferredMedia) deferredMedia.loadContent(false);
			}

			preventStickyHeader() {
				this.stickyHeader = this.stickyHeader || document.querySelector('sticky-header');
				if (!this.stickyHeader) return;
				this.stickyHeader.dispatchEvent(new Event('preventHeaderReveal'));
			}

			removeListSemantic() {
				if (!this.elements.viewer.slider) return;
				this.elements.viewer.slider.setAttribute('role', 'presentation');
				this.elements.viewer.sliderItems.forEach((slide) =>
					slide.setAttribute('role', 'presentation'),
				);
			}

			/**
			 * Bascule entre l'affichage "voir plus" et "voir moins"
			 * @private
			 */
			toggleShowMoreMedia() {
				if (!this.elements.showMoreButton) return;

				const currentState = this.elements.showMoreButton.getAttribute('data-state');

				if (currentState === 'expanded') {
					this.showLessMedia();
				} else {
					this.showMoreMedia();
				}
			}

			/**
			 * Affiche les images cachées par le système stacked (au-delà de la 7ème)
			 * @private
			 */
			showMoreMedia() {
				// Retirer la classe hidden-stacked de tous les éléments média
				const hiddenStackedItems = this.querySelectorAll('.product__media-item--hidden-stacked');
				hiddenStackedItems.forEach((item) => {
					item.classList.remove('product__media-item--hidden-stacked');
					// Charger les images lazy-loadées
					this.removeLazyLoad(item);
				});

				// Changer le texte du bouton pour "voir moins"
				if (this.elements.showMoreButton) {
					const moreLabel = this.elements.showMoreButton.dataset.moreLabel;
					const lessLabel = this.elements.showMoreButton.dataset.lessLabel;

					if (lessLabel) {
						this.elements.showMoreButton.textContent = lessLabel;
						this.elements.showMoreButton.setAttribute('aria-label', lessLabel);
						this.elements.showMoreButton.setAttribute('data-state', 'expanded');
					}
				}
			}

			/**
			 * Déplace les badges vers la première image visible
			 * @param {HTMLElement} firstVisibleMedia - L'élément média de la première image visible
			 * @private
			 */
			moveBadgesToFirstVisibleMedia(firstVisibleMedia) {
				if (!firstVisibleMedia || !this.elements.badgesContainer) return;

				// Vérifier si la première image visible est bien une image
				if (firstVisibleMedia.querySelector('img') === null) {
					// Si ce n'est pas une image, cacher les badges
					this.elements.badgesContainer.style.display = 'none';
					return;
				}

				// Déplacer le badge unique vers la première image visible
				firstVisibleMedia.appendChild(this.elements.badgesContainer);

				// Afficher le badge
				this.elements.badgesContainer.style.display = '';
			}

			/**
			 * Cache les médias au-delà de la 7ème position dans le système stacked
			 * @private
			 */
			showLessMedia() {
				// Récupérer tous les médias visibles (pas ceux avec product__media-item--hidden)
				const mediaItems = this.querySelectorAll('.product__media-item[data-media-alt]');
				const visibleMediaItems = Array.from(mediaItems).filter(
					(item) => !item.classList.contains('product__media-item--hidden'),
				);

				let visibleCount = 0;

				visibleMediaItems.forEach((item) => {
					visibleCount++;
					// Si plus de 7 médias visibles (images, vidéos, modèles 3D, etc.), cacher ceux au-delà
					if (visibleCount > 7) {
						item.classList.add('product__media-item--hidden-stacked');
					}
				});

				// Changer le texte du bouton pour "voir plus"
				if (this.elements.showMoreButton) {
					const moreLabel = this.elements.showMoreButton.dataset.moreLabel;

					if (moreLabel) {
						this.elements.showMoreButton.textContent = moreLabel;
						this.elements.showMoreButton.setAttribute('aria-label', moreLabel);
						this.elements.showMoreButton.setAttribute('data-state', 'collapsed');
					}
				}
			}

			/**
			 * Initialise l'auto-play des vidéos au scroll pour template new-offer sur desktop
			 * @private
			 */
			initVideoAutoPlay() {
				// Trouver toutes les vidéos dans la galerie
				const videoDeferredMedia = this.querySelectorAll(
					'deferred-media[data-media-type="video"], deferred-media[data-media-type="external_video"]',
				);

				if (videoDeferredMedia.length === 0) return;

				// Options pour l'Intersection Observer
				const observerOptions = {
					root: null, // viewport
					rootMargin: '0px',
					threshold: 0.5, // La vidéo doit être visible à au moins 50%
				};

				// Callback pour l'Intersection Observer
				const handleIntersection = (entries) => {
					entries.forEach((entry) => {
						const deferredMedia = entry.target;
						const mediaItem = deferredMedia.closest('.product__media-item');

						// Ignorer si le média est caché
						if (mediaItem && mediaItem.classList.contains('product__media-item--hidden')) {
							return;
						}

						if (entry.isIntersecting) {
							// La vidéo est visible, la charger et la jouer
							this.playVideo(deferredMedia);
						} else {
							// La vidéo n'est plus visible, la mettre en pause
							this.pauseVideo(deferredMedia);
						}
					});
				};

				// Créer l'Intersection Observer
				this.videoObserver = new IntersectionObserver(handleIntersection, observerOptions);

				// Observer toutes les vidéos
				videoDeferredMedia.forEach((deferredMedia) => {
					this.videoObserver.observe(deferredMedia);
				});
			}

			/**
			 * Initialise la gestion du changement d'onglet pour mettre en pause les vidéos
			 * @private
			 */
			initVideoVisibilityHandler() {
				if (this.boundHandlers.visibilityChangeHandler) return; // Déjà initialisé

				// Gérer le changement d'onglet avec Page Visibility API (desktop et mobile)
				this.boundHandlers.visibilityChangeHandler = () => {
					if (document.hidden) {
						// L'onglet est caché, mettre en pause toutes les vidéos
						this.activeVideos.forEach((video) => {
							if (video && video.tagName === 'VIDEO' && !video.paused) {
								video.pause();
							}
						});
					} else {
						// L'onglet est visible, relancer les vidéos selon le contexte
						const isDesktop = this.mql.matches;
						const videoDeferredMedia = this.querySelectorAll(
							'deferred-media[data-media-type="video"], deferred-media[data-media-type="external_video"]',
						);

						videoDeferredMedia.forEach((deferredMedia) => {
							const mediaItem = deferredMedia.closest('.product__media-item');
							if (mediaItem && !mediaItem.classList.contains('product__media-item--hidden')) {
								if (isDesktop) {
									// Sur desktop : vérifier la visibilité avec Intersection Observer
									// L'Intersection Observer se chargera automatiquement de relancer les vidéos visibles
									const rect = deferredMedia.getBoundingClientRect();
									const viewportHeight = window.innerHeight;
									const viewportWidth = window.innerWidth;
									const isVisible =
										rect.top < viewportHeight &&
										rect.bottom > 0 &&
										rect.left < viewportWidth &&
										rect.right > 0 &&
										rect.height > 0 &&
										rect.width > 0;

									if (isVisible) {
										// Vérifier que la vidéo est suffisamment visible (au moins 50%)
										const visibleHeight =
											Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
										const visibleWidth =
											Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0);
										const visibleArea = visibleHeight * visibleWidth;
										const totalArea = rect.height * rect.width;
										const visibilityRatio = visibleArea / totalArea;

										if (visibilityRatio >= 0.5) {
											this.playVideo(deferredMedia);
										}
									}
								} else {
									// Sur mobile : relancer la vidéo si c'est le slide actif
									if (mediaItem.classList.contains('is-active')) {
										this.playVideo(deferredMedia);
									}
								}
							}
						});
					}
				};

				document.addEventListener('visibilitychange', this.boundHandlers.visibilityChangeHandler);
			}

			/**
			 * Charge et joue une vidéo
			 * @param {HTMLElement} deferredMedia - L'élément deferred-media contenant la vidéo
			 * @private
			 */
			playVideo(deferredMedia) {
				if (!deferredMedia) return;

				// Charger le contenu si pas déjà chargé
				if (!deferredMedia.hasAttribute('loaded')) {
					const deferredMediaElement = deferredMedia;
					if (typeof deferredMediaElement.loadContent === 'function') {
						deferredMediaElement.loadContent(false);
					}
				}

				// Attendre que la vidéo soit chargée
				const checkVideoLoaded = () => {
					const video = deferredMedia.querySelector('video, iframe');
					if (video) {
						if (video.tagName === 'VIDEO') {
							// Vidéo HTML5
							if (video.paused) {
								video.play().catch((error) => {
									console.warn('Erreur lors de la lecture de la vidéo:', error);
								});
							}
							this.activeVideos.set(deferredMedia, video);

							// Cacher l'image preview et le poster une fois la vidéo lancée
							this.hideVideoPreview(deferredMedia);

							// Écouter l'événement play pour cacher l'image au moment exact où la vidéo démarre
							video.addEventListener(
								'play',
								() => {
									this.hideVideoPreview(deferredMedia);
								},
								{ once: true },
							);
						} else if (video.tagName === 'IFRAME') {
							// Vidéo externe (YouTube, Vimeo, etc.)
							// Pour les iframes, on ne peut pas contrôler directement la lecture
							// mais on peut s'assurer qu'elle est chargée
							this.activeVideos.set(deferredMedia, video);

							// Cacher l'image preview et le poster pour les vidéos externes
							// Attendre un peu pour que l'iframe soit chargée
							setTimeout(() => {
								this.hideVideoPreview(deferredMedia);
							}, 500);
						}
					} else {
						// Réessayer après un court délai si la vidéo n'est pas encore chargée
						setTimeout(checkVideoLoaded, 100);
					}
				};

				checkVideoLoaded();
			}

			/**
			 * Cache l'image preview et le poster button d'une vidéo
			 * @param {HTMLElement} deferredMedia - L'élément deferred-media contenant la vidéo
			 * @private
			 */
			hideVideoPreview(deferredMedia) {
				if (!deferredMedia) return;

				// Trouver le media-item parent
				const mediaItem = deferredMedia.closest('.product__media-item');
				if (!mediaItem) return;

				// Cacher l'image preview dans le modal-opener
				const modalOpener = mediaItem.querySelector('.product__modal-opener');
				if (modalOpener) {
					const previewImage = modalOpener.querySelector('.product__media');
					if (previewImage) {
						previewImage.style.display = 'none';
					}
				}

				// Cacher le poster button dans le deferred-media
				const posterButton = deferredMedia.querySelector('.deferred-media__poster');
				if (posterButton) {
					posterButton.style.display = 'none';
				}
			}

			/**
			 * Affiche l'image preview et le poster button d'une vidéo (quand elle est mise en pause)
			 * @param {HTMLElement} deferredMedia - L'élément deferred-media contenant la vidéo
			 * @private
			 */
			showVideoPreview(deferredMedia) {
				if (!deferredMedia) return;

				// Trouver le media-item parent
				const mediaItem = deferredMedia.closest('.product__media-item');
				if (!mediaItem) return;

				// Afficher l'image preview dans le modal-opener
				const modalOpener = mediaItem.querySelector('.product__modal-opener');
				if (modalOpener) {
					const previewImage = modalOpener.querySelector('.product__media');
					if (previewImage) {
						previewImage.style.display = '';
					}
				}

				// Afficher le poster button dans le deferred-media
				const posterButton = deferredMedia.querySelector('.deferred-media__poster');
				if (posterButton) {
					posterButton.style.display = '';
				}
			}

			/**
			 * Met en pause une vidéo
			 * @param {HTMLElement} deferredMedia - L'élément deferred-media contenant la vidéo
			 * @private
			 */
			pauseVideo(deferredMedia) {
				if (!deferredMedia) return;

				const video = this.activeVideos.get(deferredMedia);
				if (video && video.tagName === 'VIDEO' && !video.paused) {
					video.pause();
					// Réafficher l'image preview et le poster quand la vidéo est mise en pause
					this.showVideoPreview(deferredMedia);
				}
				// Note: Pour les iframes (YouTube, Vimeo), on ne peut pas mettre en pause directement
				// mais elles seront gérées par le changement d'onglet
			}
		},
	);
}