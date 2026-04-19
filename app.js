// app.js - Storefront Logic

const app = {
    currentPage: 'home',
    currentParams: {},
    currentCustomer: null,
    tempResetEmail: null,
    tempOtp: null,
    
    init() {
        const s = db.getSettings();
        if (s.maintenanceMode) {
            document.body.innerHTML = this.renderMaintenance(s);
            return;
        }
        
        this.applyAppearance();
        this.checkAuth();
        this.updateCartCount();
        this.updateWishlistCount();
        this.populateFooter();
        this.renderCart();
        this.navigate('home');
        document.getElementById('current-year').textContent = new Date().getFullYear();
    },

    navigate(page, params = {}) {
        this.currentPage = page;
        this.currentParams = params;
        const content = document.getElementById('app-content');
        window.scrollTo(0, 0);

        switch(page) {
            case 'home':
                content.innerHTML = this.renderHome();
                break;
            case 'shop':
                content.innerHTML = this.renderShop(params);
                break;
            case 'categories':
                content.innerHTML = this.renderCategories();
                break;
            case 'product':
                content.innerHTML = this.renderProductDetail(params.id);
                break;
            case 'checkout':
                content.innerHTML = this.renderCheckout();
                break;
            case 'wishlist':
                content.innerHTML = this.renderWishlist();
                break;
            case 'track':
                content.innerHTML = this.renderTrackOrder();
                break;
            case 'account':
                content.innerHTML = this.renderAccount();
                break;
            case 'success':
                content.innerHTML = this.renderSuccess(params);
                break;
            default:
                content.innerHTML = this.renderHome();
        }
    },

    // --- Rendering Pages ---

    renderMaintenance(s) {
        const logoText = s.storeName || 'FIT MY FABRICS';
        return `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; text-align:center; padding:2rem; background:var(--bg-light); color:var(--text-dark); font-family:var(--font-body);">
                <h1 style="font-family:var(--font-heading); color:var(--primary); font-size:3rem; margin-bottom:1rem;">${logoText}</h1>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:2rem;">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <h2 style="margin-bottom:1rem;">We'll be back soon!</h2>
                <p style="max-width:500px; color:var(--text-light); line-height:1.6;">Our website is currently undergoing scheduled maintenance to improve your shopping experience. We should be back shortly. Thank you for your patience.</p>
            </div>
        `;
    },

    applyAppearance() {
        const s = db.getSettings();
        if (s.primaryColor) document.documentElement.style.setProperty('--primary', s.primaryColor);
        if (s.accentColor) document.documentElement.style.setProperty('--accent', s.accentColor);
        
        const topBar = document.querySelector('.top-bar');
        if (topBar && s.topBarText) topBar.textContent = s.topBarText;

        const logoText = document.querySelector('.logo');
        if (logoText) {
            const mode = s.logoDisplayMode || 'logo-text';
            const defaultSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34"></path><polygon points="18 2 22 6 12 16 8 16 8 12 18 2"></polygon></svg>`;
            const logoImg = s.storeLogo ? `<img src="${s.storeLogo}" style="max-height: 48px; width: auto; object-fit: contain;">` : defaultSvg;
            const name = s.storeName || 'FIT MY FABRICS';

            if (mode === 'text-only') {
                logoText.innerHTML = name;
            } else if (mode === 'logo-only') {
                logoText.innerHTML = logoImg;
            } else {
                logoText.innerHTML = `${logoImg} <span>${name}</span>`;
            }
        }
    },

    renderHome() {
        const s = db.getSettings();
        const products = db.get('products').filter(p => p.status === 'Active');
        const featured = products.filter(p => p.featured).slice(0, 4);
        const newArrivals = products.filter(p => p.newArrival).slice(0, 8);
        const sale = products.filter(p => p.discountPrice).slice(0, 4);
        const categories = db.get('categories').filter(c => c.status === 'Active').slice(0, 4);

        const heroBg = s.heroImage ? `url(${s.heroImage})` : 'none';

        return `
            <section class="hero" style="background: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), ${heroBg} center/cover; background-color: var(--primary);">
                <div class="container">
                    <h1>${s.heroHeadline || 'Wear Your Style'}</h1>
                    <p>${s.heroSubheadline || 'Discover the latest trends in Bangladeshi fashion.'}</p>
                    <button class="btn btn-accent" onclick="app.navigate('shop')">Shop Now</button>
                    <button class="btn btn-outline" style="color:white; border-color:white;" onclick="app.navigate('shop', {filter:'new'})">New Arrivals</button>
                </div>
            </section>

            <div style="background: var(--primary); color: var(--accent); padding: 1rem 0; text-align: center; font-weight: 500; font-size: 0.875rem; letter-spacing: 1px;">
                FREE DELIVERY | EASY RETURNS | CASH ON DELIVERY | 100% ORIGINAL
            </div>

            <section class="container">
                <h2 class="section-title">Shop by Category</h2>
                <div class="product-grid" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));">
                    ${categories.map(c => `
                        <div class="product-card" style="cursor:pointer;" onclick="app.navigate('shop', {category: '${c.id}'})">
                            <div class="product-img-wrap" style="padding-top: 100%;">
                                ${c.image ? `<img src="${c.image}" class="product-img">` : `<div style="position:absolute;top:0;left:0;width:100%;height:100%;background:#eee;display:flex;align-items:center;justify-content:center;color:#999;">No Image</div>`}
                            </div>
                            <div class="product-info">
                                <h3 class="product-title">${c.name}</h3>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </section>

            <section class="container">
                <h2 class="section-title">Featured Products</h2>
                <div class="product-grid">
                    ${featured.map(p => this.renderProductCard(p)).join('')}
                </div>
            </section>

            <section class="container">
                <h2 class="section-title">New Arrivals</h2>
                <div class="product-grid">
                    ${newArrivals.map(p => this.renderProductCard(p)).join('')}
                </div>
            </section>
            
            <section class="container mb-2">
                <h2 class="section-title">On Sale</h2>
                <div class="product-grid">
                    ${sale.map(p => this.renderProductCard(p)).join('')}
                </div>
            </section>
        `;
    },

    renderShop(params) {
        let products = db.get('products').filter(p => p.status === 'Active');
        let title = 'All Products';

        if (params.category) {
            products = products.filter(p => p.category === params.category);
            const cat = db.getOne('categories', params.category);
            if (cat) title = cat.name;
        }
        if (params.filter === 'new') {
            products = products.filter(p => p.newArrival);
            title = 'New Arrivals';
        }
        if (params.filter === 'sale') {
            products = products.filter(p => p.discountPrice);
            title = 'Sale Items';
        }

        return `
            <div class="container mt-2 mb-2">
                <h1 style="margin-bottom: 2rem;">${title}</h1>
                ${products.length === 0 ? '<p>No products found.</p>' : `
                    <div class="product-grid">
                        ${products.map(p => this.renderProductCard(p)).join('')}
                    </div>
                `}
            </div>
        `;
    },

    renderCategories() {
        const categories = db.get('categories').filter(c => c.status === 'Active');
        return `
            <div class="container mt-2 mb-2">
                <h1 style="margin-bottom: 2rem;">All Categories</h1>
                <div class="product-grid" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));">
                    ${categories.map(c => `
                        <div class="product-card" style="cursor:pointer;" onclick="app.navigate('shop', {category: '${c.id}'})">
                            <div class="product-img-wrap" style="padding-top: 100%;">
                                ${c.image ? `<img src="${c.image}" class="product-img">` : `<div style="position:absolute;top:0;left:0;width:100%;height:100%;background:#eee;display:flex;align-items:center;justify-content:center;color:#999;">No Image</div>`}
                            </div>
                            <div class="product-info">
                                <h3 class="product-title">${c.name}</h3>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    renderProductDetail(id) {
        const product = db.getOne('products', id);
        if (!product) return '<div class="container mt-2"><p>Product not found.</p></div>';
        
        const cat = db.getOne('categories', product.category);
        const priceHtml = product.discountPrice 
            ? `<span class="price-old">${formatMoney(product.price)}</span> <span>${formatMoney(product.discountPrice)}</span>`
            : `<span>${formatMoney(product.price)}</span>`;

        const imageSrc = (product.images && product.images.length > 0) ? product.images[0] : '';
        const imageHtml = imageSrc 
            ? `<img src="${imageSrc}" style="width:100%; border-radius:8px; object-fit:cover;">`
            : `<div style="width:100%; padding-top:125%; background:#eee; border-radius:8px; display:flex; align-items:center; justify-content:center;">No Image</div>`;

        return `
            <div class="container mt-2 mb-2">
                <div style="display: flex; flex-wrap: wrap; gap: 3rem;">
                    <div style="flex: 1; min-width: 300px;">
                        ${imageHtml}
                    </div>
                    <div style="flex: 1; min-width: 300px;">
                        <div style="color: var(--text-light); font-size: 0.875rem; margin-bottom: 0.5rem;">
                            ${cat ? cat.name : ''} | SKU: ${product.sku}
                        </div>
                        <h1 style="margin-bottom: 1rem;">${product.name}</h1>
                        <div style="font-size: 1.5rem; font-weight: 600; color: var(--primary); margin-bottom: 1.5rem;">
                            ${priceHtml}
                        </div>
                        
                        <div class="form-group">
                            <label>Size</label>
                            <select id="pd-size">
                                ${product.sizes.map(s => `<option value="${s}">${s}</option>`).join('')}
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Color</label>
                            <div style="display:flex; gap:0.5rem;">
                                ${product.colors.map((c, i) => `
                                    <label style="cursor:pointer;">
                                        <input type="radio" name="pd-color" value="${c}" ${i===0?'checked':''} style="display:none;">
                                        <div style="width:30px; height:30px; border-radius:50%; background-color:${c}; border: 2px solid ${c==='#ffffff'?'#ccc':'transparent'}; outline: 2px solid transparent; transition: all 0.2s;" onclick="document.querySelectorAll('[name=pd-color]').forEach(el=>el.nextElementSibling.style.outlineColor='transparent'); this.style.outlineColor='var(--primary)';"></div>
                                    </label>
                                `).join('')}
                            </div>
                        </div>

                        <div class="form-group" style="max-width: 100px;">
                            <label>Quantity</label>
                            <input type="number" id="pd-qty" value="1" min="1" max="${product.stock}">
                        </div>

                        <div style="display:flex; gap:1rem; margin-top: 2rem;">
                            <button class="btn btn-accent" style="flex:1;" onclick="app.addToCart('${product.id}')">Add to Cart</button>
                            <button class="btn btn-outline" onclick="app.toggleWishlist('${product.id}')">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="${this.isInWishlist(product.id) ? 'var(--danger)' : 'none'}" stroke="${this.isInWishlist(product.id) ? 'var(--danger)' : 'currentColor'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                            </button>
                        </div>

                        <div style="margin-top: 3rem;">
                            <h3>Description</h3>
                            <p style="color: var(--text-light); margin-top: 1rem; white-space: pre-line;">${product.description || 'No description available.'}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderProductCard(product) {
        const priceHtml = product.discountPrice 
            ? `<span class="price-old">${formatMoney(product.price)}</span> <span>${formatMoney(product.discountPrice)}</span>`
            : `<span>${formatMoney(product.price)}</span>`;
            
        const imageSrc = (product.images && product.images.length > 0) ? product.images[0] : '';
        const imageHtml = imageSrc 
            ? `<img src="${imageSrc}" class="product-img">`
            : `<div style="position:absolute;top:0;left:0;width:100%;height:100%;background:#eee;display:flex;align-items:center;justify-content:center;color:#999;">No Image</div>`;

        const isWished = this.isInWishlist(product.id);

        return `
            <div class="product-card">
                <div class="product-badges">
                    ${product.discountPrice ? '<span class="badge-tag badge-sale">Sale</span>' : ''}
                    ${product.newArrival ? '<span class="badge-tag badge-new">New</span>' : ''}
                </div>
                <button class="wishlist-btn ${isWished ? 'active' : ''}" onclick="app.toggleWishlist('${product.id}', this)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="${isWished ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                </button>
                <div class="product-img-wrap" style="cursor:pointer;" onclick="app.navigate('product', {id: '${product.id}'})">
                    ${imageHtml}
                </div>
                <div class="product-info">
                    <h3 class="product-title" style="cursor:pointer;" onclick="app.navigate('product', {id: '${product.id}'})">${product.name}</h3>
                    <div class="product-price">${priceHtml}</div>
                    <button class="add-to-cart-btn" onclick="app.quickAddToCart('${product.id}')">Quick Add</button>
                </div>
            </div>
        `;
    },

    renderCheckout() {
        const cart = db.get('cart');
        if (cart.length === 0) {
            return `<div class="container mt-2 text-center"><p>Your cart is empty.</p><button class="btn btn-primary mt-1" onclick="app.navigate('shop')">Shop Now</button></div>`;
        }

        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const settings = db.getSettings();
        
        // Default delivery is inside dhaka
        const deliveryFee = subtotal >= settings.freeDeliveryThreshold ? 0 : settings.deliveryInside;
        const total = subtotal + deliveryFee;

        return `
            <div class="container mt-2 mb-2">
                <h1 style="margin-bottom: 2rem;">Checkout</h1>
                <div style="display: flex; flex-wrap: wrap; gap: 2rem;">
                    <div style="flex: 2; min-width: 300px;">
                        <form id="checkout-form" onsubmit="app.placeOrder(event)">
                            <h3>Shipping Information</h3>
                            <div class="form-group mt-1">
                                <label>Full Name *</label>
                                <input type="text" id="co-name" required>
                            </div>
                            <div class="form-group">
                                <label>Phone Number (01XXXXXXXXX) *</label>
                                <input type="tel" id="co-phone" pattern="01[3-9][0-9]{8}" required>
                            </div>
                            <div class="form-group">
                                <label>Email (Optional)</label>
                                <input type="email" id="co-email">
                            </div>
                            <div class="form-group">
                                <label>Address *</label>
                                <textarea id="co-address" rows="3" required></textarea>
                            </div>
                            <div style="display:flex; gap:1rem;">
                                <div class="form-group" style="flex:1;">
                                    <label>District *</label>
                                    <select id="co-district" required>
                                        <option value="Dhaka">Dhaka</option>
                                        <option value="Chattogram">Chattogram</option>
                                        <option value="Sylhet">Sylhet</option>
                                        <option value="Rajshahi">Rajshahi</option>
                                        <option value="Khulna">Khulna</option>
                                        <option value="Barishal">Barishal</option>
                                        <option value="Rangpur">Rangpur</option>
                                        <option value="Mymensingh">Mymensingh</option>
                                    </select>
                                </div>
                                <div class="form-group" style="flex:1;">
                                    <label>Postal Code</label>
                                    <input type="text" id="co-postal">
                                </div>
                            </div>

                            <h3 class="mt-2">Delivery Method</h3>
                            <div class="form-group mt-1">
                                <select id="co-delivery" onchange="app.updateCheckoutTotal()" required>
                                    <option value="inside">Inside Dhaka (৳${settings.deliveryInside})</option>
                                    <option value="outside">Outside Dhaka (৳${settings.deliveryOutside})</option>
                                    <option value="express">Express Delivery (৳${settings.deliveryExpress})</option>
                                </select>
                                ${subtotal >= settings.freeDeliveryThreshold ? `<p style="color:var(--success); font-size:0.875rem; margin-top:0.5rem;">Qualifies for Free Delivery!</p>` : ''}
                            </div>

                            <h3 class="mt-2">Payment Method</h3>
                            <div class="form-group mt-1">
                                <select id="co-payment" onchange="app.togglePaymentInfo()" required>
                                    <option value="cod">Cash on Delivery (COD)</option>
                                    <option value="bkash">bKash</option>
                                    <option value="nagad">Nagad</option>
                                    <option value="rocket">Rocket</option>
                                </select>
                            </div>
                            <div id="payment-instructions" class="hidden" style="background:var(--bg-light); padding:1rem; border-radius:4px; margin-bottom:1.5rem; font-size:0.875rem;">
                                Please send money to <strong id="payment-number"></strong> and enter the Transaction ID below.
                                <input type="text" id="co-trxid" placeholder="Transaction ID" class="mt-1">
                            </div>

                            <button type="submit" class="btn btn-accent" style="width:100%; font-size:1.1rem; padding:1rem;">Place Order</button>
                        </form>
                    </div>
                    
                    <div style="flex: 1; min-width: 300px; background: var(--bg-light); padding: 2rem; border-radius: 8px; align-self: flex-start;">
                        <h3>Order Summary</h3>
                        <div style="margin-top: 1.5rem;">
                            ${cart.map(item => `
                                <div style="display:flex; justify-content:space-between; margin-bottom:1rem; font-size:0.875rem;">
                                    <span>${item.qty}x ${item.name} (${item.size})</span>
                                    <span>${formatMoney(item.price * item.qty)}</span>
                                </div>
                            `).join('')}
                        </div>
                        <div style="border-top: 1px solid var(--border); margin-top: 1rem; padding-top: 1rem;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                                <span>Subtotal</span>
                                <span>${formatMoney(subtotal)}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                                <span>Delivery Fee</span>
                                <span id="summary-delivery">${subtotal >= settings.freeDeliveryThreshold ? 'Free' : formatMoney(deliveryFee)}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-weight:700; font-size:1.25rem; margin-top:1rem; padding-top:1rem; border-top: 1px solid var(--border);">
                                <span>Total</span>
                                <span id="summary-total">${formatMoney(total)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderWishlist() {
        const wishlistIds = db.get('wishlist');
        const products = db.get('products').filter(p => wishlistIds.includes(p.id));

        return `
            <div class="container mt-2 mb-2">
                <h1 style="margin-bottom: 2rem;">My Wishlist</h1>
                ${products.length === 0 ? '<p>Your wishlist is empty.</p>' : `
                    <div class="product-grid">
                        ${products.map(p => this.renderProductCard(p)).join('')}
                    </div>
                `}
            </div>
        `;
    },

    renderTrackOrder() {
        return `
            <div class="container mt-2 mb-2" style="max-width: 500px;">
                <h1 style="margin-bottom: 2rem; text-align:center;">Track Order</h1>
                <div class="form-group">
                    <label>Order ID</label>
                    <input type="text" id="track-id" placeholder="e.g. ORD-123456">
                </div>
                <button class="btn btn-primary" style="width:100%;" onclick="app.trackOrder()">Track</button>
                <div id="track-result" style="margin-top: 2rem; padding: 1rem; background: var(--bg-light); border-radius: 4px; display: none;"></div>
            </div>
        `;
    },

    // --- Logic ---

    checkAuth() {
        const session = sessionStorage.getItem('fmf_customer');
        const userBtn = document.getElementById('user-icon-btn');
        if (session) {
            this.currentCustomer = JSON.parse(session);
            userBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="var(--primary)" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
            userBtn.onclick = () => app.navigate('account');
        } else {
            this.currentCustomer = null;
            userBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
            userBtn.onclick = () => app.toggleAuthModal();
        }
    },

    toggleAuthModal() {
        document.getElementById('auth-modal').classList.toggle('active');
    },

    closeModal(id) {
        document.getElementById(id).classList.remove('active');
    },

    switchAuthTab(tab) {
        if (tab === 'login') {
            document.getElementById('login-form').classList.remove('hidden');
            document.getElementById('register-form').classList.add('hidden');
            document.getElementById('tab-login').style.color = 'var(--primary)';
            document.getElementById('tab-login').style.fontWeight = 'bold';
            document.getElementById('tab-register').style.color = 'var(--text-light)';
            document.getElementById('tab-register').style.fontWeight = 'normal';
        } else {
            document.getElementById('login-form').classList.add('hidden');
            document.getElementById('register-form').classList.remove('hidden');
            document.getElementById('tab-register').style.color = 'var(--primary)';
            document.getElementById('tab-register').style.fontWeight = 'bold';
            document.getElementById('tab-login').style.color = 'var(--text-light)';
            document.getElementById('tab-login').style.fontWeight = 'normal';
        }
    },

    registerCustomer(e) {
        e.preventDefault();
        const email = document.getElementById('reg-email').value;
        const customers = db.get('customers');
        if (customers.find(c => c.email === email)) {
            showToast('Email already registered', 'error');
            return;
        }
        const newCustomer = {
            name: document.getElementById('reg-name').value,
            email: email,
            phone: document.getElementById('reg-phone').value,
            password: document.getElementById('reg-password').value,
            created: new Date().toISOString()
        };
        db.add('customers', newCustomer);
        showToast('Registration successful! Please login.');
        this.switchAuthTab('login');
        document.getElementById('login-email').value = email;
        document.getElementById('register-form').reset();
    },

    loginCustomer(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        const customers = db.get('customers');
        const customer = customers.find(c => c.email === email && c.password === pass);
        
        if (customer) {
            sessionStorage.setItem('fmf_customer', JSON.stringify(customer));
            this.checkAuth();
            this.toggleAuthModal();
            showToast('Welcome back, ' + customer.name);
            document.getElementById('login-form').reset();
            if (this.currentPage === 'checkout') this.navigate('checkout');
        } else {
            showToast('Invalid email or password', 'error');
        }
    },

    logoutCustomer() {
        sessionStorage.removeItem('fmf_customer');
        this.checkAuth();
        this.navigate('home');
        showToast('Logged out successfully');
    },

    showForgotPassword() {
        this.toggleAuthModal();
        document.getElementById('forgot-modal').classList.add('active');
    },

    sendOtp(e) {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value;
        const customers = db.get('customers');
        if (!customers.find(c => c.email === email)) {
            showToast('Email not found', 'error');
            return;
        }
        
        this.tempResetEmail = email;
        this.tempOtp = Math.floor(100000 + Math.random() * 900000).toString();
        
        const settings = db.getSettings();
        if (settings.mailProvider === 'emailjs' && settings.mailServiceId) {
            console.log(`EmailJS configured. Sending OTP ${this.tempOtp} to ${email}`);
            showToast(`[EmailJS] OTP sent to ${email}`);
        } else {
            showToast(`[Simulation] OTP is: ${this.tempOtp}`, 'success');
        }
        
        this.closeModal('forgot-modal');
        document.getElementById('otp-modal').classList.add('active');
    },

    verifyOtp(e) {
        e.preventDefault();
        const inputOtp = document.getElementById('otp-input').value;
        if (inputOtp === this.tempOtp) {
            this.closeModal('otp-modal');
            document.getElementById('reset-modal').classList.add('active');
        } else {
            showToast('Invalid OTP', 'error');
        }
    },

    resetPassword(e) {
        e.preventDefault();
        const newPass = document.getElementById('new-password').value;
        const customers = db.get('customers');
        const index = customers.findIndex(c => c.email === this.tempResetEmail);
        
        if (index > -1) {
            db.update('customers', customers[index].id, { password: newPass });
            showToast('Password updated successfully!');
            this.closeModal('reset-modal');
            this.tempResetEmail = null;
            this.tempOtp = null;
            this.toggleAuthModal();
        }
    },

    renderAccount() {
        if (!this.currentCustomer) return this.renderHome();
        const orders = db.get('orders').filter(o => o.customer.email === this.currentCustomer.email);
        
        return `
            <div class="container mt-2 mb-2">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem;">
                    <h1>My Account</h1>
                    <button class="btn btn-outline" onclick="app.logoutCustomer()">Logout</button>
                </div>
                <div style="background:var(--bg-light); padding:2rem; border-radius:8px; margin-bottom:2rem;">
                    <h3>Profile Information</h3>
                    <p><strong>Name:</strong> ${this.currentCustomer.name}</p>
                    <p><strong>Email:</strong> ${this.currentCustomer.email}</p>
                    <p><strong>Phone:</strong> ${this.currentCustomer.phone}</p>
                </div>
                <h3>My Orders</h3>
                ${orders.length === 0 ? '<p>You have no orders yet.</p>' : `
                    <div class="admin-table-wrapper mt-1">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>Order ID</th>
                                    <th>Date</th>
                                    <th>Total</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${orders.slice().reverse().map(o => `
                                    <tr>
                                        <td>${o.id}</td>
                                        <td>${new Date(o.date).toLocaleDateString()}</td>
                                        <td>৳${o.total}</td>
                                        <td><span class="badge-tag ${o.status==='Pending'?'badge-sale':'badge-new'}">${o.status}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        `;
    },

    toggleSearch() {
        const overlay = document.getElementById('search-overlay');
        overlay.classList.toggle('active');
        if (overlay.classList.contains('active')) {
            document.getElementById('search-input').focus();
        }
    },

    handleSearch(query) {
        const resultsContainer = document.getElementById('search-results');
        if (query.length < 2) {
            resultsContainer.innerHTML = '';
            return;
        }
        
        const q = query.toLowerCase();
        const products = db.get('products').filter(p => p.status === 'Active' && p.name.toLowerCase().includes(q));
        
        resultsContainer.innerHTML = products.map(p => `
            <div style="display:flex; gap:1rem; margin-bottom:1rem; cursor:pointer;" onclick="app.toggleSearch(); app.navigate('product', {id:'${p.id}'})">
                <img src="${(p.images && p.images[0]) || ''}" style="width:50px; height:50px; object-fit:cover; border-radius:4px; background:#eee;">
                <div>
                    <div style="font-weight:500; font-size:0.875rem;">${p.name}</div>
                    <div style="color:var(--primary); font-size:0.875rem;">${formatMoney(p.discountPrice || p.price)}</div>
                </div>
            </div>
        `).join('');
    },

    toggleCart() {
        document.getElementById('cart-drawer').classList.toggle('active');
        document.getElementById('cart-overlay').classList.toggle('active');
    },

    quickAddToCart(productId) {
        const product = db.getOne('products', productId);
        if (!product) return;
        this.addToCartAction(product, product.sizes[0], product.colors[0], 1);
    },

    addToCart(productId) {
        const product = db.getOne('products', productId);
        if (!product) return;
        
        const size = document.getElementById('pd-size').value;
        const colorInput = document.querySelector('input[name="pd-color"]:checked');
        const color = colorInput ? colorInput.value : product.colors[0];
        const qty = parseInt(document.getElementById('pd-qty').value) || 1;

        this.addToCartAction(product, size, color, qty);
    },

    addToCartAction(product, size, color, qty) {
        const cart = db.get('cart');
        const price = product.discountPrice || product.price;
        
        const existingIndex = cart.findIndex(item => item.id === product.id && item.size === size && item.color === color);
        
        if (existingIndex > -1) {
            cart[existingIndex].qty += qty;
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                price: price,
                image: (product.images && product.images[0]) || '',
                size: size,
                color: color,
                qty: qty
            });
        }
        
        db.set('cart', cart);
        this.updateCartCount();
        this.renderCart();
        this.toggleCart();
        showToast('Added to cart');
    },

    removeFromCart(index) {
        const cart = db.get('cart');
        cart.splice(index, 1);
        db.set('cart', cart);
        this.updateCartCount();
        this.renderCart();
    },

    updateCartQty(index, delta) {
        const cart = db.get('cart');
        cart[index].qty += delta;
        if (cart[index].qty < 1) cart[index].qty = 1;
        db.set('cart', cart);
        this.renderCart();
    },

    renderCart() {
        const cart = db.get('cart');
        const container = document.getElementById('cart-items-container');
        
        if (cart.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-light); margin-top:2rem;">Your cart is empty.</p>';
            document.getElementById('cart-subtotal').textContent = '৳0';
            document.getElementById('cart-total').textContent = '৳0';
            return;
        }

        container.innerHTML = cart.map((item, index) => `
            <div class="cart-item">
                <img src="${item.image}" class="cart-item-img" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'80\\' height=\\'100\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%23eee\\'/></svg>'">
                <div class="cart-item-info">
                    <div style="display:flex; justify-content:space-between;">
                        <div class="cart-item-title">${item.name}</div>
                        <button onclick="app.removeFromCart(${index})" style="color:var(--danger); font-size:1.2rem;">&times;</button>
                    </div>
                    <div class="cart-item-meta">Size: ${item.size} | Color: <span style="display:inline-block; width:10px; height:10px; background:${item.color}; border-radius:50%; border:1px solid #ccc;"></span></div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem;">
                        <div class="qty-controls">
                            <button class="qty-btn" onclick="app.updateCartQty(${index}, -1)">-</button>
                            <span>${item.qty}</span>
                            <button class="qty-btn" onclick="app.updateCartQty(${index}, 1)">+</button>
                        </div>
                        <div style="font-weight:600; color:var(--primary);">${formatMoney(item.price * item.qty)}</div>
                    </div>
                </div>
            </div>
        `).join('');

        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        document.getElementById('cart-subtotal').textContent = formatMoney(subtotal);
        document.getElementById('cart-total').textContent = formatMoney(subtotal); // Shipping added at checkout
    },

    updateCartCount() {
        const cart = db.get('cart');
        const count = cart.reduce((sum, item) => sum + item.qty, 0);
        document.getElementById('cart-count').textContent = count;
    },

    isInWishlist(id) {
        return db.get('wishlist').includes(id);
    },

    toggleWishlist(id, btnElement = null) {
        let wishlist = db.get('wishlist');
        const index = wishlist.indexOf(id);
        
        if (index > -1) {
            wishlist.splice(index, 1);
            showToast('Removed from wishlist');
            if(btnElement) {
                btnElement.classList.remove('active');
                btnElement.querySelector('svg').setAttribute('fill', 'none');
                btnElement.querySelector('svg').setAttribute('stroke', 'currentColor');
            }
        } else {
            wishlist.push(id);
            showToast('Added to wishlist');
            if(btnElement) {
                btnElement.classList.add('active');
                btnElement.querySelector('svg').setAttribute('fill', 'currentColor');
                btnElement.querySelector('svg').setAttribute('stroke', 'var(--danger)');
            }
        }
        
        db.set('wishlist', wishlist);
        this.updateWishlistCount();
        
        if (this.currentPage === 'wishlist') {
            this.navigate('wishlist'); // re-render
        }
    },

    updateWishlistCount() {
        document.getElementById('wishlist-count').textContent = db.get('wishlist').length;
    },

    togglePaymentInfo() {
        const method = document.getElementById('co-payment').value;
        const infoDiv = document.getElementById('payment-instructions');
        const numberSpan = document.getElementById('payment-number');
        const settings = db.getSettings();

        if (method === 'cod') {
            infoDiv.classList.add('hidden');
            document.getElementById('co-trxid').removeAttribute('required');
        } else {
            infoDiv.classList.remove('hidden');
            document.getElementById('co-trxid').setAttribute('required', 'true');
            if (method === 'bkash') numberSpan.textContent = settings.bkash;
            if (method === 'nagad') numberSpan.textContent = settings.nagad;
            if (method === 'rocket') numberSpan.textContent = settings.rocket;
        }
    },

    updateCheckoutTotal() {
        const cart = db.get('cart');
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const settings = db.getSettings();
        
        let deliveryFee = 0;
        if (subtotal < settings.freeDeliveryThreshold) {
            const method = document.getElementById('co-delivery').value;
            if (method === 'inside') deliveryFee = parseInt(settings.deliveryInside);
            if (method === 'outside') deliveryFee = parseInt(settings.deliveryOutside);
            if (method === 'express') deliveryFee = parseInt(settings.deliveryExpress);
        }

        const total = subtotal + deliveryFee;
        
        document.getElementById('summary-delivery').textContent = deliveryFee === 0 ? 'Free' : formatMoney(deliveryFee);
        document.getElementById('summary-total').textContent = formatMoney(total);
    },

    renderSuccess(params = {}) {
        return `
            <div class="container mt-2 mb-2 text-center">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" style="margin:0 auto 1rem;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                <h1>Order Placed Successfully!</h1>
                ${params.orderId ? `<p class="mt-1">Your order ID is <strong>${params.orderId}</strong></p>` : `<p class="mt-1">Thank you for your order.</p>`}
                <p>We will contact you shortly to confirm your order.</p>
                <button class="btn btn-accent mt-2" onclick="app.navigate('home')">Continue Shopping</button>
            </div>
        `;
    },

    placeOrder(e) {
        e.preventDefault();
        const cart = db.get('cart');
        if (cart.length === 0) return;

        const settings = db.getSettings();
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        
        let deliveryFee = 0;
        const deliveryMethod = document.getElementById('co-delivery').value;
        if (subtotal < settings.freeDeliveryThreshold) {
            if (deliveryMethod === 'inside') deliveryFee = parseInt(settings.deliveryInside);
            if (deliveryMethod === 'outside') deliveryFee = parseInt(settings.deliveryOutside);
            if (deliveryMethod === 'express') deliveryFee = parseInt(settings.deliveryExpress);
        }

        const rawOrderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
        const order = {
            id: rawOrderId,
            displayId: rawOrderId,
            date: new Date().toISOString(),
            customer: {
                name: document.getElementById('co-name').value,
                phone: document.getElementById('co-phone').value,
                email: document.getElementById('co-email').value,
                address: document.getElementById('co-address').value,
                district: document.getElementById('co-district').value,
                postal: document.getElementById('co-postal').value
            },
            items: cart,
            subtotal: subtotal,
            deliveryFee: deliveryFee,
            total: subtotal + deliveryFee,
            deliveryMethod: deliveryMethod,
            paymentMethod: document.getElementById('co-payment').value,
            trxId: document.getElementById('co-trxid') ? document.getElementById('co-trxid').value : '',
            status: 'Pending'
        };

        db.add('orders', order);
        db.set('cart', []); // clear cart
        this.updateCartCount();
        
        this.navigate('success', { orderId: order.id });
    },

    trackOrder() {
        const id = document.getElementById('track-id').value.trim();
        const resultDiv = document.getElementById('track-result');
        
        if (!id) return;

        const order = db.get('orders').find(o => o.id === id);
        
        resultDiv.style.display = 'block';
        if (order) {
            resultDiv.innerHTML = `
                <h3>Order Status: <span style="color:var(--accent);">${order.status}</span></h3>
                <p class="mt-1">Date: ${new Date(order.date).toLocaleDateString()}</p>
                <p>Total: ${formatMoney(order.total)}</p>
                <p>Items: ${order.items.length}</p>
            `;
        } else {
            resultDiv.innerHTML = `<p style="color:var(--danger);">Order not found. Please check your Order ID.</p>`;
        }
    },

    populateFooter() {
        const settings = db.getSettings();
        document.getElementById('footer-phone').textContent = `Phone: ${settings.phone}`;
        document.getElementById('footer-email').textContent = `Email: ${settings.email}`;
        document.getElementById('footer-address').textContent = `Address: ${settings.address}`;
        
        const footerAbout = document.getElementById('footer-about');
        if (footerAbout) footerAbout.textContent = settings.footerAbout || 'Wear Your Style. Premium clothing for the modern Bangladeshi.';
        
        const footerStoreName = document.getElementById('footer-store-name');
        if (footerStoreName) footerStoreName.textContent = settings.storeName || 'FIT MY FABRICS';
    }
};

// Export app to window for inline HTML event handlers
window.app = app;

// Initialize app on load (Base UI rendered before DB sync finishes)
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
