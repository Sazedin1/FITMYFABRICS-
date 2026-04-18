// admin.js - Admin Dashboard Logic

const adminApp = {
    currentUser: null,
    tempImages: [], // Store base64 images temporarily during product/category edit
    tempAppearance: { hero: '', logo: '' },

    init() {
        this.checkAuth();
    },

    checkAuth() {
        const session = sessionStorage.getItem('fmf_admin_session');
        if (session) {
            this.currentUser = JSON.parse(session);
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('admin-layout').classList.remove('hidden');
            this.navigate('dashboard', document.querySelector('.admin-nav a'));
        } else {
            document.getElementById('login-screen').classList.remove('hidden');
            document.getElementById('admin-layout').classList.add('hidden');
        }
    },

    login(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;

        // Master Admin check
        if (email === 'admin@fitmyfabrics.com' && pass === 'Sagor22777@') {
            this.setSession({ email, role: 'master', name: 'Master Admin' });
            return;
        }

        // Check local admins
        const admins = db.get('admins');
        const user = admins.find(a => a.email === email && a.password === pass);
        if (user) {
            this.setSession({ email: user.email, role: user.role, name: user.name });
        } else {
            showToast('Invalid credentials', 'error');
        }
    },

    setSession(user) {
        sessionStorage.setItem('fmf_admin_session', JSON.stringify(user));
        this.checkAuth();
        showToast('Login successful');
    },

    logout() {
        sessionStorage.removeItem('fmf_admin_session');
        this.checkAuth();
    },

    navigate(page, navElement) {
        // Update active nav
        if (navElement) {
            document.querySelectorAll('.admin-nav a').forEach(el => el.classList.remove('active'));
            navElement.classList.add('active');
        }

        const content = document.getElementById('admin-content');
        
        switch(page) {
            case 'dashboard':
                content.innerHTML = this.renderDashboard();
                break;
            case 'products':
                content.innerHTML = this.renderProducts();
                break;
            case 'categories':
                content.innerHTML = this.renderCategories();
                break;
            case 'orders':
                content.innerHTML = this.renderOrders();
                break;
            case 'customers':
                content.innerHTML = this.renderCustomers();
                break;
            case 'appearance':
                const sApp = db.getSettings();
                this.tempAppearance = {
                    hero: sApp.heroImage || '',
                    logo: sApp.storeLogo || ''
                };
                content.innerHTML = this.renderAppearance();
                break;
            case 'settings':
                content.innerHTML = this.renderSettings();
                break;
        }
    },

    // --- Dashboard ---

    renderDashboard() {
        const products = db.get('products');
        const orders = db.get('orders');
        
        const totalRev = orders.filter(o => o.status !== 'Cancelled').reduce((sum, o) => sum + o.total, 0);
        const pendingOrders = orders.filter(o => o.status === 'Pending').length;
        const lowStock = products.filter(p => p.stock < 5);

        return `
            <div class="admin-header">
                <h2>Dashboard Overview</h2>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-title">Total Products</div>
                    <div class="stat-value">${products.length}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-title">Total Orders</div>
                    <div class="stat-value">${orders.length}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-title">Total Revenue</div>
                    <div class="stat-value">৳${totalRev.toLocaleString('en-IN')}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-title">Pending Orders</div>
                    <div class="stat-value" style="color:var(--danger);">${pendingOrders}</div>
                </div>
            </div>

            <div style="display:flex; gap:2rem; flex-wrap:wrap;">
                <div style="flex:2; min-width:300px;">
                    <h3 class="mb-1">Recent Orders</h3>
                    <div class="admin-table-wrapper">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>Order ID</th>
                                    <th>Customer</th>
                                    <th>Total</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${orders.slice().reverse().slice(0, 5).map(o => `
                                    <tr>
                                        <td>${o.id}</td>
                                        <td>${o.customer.name}</td>
                                        <td>৳${o.total}</td>
                                        <td><span class="badge-tag ${o.status==='Pending'?'badge-sale':'badge-new'}">${o.status}</span></td>
                                    </tr>
                                `).join('')}
                                ${orders.length === 0 ? '<tr><td colspan="4" class="text-center">No orders yet</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div style="flex:1; min-width:250px;">
                    <h3 class="mb-1">Low Stock Alerts</h3>
                    <div class="admin-table-wrapper">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Stock</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${lowStock.map(p => `
                                    <tr>
                                        <td>${p.name}</td>
                                        <td style="color:var(--danger); font-weight:bold;">${p.stock}</td>
                                    </tr>
                                `).join('')}
                                ${lowStock.length === 0 ? '<tr><td colspan="2" class="text-center">All products well stocked</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    // --- Products ---

    renderProducts() {
        const products = db.get('products');
        const categories = db.get('categories');
        
        // Populate category dropdown in modal
        const catSelect = document.getElementById('p-category');
        catSelect.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

        return `
            <div class="admin-header">
                <h2>Products</h2>
                <button class="btn btn-primary" onclick="adminApp.openProductModal()">Add Product</button>
            </div>
            <div class="admin-table-wrapper">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Image</th>
                            <th>Name</th>
                            <th>Price</th>
                            <th>Stock</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${products.map(p => `
                            <tr>
                                <td><img src="${(p.images && p.images[0]) || ''}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; background:#eee;"></td>
                                <td>${p.name}</td>
                                <td>৳${p.price}</td>
                                <td>${p.stock}</td>
                                <td><span class="badge-tag ${p.status==='Active'?'badge-new':'badge-sale'}">${p.status}</span></td>
                                <td>
                                    <div class="action-btns">
                                        <button class="action-btn edit-btn" onclick="adminApp.openProductModal('${p.id}')">Edit</button>
                                        <button class="action-btn delete-btn" onclick="adminApp.confirmDelete('products', '${p.id}', '${p.name.replace(/'/g, "\\'")}')">Delete</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    openProductModal(id = null) {
        this.tempImages = [];
        document.getElementById('p-image-preview').innerHTML = '';
        document.getElementById('product-form').reset();

        if (id) {
            document.getElementById('product-modal-title').textContent = 'Edit Product';
            const p = db.getOne('products', id);
            document.getElementById('p-id').value = p.id;
            document.getElementById('p-name').value = p.name;
            document.getElementById('p-category').value = p.category;
            document.getElementById('p-price').value = p.price;
            document.getElementById('p-discount').value = p.discountPrice || '';
            document.getElementById('p-stock').value = p.stock;
            document.getElementById('p-sku').value = p.sku;
            document.getElementById('p-desc').value = p.description;
            document.getElementById('p-sizes').value = p.sizes.join(', ');
            document.getElementById('p-colors').value = p.colors.join(', ');
            document.getElementById('p-active').checked = p.status === 'Active';
            document.getElementById('p-featured').checked = p.featured;
            document.getElementById('p-new').checked = p.newArrival;
            
            if (p.images) {
                this.tempImages = [...p.images];
                this.renderImagePreviews('p-image-preview');
            }
        } else {
            document.getElementById('product-modal-title').textContent = 'Add Product';
            document.getElementById('p-id').value = '';
        }

        document.getElementById('product-modal').classList.add('active');
    },

    saveProduct(e) {
        e.preventDefault();
        const id = document.getElementById('p-id').value;
        const product = {
            name: document.getElementById('p-name').value,
            category: document.getElementById('p-category').value,
            price: parseFloat(document.getElementById('p-price').value),
            discountPrice: document.getElementById('p-discount').value ? parseFloat(document.getElementById('p-discount').value) : null,
            stock: parseInt(document.getElementById('p-stock').value),
            sku: document.getElementById('p-sku').value,
            description: document.getElementById('p-desc').value,
            sizes: document.getElementById('p-sizes').value.split(',').map(s => s.trim()).filter(s => s),
            colors: document.getElementById('p-colors').value.split(',').map(s => s.trim()).filter(s => s),
            status: document.getElementById('p-active').checked ? 'Active' : 'Draft',
            featured: document.getElementById('p-featured').checked,
            newArrival: document.getElementById('p-new').checked,
            images: this.tempImages
        };

        if (id) {
            db.update('products', id, product);
            showToast('Product updated');
        } else {
            db.add('products', product);
            showToast('Product added');
        }

        this.closeModal('product-modal');
        this.navigate('products');
    },

    // --- Categories ---

    renderCategories() {
        const categories = db.get('categories');
        return `
            <div class="admin-header">
                <h2>Categories</h2>
                <button class="btn btn-primary" onclick="adminApp.openCategoryModal()">Add Category</button>
            </div>
            <div class="admin-table-wrapper">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Image</th>
                            <th>Name</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${categories.map(c => `
                            <tr>
                                <td><img src="${c.image || ''}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; background:#eee;"></td>
                                <td>${c.name}</td>
                                <td><span class="badge-tag ${c.status==='Active'?'badge-new':'badge-sale'}">${c.status}</span></td>
                                <td>
                                    <div class="action-btns">
                                        <button class="action-btn edit-btn" onclick="adminApp.openCategoryModal('${c.id}')">Edit</button>
                                        <button class="action-btn delete-btn" onclick="adminApp.confirmDelete('categories', '${c.id}', '${c.name.replace(/'/g, "\\'")}')">Delete</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    openCategoryModal(id = null) {
        this.tempImages = [];
        document.getElementById('c-image-preview').innerHTML = '';
        document.getElementById('category-form').reset();

        if (id) {
            document.getElementById('cat-modal-title').textContent = 'Edit Category';
            const c = db.getOne('categories', id);
            document.getElementById('c-id').value = c.id;
            document.getElementById('c-name').value = c.name;
            document.getElementById('c-desc').value = c.description;
            document.getElementById('c-active').checked = c.status === 'Active';
            
            if (c.image) {
                this.tempImages = [c.image];
                this.renderImagePreviews('c-image-preview');
            }
        } else {
            document.getElementById('cat-modal-title').textContent = 'Add Category';
            document.getElementById('c-id').value = '';
        }

        document.getElementById('category-modal').classList.add('active');
    },

    saveCategory(e) {
        e.preventDefault();
        const id = document.getElementById('c-id').value;
        const name = document.getElementById('c-name').value;
        const category = {
            name: name,
            slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            description: document.getElementById('c-desc').value,
            status: document.getElementById('c-active').checked ? 'Active' : 'Hidden',
            image: this.tempImages.length > 0 ? this.tempImages[0] : ''
        };

        if (id) {
            db.update('categories', id, category);
            showToast('Category updated');
        } else {
            db.add('categories', category);
            showToast('Category added');
        }

        this.closeModal('category-modal');
        this.navigate('categories');
    },

    // --- Orders ---

    renderOrders() {
        const orders = db.get('orders');
        return `
            <div class="admin-header">
                <h2>Orders</h2>
            </div>
            <div class="admin-table-wrapper">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Date</th>
                            <th>Customer</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${orders.slice().reverse().map(o => `
                            <tr>
                                <td>${o.id}</td>
                                <td>${new Date(o.date).toLocaleDateString()}</td>
                                <td>${o.customer.name}</td>
                                <td>৳${o.total}</td>
                                <td><span class="badge-tag ${o.status==='Pending'?'badge-sale':'badge-new'}">${o.status}</span></td>
                                <td>
                                    <button class="action-btn edit-btn" onclick="adminApp.openOrderModal('${o.id}')">View</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    openOrderModal(id) {
        const order = db.getOne('orders', id);
        if (!order) return;

        const content = document.getElementById('order-detail-content');
        content.innerHTML = `
            <div style="display:flex; gap:2rem; flex-wrap:wrap;">
                <div style="flex:1; min-width:250px;">
                    <h3>Customer Info</h3>
                    <p><strong>Name:</strong> ${order.customer.name}</p>
                    <p><strong>Phone:</strong> ${order.customer.phone}</p>
                    <p><strong>Email:</strong> ${order.customer.email || 'N/A'}</p>
                    <p><strong>Address:</strong> ${order.customer.address}, ${order.customer.district}</p>
                    
                    <h3 class="mt-1">Payment Info</h3>
                    <p><strong>Method:</strong> ${order.paymentMethod.toUpperCase()}</p>
                    ${order.trxId ? `<p><strong>TrxID:</strong> ${order.trxId}</p>` : ''}
                </div>
                <div style="flex:1; min-width:250px;">
                    <h3>Update Status</h3>
                    <div style="display:flex; gap:0.5rem; margin-top:0.5rem;">
                        <select id="update-order-status" style="flex:1;">
                            <option value="Pending" ${order.status==='Pending'?'selected':''}>Pending</option>
                            <option value="Confirmed" ${order.status==='Confirmed'?'selected':''}>Confirmed</option>
                            <option value="Processing" ${order.status==='Processing'?'selected':''}>Processing</option>
                            <option value="Shipped" ${order.status==='Shipped'?'selected':''}>Shipped</option>
                            <option value="Delivered" ${order.status==='Delivered'?'selected':''}>Delivered</option>
                            <option value="Cancelled" ${order.status==='Cancelled'?'selected':''}>Cancelled</option>
                        </select>
                        <button class="btn btn-primary" onclick="adminApp.updateOrderStatus('${order.id}')">Save</button>
                    </div>
                    <button class="btn btn-outline mt-1" style="width:100%;" onclick="window.print()">Print Invoice</button>
                </div>
            </div>

            <h3 class="mt-2 mb-1">Items</h3>
            <table class="admin-table">
                <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
                <tbody>
                    ${order.items.map(item => `
                        <tr>
                            <td>${item.name} (${item.size}, <span style="display:inline-block;width:10px;height:10px;background:${item.color};border-radius:50%;"></span>)</td>
                            <td>${item.qty}</td>
                            <td>৳${item.price}</td>
                            <td>৳${item.price * item.qty}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div style="text-align:right; margin-top:1rem;">
                <p>Subtotal: ৳${order.subtotal}</p>
                <p>Delivery: ৳${order.deliveryFee}</p>
                <h3 class="mt-1">Grand Total: ৳${order.total}</h3>
            </div>
        `;
        document.getElementById('order-modal').classList.add('active');
    },

    updateOrderStatus(id) {
        const status = document.getElementById('update-order-status').value;
        db.update('orders', id, { status });
        showToast('Order status updated');
        this.closeModal('order-modal');
        this.navigate('orders');
    },

    // --- Customers ---

    renderCustomers() {
        const customers = db.get('customers');
        return `
            <div class="admin-header">
                <h2>Customers</h2>
            </div>
            <div class="admin-table-wrapper">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Joined Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${customers.map(c => `
                            <tr>
                                <td>${c.name}</td>
                                <td>${c.email}</td>
                                <td>${c.phone}</td>
                                <td>${new Date(c.created).toLocaleDateString()}</td>
                            </tr>
                        `).join('')}
                        ${customers.length === 0 ? '<tr><td colspan="4" class="text-center">No customers yet</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        `;
    },

    // --- Appearance ---

    renderAppearance() {
        const s = db.getSettings();
        return `
            <div class="admin-header">
                <h2>Appearance & Theme</h2>
            </div>
            <div style="background:var(--white); padding:2rem; border-radius:8px; max-width:800px;">
                <form onsubmit="adminApp.saveAppearance(event)">
                    <h3>Colors</h3>
                    <div style="display:flex; gap:1rem; flex-wrap:wrap;" class="mt-1">
                        <div class="form-group" style="flex:1;">
                            <label>Primary Color</label>
                            <input type="color" id="a-primary" value="${s.primaryColor || '#1a1a1a'}" style="height:50px; padding:0.25rem;">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Accent Color</label>
                            <input type="color" id="a-accent" value="${s.accentColor || '#c9a84c'}" style="height:50px; padding:0.25rem;">
                        </div>
                    </div>

                    <h3 class="mt-2">Brand Logo</h3>
                    <div class="form-group mt-1">
                        <label>Display Mode</label>
                        <select id="a-logo-mode">
                            <option value="text-only" ${s.logoDisplayMode === 'text-only' ? 'selected' : ''}>Text Only</option>
                            <option value="logo-only" ${s.logoDisplayMode === 'logo-only' ? 'selected' : ''}>Logo Only</option>
                            <option value="logo-text" ${(!s.logoDisplayMode || s.logoDisplayMode === 'logo-text') ? 'selected' : ''}>Logo + Text</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Upload Logo</label>
                        <input type="file" id="a-logo-img" accept="image/*" onchange="adminApp.handleAppImage(event, 'logo', 'a-logo-preview')">
                        <div id="a-logo-preview" class="image-preview-area">
                            ${s.storeLogo ? `<div class="img-preview-box"><img src="${s.storeLogo}"><button type="button" class="remove-img-btn" onclick="adminApp.removeAppImage('logo', 'a-logo-preview')">&times;</button></div>` : ''}
                        </div>
                    </div>

                    <h3 class="mt-2">Header</h3>
                    <div class="form-group mt-1">
                        <label>Top Bar Text</label>
                        <input type="text" id="a-topbar" value="${s.topBarText || 'Free shipping on all orders above ৳999!'}">
                    </div>

                    <h3 class="mt-2">Hero Section (Homepage)</h3>
                    <div class="form-group mt-1">
                        <label>Hero Headline</label>
                        <input type="text" id="a-hero-head" value="${s.heroHeadline || 'Wear Your Style'}">
                    </div>
                    <div class="form-group">
                        <label>Hero Subheadline</label>
                        <input type="text" id="a-hero-sub" value="${s.heroSubheadline || 'Discover the latest trends in Bangladeshi fashion.'}">
                    </div>
                    <div class="form-group">
                        <label>Hero Background Image</label>
                        <input type="file" id="a-hero-img" accept="image/*" onchange="adminApp.handleAppImage(event, 'hero', 'a-hero-preview')">
                        <div id="a-hero-preview" class="image-preview-area">
                            ${s.heroImage ? `<div class="img-preview-box"><img src="${s.heroImage}"><button type="button" class="remove-img-btn" onclick="adminApp.removeAppImage('hero', 'a-hero-preview')">&times;</button></div>` : ''}
                        </div>
                    </div>

                    <h3 class="mt-2">Footer</h3>
                    <div class="form-group mt-1">
                        <label>About Text</label>
                        <textarea id="a-footer-about" rows="3">${s.footerAbout || 'Wear Your Style. Premium clothing for the modern Bangladeshi.'}</textarea>
                    </div>

                    <button type="submit" class="btn btn-primary mt-2">Save Appearance</button>
                </form>
            </div>
        `;
    },

    saveAppearance(e) {
        e.preventDefault();
        const settings = db.getSettings();
        settings.primaryColor = document.getElementById('a-primary').value;
        settings.accentColor = document.getElementById('a-accent').value;
        settings.topBarText = document.getElementById('a-topbar').value;
        settings.heroHeadline = document.getElementById('a-hero-head').value;
        settings.heroSubheadline = document.getElementById('a-hero-sub').value;
        settings.footerAbout = document.getElementById('a-footer-about').value;
        
        settings.heroImage = this.tempAppearance.hero;
        settings.storeLogo = this.tempAppearance.logo;
        settings.logoDisplayMode = document.getElementById('a-logo-mode').value;

        db.setSettings(settings);
        showToast('Appearance saved successfully');
        
        // Update admin colors too
        document.documentElement.style.setProperty('--primary', settings.primaryColor);
        document.documentElement.style.setProperty('--accent', settings.accentColor);
    },

    // --- Settings ---

    renderSettings() {
        const s = db.getSettings();
        return `
            <div class="admin-header">
                <h2>Site Settings</h2>
            </div>
            <div style="background:var(--white); padding:2rem; border-radius:8px; max-width:800px;">
                <form onsubmit="adminApp.saveSettings(event)">
                    <h3 class="mt-2">Site Status</h3>
                    <div class="form-group mt-1">
                        <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                            <input type="checkbox" id="s-maintenance" ${s.maintenanceMode ? 'checked' : ''} style="width:auto;">
                            <strong>Enable Maintenance Mode</strong>
                        </label>
                        <small style="color:var(--text-light); display:block; margin-top:0.25rem;">When enabled, customers will see a maintenance screen. Admin dashboard remains accessible.</small>
                    </div>

                    <h3 class="mt-2">General</h3>
                    <div class="form-group mt-1"><label>Store Name</label><input type="text" id="s-name" value="${s.storeName}"></div>
                    <div class="form-group"><label>Tagline</label><input type="text" id="s-tagline" value="${s.tagline}"></div>
                    
                    <h3 class="mt-2">Contact Info</h3>
                    <div style="display:flex; gap:1rem; flex-wrap:wrap;" class="mt-1">
                        <div class="form-group" style="flex:1;"><label>Phone</label><input type="text" id="s-phone" value="${s.phone}"></div>
                        <div class="form-group" style="flex:1;"><label>Email</label><input type="email" id="s-email" value="${s.email}"></div>
                    </div>
                    <div class="form-group"><label>Address</label><textarea id="s-address">${s.address}</textarea></div>

                    <h3 class="mt-2">Payment Numbers</h3>
                    <div style="display:flex; gap:1rem; flex-wrap:wrap;" class="mt-1">
                        <div class="form-group" style="flex:1;"><label>bKash</label><input type="text" id="s-bkash" value="${s.bkash}"></div>
                        <div class="form-group" style="flex:1;"><label>Nagad</label><input type="text" id="s-nagad" value="${s.nagad}"></div>
                        <div class="form-group" style="flex:1;"><label>Rocket</label><input type="text" id="s-rocket" value="${s.rocket}"></div>
                    </div>

                    <h3 class="mt-2">Delivery Charges (৳)</h3>
                    <div style="display:flex; gap:1rem; flex-wrap:wrap;" class="mt-1">
                        <div class="form-group" style="flex:1;"><label>Inside Dhaka</label><input type="number" id="s-del-in" value="${s.deliveryInside}"></div>
                        <div class="form-group" style="flex:1;"><label>Outside Dhaka</label><input type="number" id="s-del-out" value="${s.deliveryOutside}"></div>
                        <div class="form-group" style="flex:1;"><label>Express</label><input type="number" id="s-del-exp" value="${s.deliveryExpress}"></div>
                        <div class="form-group" style="flex:1;"><label>Free Delivery Above</label><input type="number" id="s-del-free" value="${s.freeDeliveryThreshold}"></div>
                    </div>

                    <h3 class="mt-2">Mail Configuration (For OTP)</h3>
                    <div style="display:flex; gap:1rem; flex-wrap:wrap;" class="mt-1">
                        <div class="form-group" style="flex:1;">
                            <label>Mail Provider</label>
                            <select id="s-mail-provider">
                                <option value="simulation" ${s.mailProvider==='simulation'?'selected':''}>Simulation (Show OTP in Toast)</option>
                                <option value="emailjs" ${s.mailProvider==='emailjs'?'selected':''}>EmailJS</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex:1;"><label>Service ID</label><input type="text" id="s-mail-service" value="${s.mailServiceId || ''}"></div>
                        <div class="form-group" style="flex:1;"><label>Template ID</label><input type="text" id="s-mail-template" value="${s.mailTemplateId || ''}"></div>
                        <div class="form-group" style="flex:1;"><label>Public Key</label><input type="text" id="s-mail-public" value="${s.mailPublicKey || ''}"></div>
                    </div>

                    <button type="submit" class="btn btn-primary mt-2">Save Settings</button>
                </form>
            </div>
        `;
    },

    saveSettings(e) {
        e.preventDefault();
        const settings = {
            storeName: document.getElementById('s-name').value,
            tagline: document.getElementById('s-tagline').value,
            phone: document.getElementById('s-phone').value,
            email: document.getElementById('s-email').value,
            address: document.getElementById('s-address').value,
            bkash: document.getElementById('s-bkash').value,
            nagad: document.getElementById('s-nagad').value,
            rocket: document.getElementById('s-rocket').value,
            deliveryInside: parseInt(document.getElementById('s-del-in').value),
            deliveryOutside: parseInt(document.getElementById('s-del-out').value),
            deliveryExpress: parseInt(document.getElementById('s-del-exp').value),
            freeDeliveryThreshold: parseInt(document.getElementById('s-del-free').value),
            facebook: '#', instagram: '#', whatsapp: '#',
            mailProvider: document.getElementById('s-mail-provider').value,
            mailServiceId: document.getElementById('s-mail-service').value,
            mailTemplateId: document.getElementById('s-mail-template').value,
            mailPublicKey: document.getElementById('s-mail-public').value,
            maintenanceMode: document.getElementById('s-maintenance').checked
        };
        db.setSettings(settings);
        showToast('Settings saved successfully');
    },

    // --- Utilities ---

    closeModal(id) {
        document.getElementById(id).classList.remove('active');
    },

    confirmDelete(table, id, name) {
        document.getElementById('delete-msg').textContent = `Are you sure you want to delete "${name}"?`;
        const btn = document.getElementById('confirm-delete-btn');
        btn.onclick = () => {
            db.delete(table, id);
            showToast('Item deleted successfully');
            this.closeModal('delete-modal');
            this.navigate(table);
        };
        document.getElementById('delete-modal').classList.add('active');
    },

    async handleImageUpload(e, previewContainerId) {
        const files = e.target.files;
        for (let i = 0; i < files.length; i++) {
            const base64 = await compressImage(files[i]);
            this.tempImages.push(base64);
        }
        this.renderImagePreviews(previewContainerId);
        e.target.value = ''; // reset input
    },

    async handleSingleImageUpload(e, previewContainerId) {
        const file = e.target.files[0];
        if (file) {
            const base64 = await compressImage(file);
            this.tempImages = [base64];
            this.renderImagePreviews(previewContainerId);
        }
        e.target.value = '';
    },

    renderImagePreviews(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = this.tempImages.map((img, index) => `
            <div class="img-preview-box">
                <img src="${img}">
                <button type="button" class="remove-img-btn" onclick="adminApp.removeTempImage(${index}, '${containerId}')">&times;</button>
            </div>
        `).join('');
    },

    removeTempImage(index, containerId) {
        this.tempImages.splice(index, 1);
        this.renderImagePreviews(containerId);
    },

    async handleAppImage(e, type, previewId) {
        const file = e.target.files[0];
        if (file) {
            const base64 = await compressImage(file);
            this.tempAppearance[type] = base64;
            document.getElementById(previewId).innerHTML = `
                <div class="img-preview-box">
                    <img src="${base64}">
                    <button type="button" class="remove-img-btn" onclick="adminApp.removeAppImage('${type}', '${previewId}')">&times;</button>
                </div>
            `;
        }
        e.target.value = '';
    },

    removeAppImage(type, previewId) {
        this.tempAppearance[type] = '';
        document.getElementById(previewId).innerHTML = '';
    }
};

window.adminApp = adminApp;

// document.addEventListener('DOMContentLoaded', () => {
//     adminApp.init();
// });
