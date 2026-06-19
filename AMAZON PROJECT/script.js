/* =========================================================
   AMAZON CLONE — script.js
   Vanilla JS, no dependencies, no build step.

   Features:
     1. Product data model (read from the DOM)
     2. Real cart drawer — quantities, remove, subtotal, checkout
     3. Wishlist hearts on every product, with persisted state
     4. Live search — dims non-matches as you type + suggestions
        dropdown + jump-to-product on Enter
     5. Category sidebar ("All") generated from real product data
     6. Deliver-to / country switcher that updates the page copy
     7. Floating "back to top" button that appears on scroll
     8. Everything (cart + wishlist + location) persists in
        localStorage, so it survives a page refresh
   ========================================================= */

(() => {
    'use strict';

    const STORAGE_KEYS = {
        cart: 'ac_cart',
        wishlist: 'ac_wishlist',
        location: 'ac_location'
    };

    /* ---------- small persistence helpers ---------- */
    function loadJSON(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (err) {
            return fallback;
        }
    }
    function saveJSON(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (err) {
            /* storage unavailable (private browsing etc) — fail silently */
        }
    }

    document.addEventListener('DOMContentLoaded', () => {

        /* =========================================================
           0. BUILD PRODUCT DATA FROM THE DOM
           ========================================================= */
        const boxEls = Array.from(document.querySelectorAll('.shop-section .box'));
        const PRODUCTS = {};

        boxEls.forEach((box) => {
            const id = box.dataset.id;
            const price = Number(box.dataset.price) || 0;
            const title = box.querySelector('h2').textContent.trim();
            const imageDiv = box.querySelector('.box-image');
            const bg = imageDiv.style.backgroundImage || '';
            const match = bg.match(/url\((['"]?)(.*?)\1\)/);
            const image = match ? match[2] : '';

            PRODUCTS[id] = { id, title, price, image, element: box };
        });

        /* =========================================================
           1. TOAST
           ========================================================= */
        function showToast(message) {
            let toast = document.querySelector('.toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.className = 'toast';
                document.body.appendChild(toast);
            }
            toast.textContent = message;
            toast.classList.add('show');
            clearTimeout(showToast._timer);
            showToast._timer = setTimeout(() => toast.classList.remove('show'), 2200);
        }

        /* =========================================================
           2. CART  (drawer, quantities, subtotal, checkout)
           ========================================================= */
        const cartCountEl = document.getElementById('cartCount');
        const cartIcon = document.getElementById('cartIcon');
        const cartDrawer = document.getElementById('cartDrawer');
        const cartOverlay = document.getElementById('cartOverlay');
        const cartClose = document.getElementById('cartClose');
        const cartItemsList = document.getElementById('cartItemsList');
        const cartEmptyMsg = document.getElementById('cartEmptyMsg');
        const cartSubtotalEl = document.getElementById('cartSubtotal');
        const checkoutBtn = document.getElementById('checkoutBtn');

        // cart = { productId: quantity }
        let cart = loadJSON(STORAGE_KEYS.cart, {});

        function rupee(n) {
            return '\u20B9' + n.toLocaleString('en-IN');
        }

        function cartTotalQty() {
            return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
        }

        function cartSubtotal() {
            return Object.entries(cart).reduce((sum, [id, qty]) => {
                const product = PRODUCTS[id];
                return product ? sum + product.price * qty : sum;
            }, 0);
        }

        function persistCart() {
            saveJSON(STORAGE_KEYS.cart, cart);
        }

        function renderCart() {
            const entries = Object.entries(cart).filter(([, qty]) => qty > 0);
            cartCountEl.textContent = cartTotalQty();
            cartSubtotalEl.textContent = rupee(cartSubtotal());

            if (entries.length === 0) {
                cartItemsList.innerHTML = '';
                cartItemsList.appendChild(cartEmptyMsg);
                cartEmptyMsg.style.display = 'block';
                return;
            }

            cartItemsList.innerHTML = '';
            entries.forEach(([id, qty]) => {
                const product = PRODUCTS[id];
                if (!product) return;

                const row = document.createElement('div');
                row.className = 'cart-item';
                row.innerHTML = `
                    <img src="${product.image}" alt="${product.title}">
                    <div class="cart-item-info">
                        <div class="cart-item-title">${product.title}</div>
                        <div class="cart-item-price">${rupee(product.price)} x ${qty} = ${rupee(product.price * qty)}</div>
                        <div class="cart-item-qty">
                            <button class="qty-decrease" data-id="${id}">&minus;</button>
                            <span>${qty}</span>
                            <button class="qty-increase" data-id="${id}">&plus;</button>
                        </div>
                        <button class="cart-item-remove" data-id="${id}">Remove</button>
                    </div>
                `;
                cartItemsList.appendChild(row);
            });
        }

        function addToCart(id, showMessage = true) {
            cart[id] = (cart[id] || 0) + 1;
            persistCart();
            renderCart();
            cartCountEl.classList.add('bump');
            setTimeout(() => cartCountEl.classList.remove('bump'), 200);
            if (showMessage) {
                const product = PRODUCTS[id];
                showToast(`Added "${product ? product.title : 'item'}" to cart`);
            }
        }

        function changeQty(id, delta) {
            if (!cart[id]) return;
            cart[id] += delta;
            if (cart[id] <= 0) delete cart[id];
            persistCart();
            renderCart();
        }

        function removeFromCart(id) {
            delete cart[id];
            persistCart();
            renderCart();
        }

        function openCart() {
            cartDrawer.classList.add('open');
            cartOverlay.classList.add('open');
        }
        function closeCart() {
            cartDrawer.classList.remove('open');
            cartOverlay.classList.remove('open');
        }

        // "Shop now" / "See more" buttons add the matching product to the cart
        document.querySelectorAll('.cart-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const box = btn.closest('.box');
                if (box) addToCart(box.dataset.id);
            });
        });

        cartIcon.addEventListener('click', openCart);
        cartClose.addEventListener('click', closeCart);
        cartOverlay.addEventListener('click', closeCart);

        // quantity / remove buttons are created dynamically — use delegation
        cartItemsList.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            if (!id) return;
            if (e.target.classList.contains('qty-increase')) changeQty(id, 1);
            if (e.target.classList.contains('qty-decrease')) changeQty(id, -1);
            if (e.target.classList.contains('cart-item-remove')) removeFromCart(id);
        });

        checkoutBtn.addEventListener('click', () => {
            if (cartTotalQty() === 0) {
                showToast('Your cart is empty');
                return;
            }
            const total = rupee(cartSubtotal());
            cart = {};
            persistCart();
            renderCart();
            closeCart();
            showToast(`Order placed! Total ${total} — thanks for shopping.`);
        });

        renderCart(); // initial paint (also restores persisted cart)

        /* =========================================================
           3. WISHLIST
           ========================================================= */
        const wishlistCountEl = document.getElementById('wishlistCount');
        const wishlistIcon = document.getElementById('wishlistIcon');

        let wishlist = new Set(loadJSON(STORAGE_KEYS.wishlist, []));

        function persistWishlist() {
            saveJSON(STORAGE_KEYS.wishlist, Array.from(wishlist));
        }

        function renderWishlistHearts() {
            wishlistCountEl.textContent = wishlist.size;
            document.querySelectorAll('.wishlist-heart').forEach((heart) => {
                const id = heart.closest('.box').dataset.id;
                const icon = heart.querySelector('i');
                if (wishlist.has(id)) {
                    heart.classList.add('saved');
                    icon.classList.remove('fa-regular');
                    icon.classList.add('fa-solid');
                } else {
                    heart.classList.remove('saved');
                    icon.classList.remove('fa-solid');
                    icon.classList.add('fa-regular');
                }
            });
        }

        document.querySelectorAll('.wishlist-heart').forEach((heart) => {
            heart.addEventListener('click', (e) => {
                e.stopPropagation();
                const box = heart.closest('.box');
                const id = box.dataset.id;
                const product = PRODUCTS[id];

                if (wishlist.has(id)) {
                    wishlist.delete(id);
                    showToast(`Removed "${product.title}" from wishlist`);
                } else {
                    wishlist.add(id);
                    showToast(`Saved "${product.title}" to wishlist`);
                }
                persistWishlist();
                renderWishlistHearts();
            });
        });

        wishlistIcon.addEventListener('click', () => {
            if (wishlist.size === 0) {
                showToast('Your wishlist is empty');
                return;
            }
            const titles = Array.from(wishlist).map((id) => PRODUCTS[id]?.title).filter(Boolean);
            showToast(`Wishlist: ${titles.join(', ')}`);
        });

        renderWishlistHearts(); // initial paint (also restores persisted wishlist)

        /* =========================================================
           4. LIVE SEARCH (dim-as-you-type + suggestions + jump)
           ========================================================= */
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        const searchSuggestions = document.getElementById('searchSuggestions');

        function highlightProduct(id) {
            const product = PRODUCTS[id];
            if (!product) return;
            product.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            product.element.classList.add('highlight');
            setTimeout(() => product.element.classList.remove('highlight'), 1500);
        }

        function clearDim() {
            boxEls.forEach((b) => b.classList.remove('dimmed'));
        }

        function closeSuggestions() {
            searchSuggestions.classList.remove('open');
            searchSuggestions.innerHTML = '';
        }

        function matchingProducts(term) {
            return Object.values(PRODUCTS).filter((p) =>
                p.title.toLowerCase().includes(term)
            );
        }

        searchInput.addEventListener('input', () => {
            const term = searchInput.value.trim().toLowerCase();

            if (!term) {
                clearDim();
                closeSuggestions();
                return;
            }

            const matches = matchingProducts(term);
            const matchIds = new Set(matches.map((p) => p.id));
            boxEls.forEach((b) => {
                b.classList.toggle('dimmed', !matchIds.has(b.dataset.id));
            });

            if (matches.length === 0) {
                closeSuggestions();
                return;
            }

            searchSuggestions.innerHTML = matches.slice(0, 6).map((p) => {
                const idx = p.title.toLowerCase().indexOf(term);
                const before = p.title.slice(0, idx);
                const bolded = p.title.slice(idx, idx + term.length);
                const after = p.title.slice(idx + term.length);
                return `<div data-id="${p.id}">${before}<b>${bolded}</b>${after} — ${rupee(p.price)}</div>`;
            }).join('');
            searchSuggestions.classList.add('open');
        });

        searchSuggestions.addEventListener('click', (e) => {
            const row = e.target.closest('[data-id]');
            if (!row) return;
            highlightProduct(row.dataset.id);
            closeSuggestions();
            clearDim();
            searchInput.value = '';
        });

        function runSearch() {
            const term = searchInput.value.trim().toLowerCase();
            if (!term) {
                showToast('Type something to search');
                return;
            }
            const matches = matchingProducts(term);
            closeSuggestions();
            clearDim();
            if (matches.length > 0) {
                highlightProduct(matches[0].id);
                showToast(`Showing results for "${searchInput.value}"`);
            } else {
                showToast(`No results found for "${searchInput.value}"`);
            }
        }

        searchBtn.addEventListener('click', runSearch);
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') runSearch();
            if (e.key === 'Escape') {
                closeSuggestions();
                clearDim();
            }
        });

        /* =========================================================
           5. CATEGORY SIDEBAR ("All")
           ========================================================= */
        const categoryToggle = document.getElementById('categoryToggle');
        const categoryDrawer = document.getElementById('categoryDrawer');
        const categoryOverlay = document.getElementById('categoryOverlay');
        const categoryClose = document.getElementById('categoryClose');
        const categoryList = document.getElementById('categoryList');

        Object.values(PRODUCTS).forEach((product) => {
            const li = document.createElement('li');
            li.innerHTML = `<a href="#" data-id="${product.id}">${product.title}</a>`;
            categoryList.appendChild(li);
        });

        function openCategoryDrawer() {
            categoryDrawer.classList.add('open');
            categoryOverlay.classList.add('open');
        }
        function closeCategoryDrawer() {
            categoryDrawer.classList.remove('open');
            categoryOverlay.classList.remove('open');
        }

        categoryToggle.addEventListener('click', openCategoryDrawer);
        categoryClose.addEventListener('click', closeCategoryDrawer);
        categoryOverlay.addEventListener('click', closeCategoryDrawer);

        categoryList.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (!link) return;
            e.preventDefault();
            highlightProduct(link.dataset.id);
            closeCategoryDrawer();
        });

        /* =========================================================
           6. ACCOUNT DROPDOWN
           ========================================================= */
        const accountToggle = document.getElementById('accountToggle');
        const accountDropdown = document.getElementById('accountDropdown');

        accountToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            accountDropdown.classList.toggle('open');
            addressDropdown.classList.remove('open'); // keep only one dropdown open
        });

        /* =========================================================
           7. DELIVER-TO / COUNTRY SWITCHER
           ========================================================= */
        const addressToggle = document.getElementById('addressToggle');
        const addressDropdown = document.getElementById('addressDropdown');
        const addressLabel = document.getElementById('addressLabel');
        const heroText = document.getElementById('heroText');

        function applyLocation(country, domain, announce) {
            addressLabel.textContent = country;
            heroText.innerHTML =
                `You are shopping on <b>${domain}</b>, delivering to <b>${country}</b>. ` +
                `Switch "deliver to" anytime to shop a different Amazon site. ` +
                `<a href="https://www.${domain}/" target="_blank" id="heroLink">Amazon link!</a>`;
            saveJSON(STORAGE_KEYS.location, { country, domain });
            if (announce) showToast(`Delivery location set to ${country}`);
        }

        addressToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            addressDropdown.classList.toggle('open');
            accountDropdown.classList.remove('open');
        });

        addressDropdown.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                applyLocation(link.dataset.country, link.dataset.domain, true);
                addressDropdown.classList.remove('open');
            });
        });

        // restore a previously chosen location (silently, no toast)
        const savedLocation = loadJSON(STORAGE_KEYS.location, null);
        if (savedLocation) applyLocation(savedLocation.country, savedLocation.domain, false);

        // close any open dropdown when clicking elsewhere on the page
        document.addEventListener('click', (e) => {
            if (!accountToggle.contains(e.target)) accountDropdown.classList.remove('open');
            if (!addressToggle.contains(e.target)) addressDropdown.classList.remove('open');
            if (!e.target.closest('.nav-search')) closeSuggestions();
        });

        /* =========================================================
           8. BACK TO TOP (footer link + floating button)
           ========================================================= */
        const backToTop = document.getElementById('backToTop');
        const floatTopBtn = document.getElementById('floatTopBtn');

        function scrollToTop() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        backToTop.addEventListener('click', scrollToTop);
        floatTopBtn.addEventListener('click', scrollToTop);

        window.addEventListener('scroll', () => {
            floatTopBtn.classList.toggle('show', window.scrollY > 400);
        });

    });
})();
