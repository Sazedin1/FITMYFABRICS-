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
            this.updateSidebar();
            
            // Initialize tracker for active admin
            if (window.tracker) {
                window.tracker.init({
                    userType: 'admin',
                    userId: this.currentUser.email || 'admin@fitmyfabrics.com',
                    userName: this.currentUser.name || 'Admin',
                    userRole: this.currentUser.role || 'master'
                });
            }

            this.navigate('dashboard', document.querySelector('.admin-nav a[data-page="dashboard"]'));
        } else {
            document.getElementById('login-screen').classList.remove('hidden');
            document.getElementById('admin-layout').classList.add('hidden');
        }
    },

    updateSidebar() {
        const links = document.querySelectorAll('.admin-nav a[data-page]');
        links.forEach(link => {
            const page = link.getAttribute('data-page');
            if (page === 'dashboard') {
                link.parentElement.style.display = 'block';
                return;
            }
            if (this.currentUser.role === 'master' || (this.currentUser.access && this.currentUser.access.includes(page))) {
                link.parentElement.style.display = 'block';
            } else {
                link.parentElement.style.display = 'none';
            }
        });
        
        const staffLink = document.getElementById('nav-staff');
        if (staffLink) {
            if (this.currentUser.role === 'master') {
                staffLink.style.display = 'block';
            } else {
                staffLink.style.display = 'none';
            }
        }
    },

    login(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;

        // Master Admin check
        const settings = db.getSettings();
        const masterPass = settings.masterPassword || 'Sagor22777@';
        if (email === 'admin@fitmyfabrics.com' && pass === masterPass) {
            this.setSession({ email, role: 'master', name: 'Master Admin' });
            return;
        }

        // Check local admins
        const admins = db.get('admins');
        const user = admins.find(a => a.email === email && a.password === pass);
        if (user) {
            this.setSession({ email: user.email, role: user.role, name: user.name, access: user.access || [] });
        } else {
            showToast('Invalid credentials', 'error');
        }
    },

    setSession(user) {
        sessionStorage.setItem('fmf_admin_session', JSON.stringify(user));
        
        if (window.tracker) {
            window.tracker.startSession({
                userType: 'admin',
                userId: user.email || 'admin@fitmyfabrics.com',
                userName: user.name || 'Admin',
                userRole: user.role || 'master'
            }).then(() => {
                window.tracker.startHeartbeat();
            });
        }

        this.checkAuth();
        showToast('Login successful');
    },

    logout() {
        if (window.tracker) {
            window.tracker.endSession('Admin Clicked Logout');
        }
        sessionStorage.removeItem('fmf_admin_session');
        this.checkAuth();
    },

    navigate(page, navElement, track = true) {
        if (!this.currentUser) return;
        
        // Enforce RBAC (Role-Based Access Control)
        if (page !== 'dashboard' && this.currentUser.role !== 'master') {
            if (!this.currentUser.access || !this.currentUser.access.includes(page)) {
                showToast('Access denied', 'error');
                return;
            }
        }

        this.currentRoute = page;
        if (track && window.tracker) {
            window.tracker.logAction(`Admin Navigated to ${page.toUpperCase()}`, page);
        }

        // Update active nav
        if (navElement) {
            document.querySelectorAll('.admin-nav a').forEach(el => el.classList.remove('active'));
            navElement.classList.add('active');
        }

        const content = document.getElementById('admin-content');
        if (!content) return;
        
        switch(page) {
            case 'staff':
                content.innerHTML = this.renderStaff();
                break;
            case 'dashboard':
                content.innerHTML = this.renderDashboard();
                break;
            case 'products':
                content.innerHTML = this.renderProducts();
                break;
            case 'categories':
                content.innerHTML = this.renderCategories();
                break;
            case 'coupons':
                content.innerHTML = this.renderCoupons();
                break;
            case 'orders':
                content.innerHTML = this.renderOrders();
                break;
            case 'accounting':
                content.innerHTML = this.renderAccounting();
                break;
            case 'customers':
                content.innerHTML = this.renderCustomers();
                break;
            case 'sessions':
                content.innerHTML = this.renderSessions();
                break;
            case 'archive':
                content.innerHTML = this.renderArchive();
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

    renderCurrentViewSilent() {
        if (!this.currentUser || !this.currentRoute) return;
        // Skip silent refresh if user is currently editing a form or modal
        if (document.querySelector('.modal.active') || document.querySelector('.modal[style*="display: flex"]') || document.querySelector('.modal[style*="display: block"]')) {
            return;
        }
        this.navigate(this.currentRoute, null, false);
    },

    // --- Dashboard ---

    renderDashboard() {
        if (window.isAppInitialized && !window.isAppInitialized()) {
            return `<div style="text-align:center; padding: 3rem;">
                        <h3>Syncing data from database... Please wait...</h3>
                    </div>`;
        }
        
        const products = db.get('products');
        const orders = db.get('orders');
        
        const totalRev = orders.filter(o => o.status !== 'Cancelled').reduce((sum, o) => sum + o.total, 0);
        const pendingOrders = orders.filter(o => o.status === 'Pending').length;
        const lowStock = products.filter(p => p.stock < 5);
        const totalQuantity = products.reduce((sum, p) => sum + (p.stock || 0), 0);
        
        const sessions = db.get('sessions') || [];
        const now = Date.now();
        const activeOnline = sessions.filter(s => s.status === 'active' && (now - new Date(s.lastActiveAt || s.loginAt).getTime() < 180000)).length;

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
                    <div class="stat-title">Total Quantity</div>
                    <div class="stat-value">${totalQuantity}</div>
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
                <div class="stat-card" style="cursor:pointer; border-left: 3px solid #16a34a;" onclick="adminApp.navigate('sessions', document.querySelector('.admin-nav a[data-page=\\'sessions\\']'))">
                    <div class="stat-title">🟢 Active Online Now</div>
                    <div class="stat-value" style="color:#16a34a;">${activeOnline} <span style="font-size:0.8rem; font-weight:normal; color:var(--text-light);">View Logs &rarr;</span></div>
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
        if (window.isAppInitialized && !window.isAppInitialized()) {
            return `<div style="text-align:center; padding: 3rem;">
                        <h3>Syncing data from database... Please wait...</h3>
                    </div>`;
        }

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
            document.getElementById('p-cost').value = p.costPrice || '';
            document.getElementById('p-discount').value = p.discountPrice || '';
            document.getElementById('p-stock').value = p.stock;
            document.getElementById('p-sku').value = p.sku;
            document.getElementById('p-desc').value = p.description;
            
            const sizeRows = document.getElementById('p-size-rows');
            sizeRows.innerHTML = '';
            
            // Legacy mapping if p.sizeStock doesn't exist but p.sizes does
            if (!p.sizeStock && p.sizes && p.sizes.length > 0) {
                p.sizeStock = {};
                // distribute stock roughly
                let distStock = Math.floor(p.stock / p.sizes.length);
                p.sizes.forEach(sz => p.sizeStock[sz] = distStock);
            }
            
            if (p.sizeStock && Object.keys(p.sizeStock).length > 0) {
                Object.entries(p.sizeStock).forEach(([sz, st]) => {
                    this.addSizeRow(sz, st);
                });
            } else if (p.sizes && p.sizes.length > 0) {
                p.sizes.forEach(sz => this.addSizeRow(sz, 0));
            } else {
                 // No sizes, just a generic stock
            }

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
            document.getElementById('p-size-rows').innerHTML = '';
        }

        document.getElementById('product-modal').classList.add('active');
    },

    addSizeRow(sizeName = '', currentStock = 0) {
        const container = document.getElementById('p-size-rows');
        const row = document.createElement('div');
        row.className = 'size-row mt-1';
        row.style.cssText = 'display:flex; gap:1rem; align-items:center; margin-bottom:0.5rem;';
        
        row.innerHTML = `
            <input type="text" class="size-name" value="${sizeName}" placeholder="e.g. M" style="flex:2;" required>
            <input type="number" class="size-current-stock" value="${currentStock}" disabled style="flex:1; background:#f0f0f0;">
            <input type="number" class="size-add-stock" value="0" placeholder="Add/Remove" style="flex:1;" onchange="adminApp.calcTotalStock()">
            <button type="button" class="btn btn-outline" style="border-color:var(--danger); color:var(--danger); padding:0.5rem;" onclick="this.parentElement.remove(); adminApp.calcTotalStock();">&times;</button>
        `;
        container.appendChild(row);
        this.calcTotalStock();
    },

    calcTotalStock() {
        const rows = document.querySelectorAll('.size-row');
        let total = 0;
        rows.forEach(r => {
            const current = parseInt(r.querySelector('.size-current-stock').value) || 0;
            const add = parseInt(r.querySelector('.size-add-stock').value) || 0;
            const newStock = Math.max(0, current + add);
            total += newStock;
        });
        document.getElementById('p-stock').value = total;
    },

    saveProduct(e) {
        e.preventDefault();
        const id = document.getElementById('p-id').value;
        
        // Grab sizes
        const sizeRows = document.querySelectorAll('.size-row');
        let sizes = [];
        let sizeStock = {};
        
        sizeRows.forEach(row => {
            const szName = row.querySelector('.size-name').value.trim();
            const current = parseInt(row.querySelector('.size-current-stock').value) || 0;
            const add = parseInt(row.querySelector('.size-add-stock').value) || 0;
            const newStk = Math.max(0, current + add);
            
            if (szName) {
                sizes.push(szName);
                sizeStock[szName] = newStk;
            }
        });

        const product = {
            name: document.getElementById('p-name').value,
            category: document.getElementById('p-category').value,
            price: parseFloat(document.getElementById('p-price').value),
            costPrice: document.getElementById('p-cost').value ? parseFloat(document.getElementById('p-cost').value) : null,
            discountPrice: document.getElementById('p-discount').value ? parseFloat(document.getElementById('p-discount').value) : null,
            stock: parseInt(document.getElementById('p-stock').value) || 0,
            sku: document.getElementById('p-sku').value,
            description: document.getElementById('p-desc').value,
            sizes: sizes,
            sizeStock: sizeStock,
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
        if (window.isAppInitialized && !window.isAppInitialized()) {
            return `<div style="text-align:center; padding: 3rem;">
                        <h3>Syncing data from database... Please wait...</h3>
                    </div>`;
        }

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
            document.getElementById('c-coming-soon').checked = !!c.comingSoon;
            
            if (c.image) {
                this.tempImages = [c.image];
                this.renderImagePreviews('c-image-preview');
            }
        } else {
            document.getElementById('cat-modal-title').textContent = 'Add Category';
            document.getElementById('c-id').value = '';
            document.getElementById('c-coming-soon').checked = false;
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
            comingSoon: document.getElementById('c-coming-soon').checked,
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

    // --- Coupons ---

    renderCoupons() {
        const coupons = db.get('coupons');
        return `
            <div class="admin-header">
                <h2>Promo Codes</h2>
                <button class="btn btn-primary" onclick="adminApp.openCouponModal()">+ Add New Coupon</button>
            </div>
            <div class="table-container mt-2">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Discount</th>
                            <th>Min Spend</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${coupons.map(c => `
                            <tr>
                                <td><strong>${c.code}</strong></td>
                                <td>${c.type === 'percent' ? c.value + '%' : '৳' + c.value}</td>
                                <td>${c.minSpend ? '৳' + c.minSpend : 'None'}</td>
                                <td>
                                    <button class="btn btn-outline btn-sm action-btn" onclick="adminApp.editCoupon('${c.id}')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
                                    <button class="btn btn-outline btn-sm action-btn" style="color:var(--danger); border-color:var(--danger);" onclick="adminApp.confirmDelete('coupons', '${c.id}', '${c.code}')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                                </td>
                            </tr>
                        `).join('')}
                        ${coupons.length === 0 ? '<tr><td colspan="4" style="text-align:center;">No coupons found</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        `;
    },

    openCouponModal(id = null) {
        document.getElementById('coupon-form').reset();
        document.getElementById('co-id').value = '';
        document.getElementById('coupon-modal-title').textContent = 'Add Coupon';
        
        if (id) {
            const c = db.getOne('coupons', id);
            if (c) {
                document.getElementById('coupon-modal-title').textContent = 'Edit Coupon';
                document.getElementById('co-id').value = c.id;
                document.getElementById('co-code').value = c.code;
                document.getElementById('co-type').value = c.type;
                document.getElementById('co-value').value = c.value;
                document.getElementById('co-min').value = c.minSpend || '';
            }
        }
        document.getElementById('coupon-modal').classList.add('active');
    },

    editCoupon(id) {
        this.openCouponModal(id);
    },

    saveCoupon(e) {
        e.preventDefault();
        const id = document.getElementById('co-id').value;
        const code = document.getElementById('co-code').value.toUpperCase().trim();
        const minValStr = document.getElementById('co-min').value;
        
        if(!code) { showToast('Code is required', 'error'); return; }

        const coupon = {
            code: code,
            type: document.getElementById('co-type').value,
            value: parseFloat(document.getElementById('co-value').value),
            minSpend: minValStr ? parseFloat(minValStr) : null
        };

        if (id) {
            db.update('coupons', id, coupon);
            showToast('Coupon updated');
        } else {
            // Check duplicate
            const existing = db.get('coupons').find(c => c.code === code);
            if(existing) {
                showToast('Coupon code already exists', 'error');
                return;
            }
            db.add('coupons', coupon);
            showToast('Coupon added');
        }

        this.closeModal('coupon-modal');
        this.navigate('coupons');
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
                                    <div class="action-btns">
                                        <button class="action-btn edit-btn" onclick="adminApp.openOrderModal('${o.id}')">View</button>
                                        <button class="action-btn delete-btn" onclick="adminApp.confirmDelete('orders', '${o.id}', 'Order ${o.id}')">Delete</button>
                                    </div>
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
        
        let customerHtml = `
            <h3>Customer Info</h3>
            <p><strong>Name:</strong> ${order.customer.name}</p>
            <p><strong>Phone:</strong> ${order.customer.phone}</p>
            <p><strong>Email:</strong> ${order.customer.email || 'N/A'}</p>
            <p><strong>Address:</strong> ${order.customer.address}</p>
            <p><strong>District:</strong> ${order.customer.district}</p>
        `;

        if (order.isGift && order.giftDetails) {
            customerHtml += `
                <h3 class="mt-1" style="color:var(--accent);">🎁 Gift Delivery Info</h3>
                <p><strong>Recipient Name:</strong> ${order.giftDetails.name}</p>
                <p><strong>Recipient Phone:</strong> ${order.giftDetails.phone}</p>
                <p><strong>Recipient Address:</strong> ${order.giftDetails.address}</p>
                <p><strong>Recipient District:</strong> ${order.giftDetails.district}</p>
            `;
        }

        content.innerHTML = `
            <div id="print-area">
                <div style="display:flex; justify-content:space-between; border-bottom:2px solid #eee; padding-bottom:1rem; margin-bottom:1rem;">
                    <div><h2>INVOICE</h2><p>Order ID: ${order.displayId || order.id}</p><p>Date: ${new Date(order.date).toLocaleDateString()}</p></div>
                    <div style="text-align:right;"><h3>FIT MY FABRICS</h3><p>Status: <strong>${order.status}</strong></p></div>
                </div>
                <div style="display:flex; gap:2rem; flex-wrap:wrap;">
                    <div style="flex:1; min-width:250px;">
                        ${customerHtml}
                        
                        <h3 class="mt-1">Payment Info</h3>
                        <p><strong>Method:</strong> ${order.paymentMethod.toUpperCase()}</p>
                        ${order.trxId ? `<p><strong>TrxID:</strong> ${order.trxId}</p>` : ''}
                    </div>
                    <div style="flex:1; min-width:250px;" class="no-print">
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
                        <button class="btn btn-outline mt-1" style="width:100%;" onclick="adminApp.downloadInvoice('${order.id}')">Download PDF Invoice</button>
                    </div>
                </div>

                <h3 class="mt-2 mb-1">Items</h3>
                <table class="admin-table">
                    <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
                    <tbody>
                        ${order.items.map(item => `
                            <tr>
                                <td>${item.name} (${item.size || 'Standard'}, <span style="display:inline-block;width:10px;height:10px;background:${item.color || '#ccc'};border-radius:50%;"></span>)</td>
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
                    ${order.discount ? `<p style="color:var(--danger)">Discount (${order.promoCode}): -৳${order.discount}</p>` : ''}
                    <h3 class="mt-1">Grand Total: ৳${order.total}</h3>
                </div>
            </div>
        `;
        document.getElementById('order-modal').classList.add('active');
    },

    downloadInvoice(id) {
        const order = db.getOne('orders', id);
        if(!order) return;
        
        const printArea = document.getElementById('print-area');
        const noPrintElements = printArea.querySelectorAll('.no-print');
        
        // Hide no-print elements
        noPrintElements.forEach(el => el.style.display = 'none');
        
        const opt = {
            margin:       10,
            filename:     'Invoice_' + (order.displayId || order.id) + '.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        showToast('Generating PDF...');
        html2pdf().set(opt).from(printArea).save().then(() => {
            // Restore no-print elements
            noPrintElements.forEach(el => el.style.display = '');
        });
    },

    async updateOrderStatus(id) {
        const order = db.getOne('orders', id);
        if(!order) return;
        
        const status = document.getElementById('update-order-status').value;
        db.update('orders', id, { status });
        
        if (order.customer && order.customer.email && order.status !== status) {
            const alertMsg = `Your order status has been updated to: ${status}.`;
            await this.dispatchEmail(order.customer.email, {
                order: order,
                statusAlert: alertMsg
            }, "Order Status Update: " + order.displayId, true);
        }
        
        showToast('Order status updated');
        this.closeModal('order-modal');
        this.navigate('orders');
    },

    async dispatchEmail(email, messageOrData, purpose, isOrderUpdate = true) {
        const settings = db.getSettings();
        const serviceId = (settings.mailServiceId || '').trim();
        const otpTemplateId = (settings.mailTemplateId || '').trim();
        const orderTemplateId = (settings.mailOrderTemplateId || '').trim();
        const publicKey = (settings.mailPublicKey || '').trim();

        const templateId = isOrderUpdate ? (orderTemplateId || otpTemplateId) : otpTemplateId;

        if (settings.mailProvider !== 'emailjs' || !serviceId || !templateId || !publicKey) {
            console.log('EmailJS credentials missing or disabled. Check settings.');
            return false;
        }

        let params = {
            to_email: email,
            purpose: purpose,
            otp_code: isOrderUpdate ? '' : messageOrData,
            message: isOrderUpdate && typeof messageOrData === 'string' ? messageOrData : ''
        };

        if (isOrderUpdate && typeof messageOrData === 'object') {
            const o = messageOrData.order;
            params.status_alert = messageOrData.statusAlert;
            params.order_id = o.displayId;
            params.customer_name = o.customer.name;
            params.customer_address = o.customer.address;
            params.subtotal = o.subtotal || 0;
            params.delivery_fee = o.deliveryFee || 0;
            params.discount_html = (o.discount && o.discount > 0) ? `
        <tr>
          <td style="padding-bottom: 5px; color: #d32f2f;">Discount (${o.promoCode}):</td>
          <td style="padding-bottom: 5px; color: #d32f2f;">- BDT ${o.discount}</td>
        </tr>` : '';
            params.total_amount = o.total;
            params.items_html = o.items.map(i => `${i.qty}x ${i.name} - BDT ${i.price * i.qty}`).join('<br>');
        }

        try {
            const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service_id: serviceId,
                    template_id: templateId,
                    user_id: publicKey,
                    template_params: params
                })
            });

            if (res.ok) {
                console.log('Email sent successfully!');
                return true;
            } else {
                const text = await res.text();
                console.error('EmailJS error:', text);
                alert("EmailJS Failed: " + text + "\n\nPlease check EmailJS settings in Admin Panel -> Settings.");
                return false;
            }
        } catch (error) {
            console.error('Email dispatch failed:', error);
            alert("Network error while calling EmailJS.");
            return false;
        }
    },

    // --- Accounting & Reports ---
    renderAccounting() {
        const orders = db.get('orders');
        const products = db.get('products');
        
        let totalRevenue = 0;
        let totalCost = 0;
        let totalDelivered = 0;

        orders.forEach(o => {
            if (o.status === 'Delivered') {
                totalDelivered++;
                totalRevenue += (o.total || 0);

                o.items.forEach(item => {
                    const productObj = products.find(p => p.id === item.id);
                    // Use product's current costPrice, fallback to 0 if not set
                    const itemCost = productObj && productObj.costPrice ? Number(productObj.costPrice) : 0;
                    totalCost += (itemCost * item.qty);
                });
            }
        });

        const grossProfit = totalRevenue - totalCost;
        const stockValuation = products.reduce((sum, p) => sum + ((p.stock || 0) * (p.costPrice || 0)), 0);

        return `
            <div class="admin-header">
                <h2>Accounting & Profit/Loss</h2>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-title">Gross Revenue (Delivered)</div>
                    <div class="stat-value">৳${totalRevenue.toLocaleString('en-IN')}</div>
                    <div style="font-size:0.875rem; color:var(--text-light); margin-top:0.5rem;">From ${totalDelivered} orders</div>
                </div>
                <div class="stat-card">
                    <div class="stat-title">Estimated Product Costs</div>
                    <div class="stat-value" style="color:var(--danger);">৳${totalCost.toLocaleString('en-IN')}</div>
                    <div style="font-size:0.875rem; color:var(--text-light); margin-top:0.5rem;">Based on current Buy Price</div>
                </div>
                <div class="stat-card">
                    <div class="stat-title">Gross Profit</div>
                    <div class="stat-value" style="color:var(--success);">৳${grossProfit.toLocaleString('en-IN')}</div>
                    <div style="font-size:0.875rem; color:var(--text-light); margin-top:0.5rem;">Revenue - Costs</div>
                </div>
                <div class="stat-card">
                    <div class="stat-title">Current Stock Valuation</div>
                    <div class="stat-value">৳${stockValuation.toLocaleString('en-IN')}</div>
                    <div style="font-size:0.875rem; color:var(--text-light); margin-top:0.5rem;">Total Buy Price in Stock</div>
                </div>
            </div>

            <div style="background:var(--white); padding:2rem; border-radius:8px; margin-top:2rem;">
                <h3>Accounting Notes:</h3>
                <ul style="color:var(--text-light); margin-left:1.5rem; margin-top:1rem; line-height:1.6;">
                    <li><strong>Revenue</strong> is calculated strictly from orders marked as <strong>"Delivered"</strong>.</li>
                    <li><strong>Estimated Product Costs</strong> are derived from the <strong>Buy/Cost Price</strong> field of each product multiplied by the quantity sold.</li>
                    <li>If a product does not have a <strong>Buy/Cost Price</strong> set, its cost is calculated as ৳0. Ensure all products have a cost price set in the Products tab for an accurate P&L.</li>
                    <li>Shipping costs and operational expenses (like marketing, salaries) are not deducted from this gross margin.</li>
                </ul>
            </div>
        `;
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
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${customers.map(c => `
                            <tr style="${c.blocked ? 'opacity: 0.6;' : ''}">
                                <td>${c.name}</td>
                                <td>${c.email}</td>
                                <td>${c.phone}</td>
                                <td>${new Date(c.created).toLocaleDateString()}</td>
                                <td>
                                    ${c.blocked ? '<span class="badge-tag badge-sale" style="background:var(--danger)">Blocked</span>' : '<span class="badge-tag badge-new">Active</span>'}
                                </td>
                                <td>
                                    <button class="action-btn" style="background:#4338ca; color:#fff;" title="View Customer Activity & Sessions" onclick="adminApp.sessionFilter='all'; adminApp.sessionSearch='${c.email}'; adminApp.navigate('sessions', document.querySelector('.admin-nav a[data-page=\\'sessions\\']'));">Sessions</button>
                                    <button class="action-btn edit-btn" onclick="adminApp.toggleBlockCustomer('${c.id}', ${c.blocked ? 'false' : 'true'})">${c.blocked ? 'Unblock' : 'Block'}</button>
                                    <button class="action-btn delete-btn" onclick="adminApp.confirmDelete('customers', '${c.id}', '${(c.name || c.email || 'Customer').replace(/'/g, "\\'")}')">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                        ${customers.length === 0 ? '<tr><td colspan="6" class="text-center">No customers yet</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        `;
    },

    toggleBlockCustomer(id, isBlocked) {
        db.update('customers', id, { blocked: isBlocked });
        showToast(isBlocked ? 'Customer blocked' : 'Customer unblocked');
        
        // Note: For blocking to be effective, app.js needs to check customer.blocked
        
        document.getElementById('admin-content').innerHTML = this.renderCustomers();
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
                    <div style="display:flex; gap:1rem; flex-wrap:wrap;" class="mt-1 form-group">
                        <div style="flex:1;">
                            <label>Hero Banner Width</label>
                            <input type="text" id="a-hero-width" value="${s.heroBannerWidth || '100%'}" placeholder="e.g. 100%, 1200px">
                        </div>
                        <div style="flex:1;">
                            <label>Hero Banner Height</label>
                            <input type="text" id="a-hero-height" value="${s.heroBannerHeight || '400px'}" placeholder="e.g. 400px, 50vh">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Hero Background Image</label>
                        <input type="file" id="a-hero-img" accept="image/*" onchange="adminApp.handleAppImage(event, 'hero', 'a-hero-preview')">
                        <div id="a-hero-preview" class="image-preview-area">
                            ${s.heroImage ? `<div class="img-preview-box"><img src="${s.heroImage}"><button type="button" class="remove-img-btn" onclick="adminApp.removeAppImage('hero', 'a-hero-preview')">&times;</button></div>` : ''}
                        </div>
                    </div>

                    <h3 class="mt-2">Product Images</h3>
                    <div style="display:flex; gap:1rem; flex-wrap:wrap;" class="mt-1 form-group">
                        <div style="flex:1; min-width: 180px;">
                            <label>Product Image Width</label>
                            <input type="text" id="a-product-width" value="${s.productImgWidth || '100%'}" placeholder="e.g. 100%, 300px">
                        </div>
                        <div style="flex:1; min-width: 180px;">
                            <label>Product Image Height</label>
                            <input type="text" id="a-product-height" value="${s.productImgHeight || '200px'}" placeholder="e.g. 200px, 300px">
                        </div>
                    </div>

                    <h3 class="mt-2">Shop by Category (Icon & Size Customization)</h3>
                    <div style="display:flex; gap:1rem; flex-wrap:wrap;" class="mt-1 form-group">
                        <div style="flex:1; min-width: 160px;">
                            <label>Category Icon Width</label>
                            <input type="text" id="a-cat-width" value="${s.categoryIconWidth || '100%'}" placeholder="e.g. 100%, 140px, 100px, 80px">
                            <small style="color:var(--text-light); font-size:0.75rem; display:block; margin-top:3px;">Width in px (e.g. 120px) or % (e.g. 100%)</small>
                        </div>
                        <div style="flex:1; min-width: 160px;">
                            <label>Category Icon Height</label>
                            <input type="text" id="a-cat-height" value="${s.categoryIconHeight || '180px'}" placeholder="e.g. 180px, 140px, 100px, 80px, auto">
                            <small style="color:var(--text-light); font-size:0.75rem; display:block; margin-top:3px;">Height in px (e.g. 140px) or 'auto'</small>
                        </div>
                        <div style="flex:1; min-width: 160px;">
                            <label>Corner Radius / Shape</label>
                            <input type="text" id="a-cat-radius" value="${s.categoryIconRadius || '12px'}" placeholder="e.g. 12px, 50%, 8px, 0px">
                            <small style="color:var(--text-light); font-size:0.75rem; display:block; margin-top:3px;">Use 50% for circle, 12px for rounded</small>
                        </div>
                    </div>

                    <h3 class="mt-2">Homepage Sections (Show/Hide)</h3>
                    <div style="display:flex; gap:1rem; flex-wrap:wrap; background: #f9fafb; padding:1rem; border-radius:4px;" class="mt-1">
                        <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                            <input type="checkbox" id="a-show-featured" ${s.showFeatured !== false ? 'checked' : ''} style="width:auto;">
                            <span>Featured Products</span>
                        </label>
                        <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                            <input type="checkbox" id="a-show-new" ${s.showNewArrivals !== false ? 'checked' : ''} style="width:auto;">
                            <span>New Arrivals</span>
                        </label>
                        <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                            <input type="checkbox" id="a-show-sale" ${s.showOnSale !== false ? 'checked' : ''} style="width:auto;">
                            <span>On Sale</span>
                        </label>
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
        
        settings.heroBannerWidth = document.getElementById('a-hero-width').value;
        settings.heroBannerHeight = document.getElementById('a-hero-height').value;
        settings.productImgWidth = document.getElementById('a-product-width').value;
        settings.productImgHeight = document.getElementById('a-product-height').value;
        settings.categoryIconWidth = document.getElementById('a-cat-width').value;
        settings.categoryIconHeight = document.getElementById('a-cat-height').value;
        settings.categoryIconRadius = document.getElementById('a-cat-radius').value;

        settings.showFeatured = document.getElementById('a-show-featured').checked;
        settings.showNewArrivals = document.getElementById('a-show-new').checked;
        settings.showOnSale = document.getElementById('a-show-sale').checked;

        settings.heroImage = this.tempAppearance.hero;
        settings.storeLogo = this.tempAppearance.logo;
        settings.logoDisplayMode = document.getElementById('a-logo-mode').value;

        db.setSettings(settings);
        showToast('Appearance saved successfully');
        
        // Update admin colors too
        document.documentElement.style.setProperty('--primary', settings.primaryColor);
        document.documentElement.style.setProperty('--accent', settings.accentColor);
        document.documentElement.style.setProperty('--hero-w', settings.heroBannerWidth);
        document.documentElement.style.setProperty('--hero-h', settings.heroBannerHeight);
        document.documentElement.style.setProperty('--prod-img-w', settings.productImgWidth);
        document.documentElement.style.setProperty('--prod-img-h', settings.productImgHeight);
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

                    <h3 class="mt-2">Social Media Links</h3>
                    <div style="display:flex; gap:1rem; flex-wrap:wrap;" class="mt-1">
                        <div class="form-group" style="flex:1;">
                            <label style="display:flex; align-items:center; gap:0.5rem;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg> Facebook URL</label>
                            <input type="text" id="s-facebook" value="${s.facebook || ''}">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label style="display:flex; align-items:center; gap:0.5rem;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg> Instagram URL</label>
                            <input type="text" id="s-instagram" value="${s.instagram || ''}">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label style="display:flex; align-items:center; gap:0.5rem;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> WhatsApp URL</label>
                            <input type="text" id="s-whatsapp" value="${s.whatsapp || ''}">
                        </div>
                    </div>
                    <div style="display:flex; gap:1rem; flex-wrap:wrap;" class="mt-1">
                        <div class="form-group" style="flex:1;">
                            <label style="display:flex; align-items:center; gap:0.5rem;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg> YouTube URL</label>
                            <input type="text" id="s-youtube" value="${s.youtube || ''}">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label style="display:flex; align-items:center; gap:0.5rem;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path></svg> TikTok URL</label>
                            <input type="text" id="s-tiktok" value="${s.tiktok || ''}">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label style="display:flex; align-items:center; gap:0.5rem;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l11.733 16h4.267l-11.733 -16z"></path><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"></path></svg> Twitter/X URL</label>
                            <input type="text" id="s-twitter" value="${s.twitter || ''}">
                        </div>
                    </div>

                    <h3 class="mt-2">Global Size Guide (Text)</h3>
                    <div class="form-group mt-1">
                        <label>Enter size guide information. This will be displayed in a popup on all product pages.</label>
                        <textarea id="s-size-guide" rows="10" placeholder="e.g.\nSmall: 36 inch chest\nMedium: 38 inch chest" style="width:100%; margin-top:0.5rem; padding:0.5rem; border:1px solid #ddd; border-radius: 4px;">${s.globalSizeGuide || ''}</textarea>
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
                        <div class="form-group" style="flex:1;"><label>OTP Template ID</label><input type="text" id="s-mail-template" value="${s.mailTemplateId || ''}"></div>
                        <div class="form-group" style="flex:1;"><label>Order Template ID</label><input type="text" id="s-mail-order-template" value="${s.mailOrderTemplateId || ''}" placeholder="Optional"></div>
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
            facebook: document.getElementById('s-facebook').value, 
            instagram: document.getElementById('s-instagram').value, 
            whatsapp: document.getElementById('s-whatsapp').value,
            youtube: document.getElementById('s-youtube').value,
            tiktok: document.getElementById('s-tiktok').value,
            twitter: document.getElementById('s-twitter').value,
            mailProvider: document.getElementById('s-mail-provider').value,
            mailServiceId: document.getElementById('s-mail-service').value,
            mailTemplateId: document.getElementById('s-mail-template').value,
            mailOrderTemplateId: document.getElementById('s-mail-order-template').value,
            mailPublicKey: document.getElementById('s-mail-public').value,
            maintenanceMode: document.getElementById('s-maintenance').checked,
            globalSizeGuide: document.getElementById('s-size-guide').value
        };
        db.setSettings(settings);
        showToast('Settings saved successfully');
    },

    // --- Utilities ---

    closeModal(id) {
        document.getElementById(id).classList.remove('active');
    },

    confirmDelete(table, id, name, isPermanent = false) {
        const isArchive = table === 'archive' || isPermanent;
        const msg = isArchive 
            ? `Are you sure you want to PERMANENTLY delete "${name}"? This action cannot be undone.`
            : `Are you sure you want to delete "${name}"? It will be moved to the Archive and auto-deleted after 45 days.`;
            
        document.getElementById('delete-msg').textContent = msg;
        const btn = document.getElementById('confirm-delete-btn');
        btn.textContent = isArchive ? 'Delete Permanently' : 'Move to Archive';
        btn.style.background = 'var(--danger)';
        
        btn.onclick = () => {
            db.delete(table, id, isArchive);
            showToast(isArchive ? 'Item permanently deleted' : 'Item moved to Archive (45d retention)');
            this.closeModal('delete-modal');
            this.navigate(table === 'archive' ? 'archive' : table);
        };
        document.getElementById('delete-modal').classList.add('active');
    },

    // --- Archive & Auto-Delete Management ---
    renderArchive() {
        if (db.purgeExpiredArchive) db.purgeExpiredArchive();
        
        const archive = db.get('archive') || [];
        const now = Date.now();
        
        const enriched = archive.slice().reverse().map(item => {
            const expTime = item.expiresAt ? new Date(item.expiresAt).getTime() : (new Date(item.deletedAt).getTime() + 45 * 24 * 60 * 60 * 1000);
            const msLeft = expTime - now;
            const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
            return { ...item, daysLeft };
        });

        const filterType = this.archiveFilter || 'all';
        const filtered = filterType === 'all' ? enriched : enriched.filter(i => (i.table === filterType || (i.itemType && i.itemType.toLowerCase() === filterType.toLowerCase())));

        return `
            <div class="admin-header">
                <div>
                    <h2>Archive & Recycle Bin (45-Day Auto Delete)</h2>
                    <p style="color:var(--text-light); font-size:0.875rem; margin-top:0.25rem;">Deleted items are automatically kept for 45 days before permanent purging. You can restore or permanently delete them below.</p>
                </div>
                ${enriched.length > 0 ? `
                    <button class="btn" style="background:var(--danger);" onclick="adminApp.confirmEmptyArchive()">Empty Archive</button>
                ` : ''}
            </div>

            <div class="stats-grid" style="margin-bottom: 1.5rem;">
                <div class="stat-card">
                    <div class="stat-title">Archived Items</div>
                    <div class="stat-value">${enriched.length}</div>
                    <div style="font-size:0.875rem; color:var(--text-light); margin-top:0.25rem;">Total items in recycle bin</div>
                </div>
                <div class="stat-card">
                    <div class="stat-title">Retention Policy</div>
                    <div class="stat-value" style="color:var(--accent);">45 Days</div>
                    <div style="font-size:0.875rem; color:var(--text-light); margin-top:0.25rem;">Auto-purged from database</div>
                </div>
                <div class="stat-card">
                    <div class="stat-title">Expiring Soon (≤ 7 Days)</div>
                    <div class="stat-value" style="color:${enriched.filter(i => i.daysLeft <= 7).length > 0 ? 'var(--danger)' : 'var(--success)'};">
                        ${enriched.filter(i => i.daysLeft <= 7).length}
                    </div>
                    <div style="font-size:0.875rem; color:var(--text-light); margin-top:0.25rem;">Due for auto deletion soon</div>
                </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
                <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                    <button class="btn btn-sm ${filterType==='all'?'btn-primary':'btn-outline'}" onclick="adminApp.setArchiveFilter('all')">All (${enriched.length})</button>
                    <button class="btn btn-sm ${filterType==='products'?'btn-primary':'btn-outline'}" onclick="adminApp.setArchiveFilter('products')">Products (${enriched.filter(i=>i.table==='products').length})</button>
                    <button class="btn btn-sm ${filterType==='categories'?'btn-primary':'btn-outline'}" onclick="adminApp.setArchiveFilter('categories')">Categories (${enriched.filter(i=>i.table==='categories').length})</button>
                    <button class="btn btn-sm ${filterType==='coupons'?'btn-primary':'btn-outline'}" onclick="adminApp.setArchiveFilter('coupons')">Coupons (${enriched.filter(i=>i.table==='coupons').length})</button>
                    <button class="btn btn-sm ${filterType==='orders'?'btn-primary':'btn-outline'}" onclick="adminApp.setArchiveFilter('orders')">Orders (${enriched.filter(i=>i.table==='orders').length})</button>
                    <button class="btn btn-sm ${filterType==='customers'?'btn-primary':'btn-outline'}" onclick="adminApp.setArchiveFilter('customers')">Customers (${enriched.filter(i=>i.table==='customers').length})</button>
                </div>
            </div>

            <div class="admin-table-wrapper">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Name / Details</th>
                            <th>Deleted Date</th>
                            <th>Auto-Deletes In</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map(item => `
                            <tr>
                                <td>
                                    <span class="badge-tag ${item.table === 'products' ? 'badge-sale' : item.table === 'orders' ? 'badge-new' : ''}" style="${item.table==='categories'?'background:#7c3aed;color:#fff;':''}">
                                        ${item.itemType || item.table}
                                    </span>
                                </td>
                                <td>
                                    <div style="font-weight:600;">${item.name}</div>
                                    ${item.details ? `<div style="font-size:0.8rem; color:var(--text-light);">${item.details}</div>` : ''}
                                    <div style="font-size:0.75rem; color:var(--text-light); opacity:0.8;">Original ID: ${item.originalId}</div>
                                </td>
                                <td>${item.deletedAt ? new Date(item.deletedAt).toLocaleString() : 'N/A'}</td>
                                <td>
                                    <span style="font-weight:600; color:${item.daysLeft <= 5 ? 'var(--danger)' : 'var(--text)'};">
                                        ⏱ ${item.daysLeft} day${item.daysLeft === 1 ? '' : 's'} left
                                    </span>
                                </td>
                                <td>
                                    <div class="action-btns">
                                        <button class="action-btn edit-btn" style="background:#16a34a; color:#fff;" onclick="adminApp.restoreArchivedItem('${item.id}', '${item.name.replace(/'/g, "\\'")}')">Restore</button>
                                        <button class="action-btn delete-btn" onclick="adminApp.confirmDelete('archive', '${item.id}', '${item.name.replace(/'/g, "\\'")}', true)">Delete Forever</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                        ${filtered.length === 0 ? `
                            <tr>
                                <td colspan="5" class="text-center" style="padding: 3rem 1rem;">
                                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">🗑️</div>
                                    <h4 style="color:var(--text-light);">Archive is empty</h4>
                                    <p style="font-size:0.875rem; color:var(--text-light); margin-top:0.25rem;">Items deleted from products, categories, coupons, etc. will stay here for 45 days.</p>
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
        `;
    },

    setArchiveFilter(filter) {
        this.archiveFilter = filter;
        document.getElementById('admin-content').innerHTML = this.renderArchive();
    },

    restoreArchivedItem(archiveId, name) {
        const restored = db.restoreItem(archiveId);
        if (restored) {
            showToast(`"${name}" restored successfully!`);
            document.getElementById('admin-content').innerHTML = this.renderArchive();
        } else {
            showToast('Failed to restore item', 'error');
        }
    },

    confirmEmptyArchive() {
        document.getElementById('delete-msg').textContent = 'Are you sure you want to permanently delete ALL items in the Archive? This cannot be undone.';
        const btn = document.getElementById('confirm-delete-btn');
        btn.textContent = 'Empty Archive Now';
        btn.style.background = 'var(--danger)';
        btn.onclick = () => {
            db.emptyArchive();
            showToast('Archive emptied permanently');
            this.closeModal('delete-modal');
            document.getElementById('admin-content').innerHTML = this.renderArchive();
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
    },

    // --- Staff Management ---
    renderStaff() {
        const admins = db.get('admins');
        const settings = db.getSettings();
        
        return `
            <div class="admin-header">
                <h2>Staff & Admins</h2>
                <button class="btn btn-primary" onclick="adminApp.openStaffModal()">Add New Staff</button>
            </div>
            
            <div class="card mt-2">
                <h3>Master Admin Password</h3>
                <div class="form-group mt-1">
                    <div style="position: relative; max-width: 300px;">
                        <input type="password" id="master-pwd" placeholder="Enter new master password" value="${settings.masterPassword || 'Sagor22777@'}" style="padding-right: 40px; width: 100%;">
                        <button type="button" onclick="const p = document.getElementById('master-pwd'); p.type = p.type === 'password' ? 'text' : 'password';" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--text-light);">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        </button>
                    </div>
                </div>
                <button class="btn" style="background:var(--accent);" onclick="adminApp.saveMasterPassword()">Update Master Password</button>
            </div>

            <div class="card mt-2">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Access Areas</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${admins.map(a => `
                            <tr>
                                <td>${a.name}</td>
                                <td>${a.email}</td>
                                <td><span class="badge-tag badge-sale">${a.role}</span></td>
                                <td style="font-size: 0.8rem; color:var(--text-light); max-width: 200px;">
                                    ${(a.access || []).join(', ')}
                                </td>
                                <td>
                                    <button class="action-btn delete-btn" onclick="adminApp.confirmDelete('admins', '${a.id}', '${(a.name || a.email || 'Staff').replace(/'/g, "\\'")}')">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div id="staff-modal" class="modal-overlay">
                <div class="modal-content" style="max-width: 500px;">
                    <button class="modal-close" onclick="adminApp.closeModal('staff-modal')">&times;</button>
                    <h2>Add New Staff</h2>
                    <form onsubmit="adminApp.saveStaff(event)">
                        <div class="form-group mt-1">
                            <label>Name</label>
                            <input type="text" id="staff-name" required>
                        </div>
                        <div class="form-group">
                            <label>Email (Username)</label>
                            <input type="email" id="staff-email" required>
                        </div>
                        <div class="form-group">
                            <label>Password</label>
                            <div style="position: relative;">
                                <input type="password" id="staff-pwd" required style="padding-right: 40px; width: 100%;">
                                <button type="button" onclick="const p = document.getElementById('staff-pwd'); p.type = p.type === 'password' ? 'text' : 'password';" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--text-light);">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                </button>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Access Areas</label>
                            <div style="display:flex; flex-wrap:wrap; gap: 1rem;" class="mt-1">
                                <label><input type="checkbox" class="cb-access" value="products"> Products</label>
                                <label><input type="checkbox" class="cb-access" value="categories"> Categories</label>
                                <label><input type="checkbox" class="cb-access" value="orders"> Orders</label>
                                <label><input type="checkbox" class="cb-access" value="accounting"> Accounting</label>
                                <label><input type="checkbox" class="cb-access" value="customers"> Customers</label>
                                <label><input type="checkbox" class="cb-access" value="sessions"> Live Sessions</label>
                                <label><input type="checkbox" class="cb-access" value="archive"> Archive</label>
                                <label><input type="checkbox" class="cb-access" value="appearance"> Appearance</label>
                                <label><input type="checkbox" class="cb-access" value="settings"> Settings</label>
                            </div>
                        </div>
                        <button type="submit" class="btn btn-primary mt-2">Save Staff</button>
                    </form>
                </div>
            </div>
        `;
    },

    saveMasterPassword() {
        const pwd = document.getElementById('master-pwd').value;
        if(pwd.length < 6) {
            showToast('Password must be at least 6 characters', 'error');
            return;
        }
        const s = db.getSettings();
        s.masterPassword = pwd;
        db.setSettings(s);
        showToast('Master password updated!');
    },

    openStaffModal() {
        document.getElementById('staff-name').value = '';
        document.getElementById('staff-email').value = '';
        document.getElementById('staff-pwd').value = '';
        document.querySelectorAll('.cb-access').forEach(cb => cb.checked = false);
        document.getElementById('staff-modal').classList.add('active');
    },

    saveStaff(e) {
        e.preventDefault();
        const access = [];
        document.querySelectorAll('.cb-access:checked').forEach(cb => access.push(cb.value));
        
        if (access.length === 0) {
            showToast('Please select at least one access area', 'error');
            return;
        }

        const admin = {
            name: document.getElementById('staff-name').value,
            email: document.getElementById('staff-email').value,
            password: document.getElementById('staff-pwd').value,
            role: 'admin',
            access: access
        };
        
        if (db.get('admins').find(a => a.email === admin.email)) {
             showToast('Email already in use', 'error');
             return;
        }

        db.add('admins', admin);
        showToast('Staff added successfully!');
        this.closeModal('staff-modal');
        document.getElementById('admin-content').innerHTML = this.renderStaff();
    },

    // --- Live Sessions, Login/Logout & Visitor Tracking ---

    sessionFilter: 'all',
    sessionSearch: '',

    renderSessions() {
        const sessions = (db.get('sessions') || []).slice().sort((a, b) => new Date(b.lastActiveAt || b.loginAt).getTime() - new Date(a.lastActiveAt || a.loginAt).getTime());
        const now = Date.now();

        // Calculate analytics
        const activeSessions = sessions.filter(s => s.status === 'active' && (now - new Date(s.lastActiveAt || s.loginAt).getTime() < 180000));
        const adminSessions = sessions.filter(s => s.userType === 'admin');
        const customerSessions = sessions.filter(s => s.userType === 'customer');
        const guestSessions = sessions.filter(s => s.userType === 'guest' || !s.userType);

        let totalDuration = 0;
        sessions.forEach(s => totalDuration += (s.durationSeconds || 0));
        const avgDuration = sessions.length ? Math.round(totalDuration / sessions.length) : 0;

        // Apply filters
        let filtered = sessions;
        if (this.sessionFilter === 'active') {
            filtered = activeSessions;
        } else if (this.sessionFilter === 'admin') {
            filtered = adminSessions;
        } else if (this.sessionFilter === 'customer') {
            filtered = customerSessions;
        } else if (this.sessionFilter === 'guest') {
            filtered = guestSessions;
        }

        if (this.sessionSearch) {
            const q = this.sessionSearch.toLowerCase();
            filtered = filtered.filter(s => 
                (s.userName && s.userName.toLowerCase().includes(q)) ||
                (s.userId && s.userId.toLowerCase().includes(q)) ||
                (s.ip && s.ip.toLowerCase().includes(q)) ||
                (s.location && s.location.toLowerCase().includes(q)) ||
                (s.deviceModel && s.deviceModel.toLowerCase().includes(q)) ||
                (s.os && s.os.toLowerCase().includes(q)) ||
                (s.browser && s.browser.toLowerCase().includes(q))
            );
        }

        const formatDur = (secs) => {
            if (!secs || secs <= 0) return '0s';
            const s = Math.floor(secs);
            const hrs = Math.floor(s / 3600);
            const mins = Math.floor((s % 3600) / 60);
            const remainder = s % 60;
            if (hrs > 0) return `${hrs}h ${mins}m ${remainder}s`;
            if (mins > 0) return `${mins}m ${remainder}s`;
            return `${remainder}s`;
        };

        const formatDateTime = (isoString) => {
            if (!isoString) return '<span style="color:var(--text-light); font-style:italic;">Not logged out yet</span>';
            const d = new Date(isoString);
            return `<div style="font-size:0.85rem; font-weight:500;">${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    <div style="font-size:0.75rem; color:var(--text-light);">${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</div>`;
        };

        return `
            <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
                <div>
                    <h2>Live Sessions, Activity & Login/Logout Records</h2>
                    <p style="color:var(--text-light); font-size:0.9rem; margin-top:4px;">
                        Real-time visitor and administrator monitoring, duration on site, IP addresses, geolocations, and hardware models.
                    </p>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="btn btn-outline btn-sm" onclick="adminApp.refreshSessionsView()">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:4px;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                        Refresh
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="adminApp.exportSessionsCSV()">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Export CSV
                    </button>
                    <button class="btn btn-outline btn-sm" style="color:#ef4444; border-color:#fca5a5;" onclick="adminApp.clearOldSessions()">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:4px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        Clear Inactive Logs
                    </button>
                </div>
            </div>

            <!-- Metric Cards Grid -->
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin:20px 0;">
                <div class="card" style="padding:16px; border-left: 4px solid #16a34a; display:flex; align-items:center; gap:14px;">
                    <div style="width:44px; height:44px; border-radius:10px; background:#dcfce7; color:#16a34a; display:flex; align-items:center; justify-content:center; font-size:1.3rem;">
                        🟢
                    </div>
                    <div>
                        <div style="font-size:0.8rem; text-transform:uppercase; color:var(--text-light); font-weight:600; letter-spacing:0.5px;">Online Active Now</div>
                        <div style="font-size:1.6rem; font-weight:700; color:var(--text);">${activeSessions.length} <span style="font-size:0.8rem; font-weight:normal; color:#16a34a;">Users</span></div>
                    </div>
                </div>

                <div class="card" style="padding:16px; border-left: 4px solid #8b5cf6; display:flex; align-items:center; gap:14px;">
                    <div style="width:44px; height:44px; border-radius:10px; background:#ede9fe; color:#8b5cf6; display:flex; align-items:center; justify-content:center; font-size:1.3rem;">
                        🛡️
                    </div>
                    <div>
                        <div style="font-size:0.8rem; text-transform:uppercase; color:var(--text-light); font-weight:600; letter-spacing:0.5px;">Admin Logins</div>
                        <div style="font-size:1.6rem; font-weight:700; color:var(--text);">${adminSessions.length} <span style="font-size:0.8rem; font-weight:normal; color:#8b5cf6;">Sessions</span></div>
                    </div>
                </div>

                <div class="card" style="padding:16px; border-left: 4px solid #3b82f6; display:flex; align-items:center; gap:14px;">
                    <div style="width:44px; height:44px; border-radius:10px; background:#dbeafe; color:#3b82f6; display:flex; align-items:center; justify-content:center; font-size:1.3rem;">
                        👤
                    </div>
                    <div>
                        <div style="font-size:0.8rem; text-transform:uppercase; color:var(--text-light); font-weight:600; letter-spacing:0.5px;">Customer Accounts</div>
                        <div style="font-size:1.6rem; font-weight:700; color:var(--text);">${customerSessions.length} <span style="font-size:0.8rem; font-weight:normal; color:#3b82f6;">Sessions</span></div>
                    </div>
                </div>

                <div class="card" style="padding:16px; border-left: 4px solid #f59e0b; display:flex; align-items:center; gap:14px;">
                    <div style="width:44px; height:44px; border-radius:10px; background:#fef3c7; color:#f59e0b; display:flex; align-items:center; justify-content:center; font-size:1.3rem;">
                        ⏱️
                    </div>
                    <div>
                        <div style="font-size:0.8rem; text-transform:uppercase; color:var(--text-light); font-weight:600; letter-spacing:0.5px;">Avg. Time on Site</div>
                        <div style="font-size:1.5rem; font-weight:700; color:var(--text);">${formatDur(avgDuration)}</div>
                    </div>
                </div>
            </div>

            <!-- Filter Tabs & Search Bar -->
            <div class="card" style="padding:16px; margin-bottom:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <button class="btn btn-sm ${this.sessionFilter === 'all' ? 'btn-primary' : 'btn-outline'}" onclick="adminApp.filterSessions('all')">
                            All Logs (${sessions.length})
                        </button>
                        <button class="btn btn-sm ${this.sessionFilter === 'active' ? 'btn-primary' : 'btn-outline'}" onclick="adminApp.filterSessions('active')">
                            🟢 Online (${activeSessions.length})
                        </button>
                        <button class="btn btn-sm ${this.sessionFilter === 'admin' ? 'btn-primary' : 'btn-outline'}" onclick="adminApp.filterSessions('admin')">
                            🛡️ Admins (${adminSessions.length})
                        </button>
                        <button class="btn btn-sm ${this.sessionFilter === 'customer' ? 'btn-primary' : 'btn-outline'}" onclick="adminApp.filterSessions('customer')">
                            👤 Customers (${customerSessions.length})
                        </button>
                        <button class="btn btn-sm ${this.sessionFilter === 'guest' ? 'btn-primary' : 'btn-outline'}" onclick="adminApp.filterSessions('guest')">
                            🌐 Guests (${guestSessions.length})
                        </button>
                    </div>

                    <div style="display:flex; align-items:center; gap:8px; min-width:260px;">
                        <input type="text" id="session-search-input" placeholder="Search by name, email, IP, location, device..." 
                               value="${this.sessionSearch || ''}" 
                               oninput="adminApp.searchSessions(this.value)" 
                               style="width:100%; padding:8px 12px; font-size:0.85rem; border:1px solid var(--border); border-radius:6px;">
                    </div>
                </div>
            </div>

            <!-- Sessions Data Table -->
            <div class="card table-container" style="overflow-x:auto;">
                <table class="data-table" style="width:100%; min-width:980px;">
                    <thead>
                        <tr>
                            <th style="width:180px;">User & Role</th>
                            <th style="width:130px;">Status & Duration</th>
                            <th style="width:150px;">Login Record</th>
                            <th style="width:150px;">Logout Record</th>
                            <th style="width:180px;">IP & Location</th>
                            <th style="width:200px;">Device & Model</th>
                            <th style="width:110px; text-align:center;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length === 0 ? `
                            <tr>
                                <td colspan="7" style="text-align:center; padding:36px; color:var(--text-light);">
                                    <div style="font-size:2rem; margin-bottom:8px;">🔍</div>
                                    <p>No session or login records match your filter criteria.</p>
                                </td>
                            </tr>
                        ` : filtered.map(s => {
                            const isOnline = s.status === 'active' && (now - new Date(s.lastActiveAt || s.loginAt).getTime() < 180000);
                            const roleBadgeColor = s.userRole === 'master' ? 'background:#f3e8ff; color:#7e22ce; border:1px solid #d8b4fe;' : 
                                                  (s.userType === 'admin' ? 'background:#e0e7ff; color:#4338ca; border:1px solid #c7d2fe;' : 
                                                  (s.userType === 'customer' ? 'background:#dbeafe; color:#1e40af; border:1px solid #bfdbfe;' : 
                                                  'background:#f3f4f6; color:#4b5563; border:1px solid #e5e7eb;'));
                            
                            const roleLabel = s.userRole === 'master' ? 'Master Admin' : 
                                             (s.userType === 'admin' ? 'Staff Admin' : 
                                             (s.userType === 'customer' ? 'Customer' : 'Visitor / Guest'));

                            const deviceIcon = s.deviceType === 'Mobile' ? '📱' : (s.deviceType === 'Tablet' ? '📟' : '💻');

                            return `
                                <tr>
                                    <td>
                                        <div style="display:flex; align-items:center; gap:8px;">
                                            <div style="width:34px; height:34px; border-radius:50%; background:#f1f5f9; display:flex; align-items:center; justify-content:center; font-size:1.1rem; flex-shrink:0;">
                                                ${s.userType === 'admin' ? '🛡️' : (s.userType === 'customer' ? '👤' : '🌐')}
                                            </div>
                                            <div style="overflow:hidden;">
                                                <div style="font-weight:600; color:var(--text); white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">
                                                    ${s.userName || 'Anonymous Visitor'}
                                                </div>
                                                <div style="font-size:0.75rem; color:var(--text-light); white-space:nowrap; text-overflow:ellipsis; overflow:hidden;" title="${s.userId || ''}">
                                                    ${s.userId || 'Guest'}
                                                </div>
                                                <div style="margin-top:2px;">
                                                    <span style="display:inline-block; font-size:0.65rem; padding:1px 6px; border-radius:4px; font-weight:600; text-transform:uppercase; ${roleBadgeColor}">
                                                        ${roleLabel}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    <td>
                                        ${isOnline ? `
                                            <span style="display:inline-flex; align-items:center; gap:5px; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:700; background:#dcfce7; color:#15803d; border:1px solid #86efac;">
                                                <span style="width:7px; height:7px; border-radius:50%; background:#16a34a; box-shadow:0 0 6px #16a34a;"></span>
                                                Active Now
                                            </span>
                                        ` : (s.status === 'logged_out' ? `
                                            <span style="display:inline-flex; align-items:center; gap:5px; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:600; background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;">
                                                Logged Out
                                            </span>
                                        ` : `
                                            <span style="display:inline-flex; align-items:center; gap:5px; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:600; background:#f3f4f6; color:#6b7280; border:1px solid #e5e7eb;">
                                                Session Ended
                                            </span>
                                        `)}
                                        <div style="margin-top:4px; font-size:0.8rem; font-weight:600; color:var(--primary);">
                                            ⏱️ ${formatDur(s.durationSeconds)}
                                        </div>
                                        <div style="font-size:0.7rem; color:var(--text-light);">
                                            ${s.pageViews || 1} page views
                                        </div>
                                    </td>

                                    <td>
                                        ${formatDateTime(s.loginAt)}
                                    </td>

                                    <td>
                                        ${formatDateTime(s.logoutAt)}
                                    </td>

                                    <td>
                                        <div style="display:flex; align-items:center; gap:4px;">
                                            <span style="font-family:monospace; font-size:0.8rem; font-weight:600; background:#f8fafc; padding:2px 6px; border-radius:4px; border:1px solid #e2e8f0;">
                                                ${s.ip || '127.0.0.1'}
                                            </span>
                                            <button class="btn btn-sm btn-outline" style="padding:1px 5px; font-size:0.7rem; border-radius:4px; cursor:pointer;" title="Copy IP" onclick="navigator.clipboard.writeText('${s.ip || ''}'); showToast('IP copied to clipboard');">
                                                📋
                                            </button>
                                        </div>
                                        <div style="font-size:0.8rem; color:var(--text); margin-top:3px; font-weight:500;">
                                            📍 ${s.location || s.city || 'Bangladesh'}
                                        </div>
                                        <div style="font-size:0.7rem; color:var(--text-light); white-space:nowrap; text-overflow:ellipsis; overflow:hidden;" title="${s.isp || ''}">
                                            🏢 ${s.isp || 'Broadband / Mobile'}
                                        </div>
                                    </td>

                                    <td>
                                        <div style="font-size:0.85rem; font-weight:600; color:var(--text);">
                                            ${deviceIcon} ${s.deviceModel || 'Desktop / PC'}
                                        </div>
                                        <div style="font-size:0.75rem; color:var(--text-light); margin-top:2px;">
                                            ${s.os || 'Unknown OS'} • ${s.browser || 'Browser'}
                                        </div>
                                        <div style="font-size:0.7rem; color:var(--text-light); margin-top:1px;">
                                            🖥️ ${s.screen || 'Auto'} • 🌐 ${s.timezone || 'Asia/Dhaka'}
                                        </div>
                                    </td>

                                    <td style="text-align:center;">
                                        <div style="display:flex; justify-content:center; gap:6px;">
                                            <button class="btn btn-sm btn-outline" style="padding:4px 8px; font-size:0.75rem;" title="View Full Activity Timeline" onclick="adminApp.showSessionDetail('${s.id}')">
                                                👁️ Timeline
                                            </button>
                                            <button class="btn btn-sm btn-outline" style="padding:4px 8px; font-size:0.75rem; color:#ef4444; border-color:#fca5a5;" title="Delete Record" onclick="adminApp.deleteSession('${s.id}')">
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    refreshSessionsView() {
        const content = document.getElementById('admin-content');
        if (content && this.currentRoute === 'sessions') {
            content.innerHTML = this.renderSessions();
            showToast('Session logs refreshed');
        }
    },

    filterSessions(filterType) {
        this.sessionFilter = filterType;
        const content = document.getElementById('admin-content');
        if (content) {
            content.innerHTML = this.renderSessions();
        }
    },

    searchSessions(val) {
        this.sessionSearch = val;
        const content = document.getElementById('admin-content');
        if (content) {
            content.innerHTML = this.renderSessions();
            const input = document.getElementById('session-search-input');
            if (input) {
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
            }
        }
    },

    showSessionDetail(sessionId) {
        const session = db.getOne('sessions', sessionId);
        if (!session) {
            showToast('Session record not found', 'error');
            return;
        }

        const formatDur = (secs) => {
            if (!secs || secs <= 0) return '0s';
            const s = Math.floor(secs);
            const hrs = Math.floor(s / 3600);
            const mins = Math.floor((s % 3600) / 60);
            const remainder = s % 60;
            if (hrs > 0) return `${hrs}h ${mins}m ${remainder}s`;
            if (mins > 0) return `${mins}m ${remainder}s`;
            return `${remainder}s`;
        };

        const now = Date.now();
        const isOnline = session.status === 'active' && (now - new Date(session.lastActiveAt || session.loginAt).getTime() < 180000);

        const history = session.history || [
            {
                time: session.loginAt,
                action: session.userType === 'admin' ? 'Admin Login' : 'User Visit Started',
                page: session.currentPage || 'Home',
                details: `Connected from ${session.location || 'Bangladesh'} via ${session.deviceModel || 'device'}`
            }
        ];

        const modalTitle = document.getElementById('session-modal-title');
        if (modalTitle) {
            modalTitle.innerHTML = `Session Details: <span style="color:var(--primary);">${session.userName || 'User'}</span>`;
        }

        const content = document.getElementById('session-detail-content');
        if (content) {
            content.innerHTML = `
                <!-- System & Geo Overview Card -->
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px; margin-bottom:18px;">
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:14px;">
                        <div>
                            <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-light); font-weight:700;">User & Role</div>
                            <div style="font-size:0.95rem; font-weight:600; color:var(--text); margin-top:2px;">${session.userName || 'Anonymous'}</div>
                            <div style="font-size:0.8rem; color:var(--text-light);">${session.userId || 'Guest'}</div>
                            <div style="margin-top:4px;">
                                <span style="font-size:0.7rem; padding:2px 8px; border-radius:4px; font-weight:700; background:#e0e7ff; color:#3730a3;">
                                    ${session.userRole ? session.userRole.toUpperCase() : 'GUEST'}
                                </span>
                            </div>
                        </div>

                        <div>
                            <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-light); font-weight:700;">Status & Active Duration</div>
                            <div style="margin-top:2px;">
                                ${isOnline ? `
                                    <span style="font-size:0.75rem; font-weight:700; background:#dcfce7; color:#16a34a; padding:2px 8px; border-radius:10px; border:1px solid #86efac;">
                                        🟢 Online Active Now
                                    </span>
                                ` : (session.status === 'logged_out' ? `
                                    <span style="font-size:0.75rem; font-weight:600; background:#fee2e2; color:#b91c1c; padding:2px 8px; border-radius:10px;">
                                        🔴 Logged Out
                                    </span>
                                ` : `
                                    <span style="font-size:0.75rem; font-weight:600; background:#f3f4f6; color:#4b5563; padding:2px 8px; border-radius:10px;">
                                        ⏱️ Ended
                                    </span>
                                `)}
                            </div>
                            <div style="font-size:1.1rem; font-weight:700; color:var(--primary); margin-top:4px;">
                                ⏱️ ${formatDur(session.durationSeconds)} on site
                            </div>
                        </div>

                        <div>
                            <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-light); font-weight:700;">IP & Location</div>
                            <div style="font-size:0.95rem; font-weight:600; color:var(--text); margin-top:2px;">
                                🌐 ${session.ip || '127.0.0.1'}
                            </div>
                            <div style="font-size:0.8rem; color:var(--text);">📍 ${session.location || 'Bangladesh'}</div>
                            <div style="font-size:0.75rem; color:var(--text-light);">🏢 ${session.isp || 'ISP / Telecom'}</div>
                        </div>

                        <div>
                            <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-light); font-weight:700;">Device Model & OS</div>
                            <div style="font-size:0.95rem; font-weight:600; color:var(--text); margin-top:2px;">
                                📱 ${session.deviceModel || 'Desktop PC'}
                            </div>
                            <div style="font-size:0.8rem; color:var(--text);">${session.os || 'OS'} • ${session.browser || 'Browser'}</div>
                            <div style="font-size:0.75rem; color:var(--text-light);">🖥️ Screen: ${session.screen || 'N/A'} • TZ: ${session.timezone || 'Asia/Dhaka'}</div>
                        </div>
                    </div>
                </div>

                <!-- Timestamps Summary -->
                <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px; background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:18px;">
                    <div>
                        <div style="font-size:0.75rem; color:var(--text-light); font-weight:600;">LOGIN / VISIT TIME</div>
                        <div style="font-size:0.85rem; font-weight:600; color:var(--text);">
                            ${session.loginAt ? new Date(session.loginAt).toLocaleString() : 'N/A'}
                        </div>
                    </div>
                    <div>
                        <div style="font-size:0.75rem; color:var(--text-light); font-weight:600;">LAST ACTIVITY HEARTBEAT</div>
                        <div style="font-size:0.85rem; font-weight:600; color:var(--text);">
                            ${session.lastActiveAt ? new Date(session.lastActiveAt).toLocaleString() : 'N/A'}
                        </div>
                    </div>
                    <div>
                        <div style="font-size:0.75rem; color:var(--text-light); font-weight:600;">LOGOUT RECORD</div>
                        <div style="font-size:0.85rem; font-weight:600; color:${session.logoutAt ? '#ef4444' : '#16a34a'};">
                            ${session.logoutAt ? new Date(session.logoutAt).toLocaleString() : 'Still Active / In Session'}
                        </div>
                    </div>
                </div>

                <!-- Step-by-Step Activity Timeline -->
                <h3 style="font-size:1rem; font-weight:700; margin-bottom:12px;">Step-by-Step Activity Timeline (${history.length} events)</h3>
                <div style="max-height:280px; overflow-y:auto; padding-left:14px; border-left: 2px solid #e2e8f0; margin-left:8px;">
                    ${history.slice().reverse().map((ev, idx) => `
                        <div style="position:relative; margin-bottom:16px;">
                            <div style="position:absolute; left:-20px; top:4px; width:10px; height:10px; border-radius:50%; background:var(--primary); border:2px solid #fff;"></div>
                            <div style="display:flex; justify-content:space-between; align-items:baseline; gap:8px;">
                                <div style="font-size:0.85rem; font-weight:600; color:var(--text);">${ev.action}</div>
                                <div style="font-size:0.75rem; color:var(--text-light);">${new Date(ev.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</div>
                            </div>
                            <div style="font-size:0.75rem; color:var(--primary); font-weight:500;">Page: ${ev.page || 'Site'}</div>
                            ${ev.details ? `<div style="font-size:0.75rem; color:var(--text-light); margin-top:2px;">${ev.details}</div>` : ''}
                        </div>
                    `).join('')}
                </div>

                <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:20px;">
                    <button class="btn btn-outline" onclick="adminApp.closeModal('session-modal')">Close</button>
                    <button class="btn btn-primary" onclick="adminApp.deleteSession('${session.id}'); adminApp.closeModal('session-modal');">Delete Session Log</button>
                </div>
            `;
        }

        const modal = document.getElementById('session-modal');
        if (modal) modal.classList.add('active');
    },

    deleteSession(sessionId) {
        if (!confirm('Are you sure you want to delete this session record?')) return;
        db.delete('sessions', sessionId);
        showToast('Session record deleted');
        const content = document.getElementById('admin-content');
        if (content && this.currentRoute === 'sessions') {
            content.innerHTML = this.renderSessions();
        }
    },

    clearOldSessions() {
        const sessions = db.get('sessions') || [];
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        
        let deleted = 0;
        sessions.forEach(s => {
            if (s.status !== 'active' || (now - new Date(s.lastActiveAt || s.loginAt).getTime() > 24 * 60 * 60 * 1000)) {
                db.delete('sessions', s.id);
                deleted++;
            }
        });

        showToast(`Cleared ${deleted} old/inactive session logs.`);
        const content = document.getElementById('admin-content');
        if (content && this.currentRoute === 'sessions') {
            content.innerHTML = this.renderSessions();
        }
    },

    exportSessionsCSV() {
        const sessions = db.get('sessions') || [];
        if (sessions.length === 0) {
            showToast('No session data to export', 'error');
            return;
        }

        const headers = ['Session ID', 'User Type', 'User ID / Email', 'User Name', 'Role', 'Status', 'Duration (Seconds)', 'IP Address', 'Location', 'City', 'Country', 'ISP', 'Device Model', 'Device Type', 'OS', 'Browser', 'Screen', 'Login Time', 'Logout Time', 'Last Active'];
        
        const csvRows = [headers.join(',')];

        sessions.forEach(s => {
            const row = [
                `"${s.id || ''}"`,
                `"${s.userType || ''}"`,
                `"${(s.userId || '').replace(/"/g, '""')}"`,
                `"${(s.userName || '').replace(/"/g, '""')}"`,
                `"${s.userRole || ''}"`,
                `"${s.status || ''}"`,
                s.durationSeconds || 0,
                `"${s.ip || ''}"`,
                `"${(s.location || '').replace(/"/g, '""')}"`,
                `"${(s.city || '').replace(/"/g, '""')}"`,
                `"${(s.country || '').replace(/"/g, '""')}"`,
                `"${(s.isp || '').replace(/"/g, '""')}"`,
                `"${(s.deviceModel || '').replace(/"/g, '""')}"`,
                `"${s.deviceType || ''}"`,
                `"${(s.os || '').replace(/"/g, '""')}"`,
                `"${(s.browser || '').replace(/"/g, '""')}"`,
                `"${s.screen || ''}"`,
                `"${s.loginAt || ''}"`,
                `"${s.logoutAt || ''}"`,
                `"${s.lastActiveAt || ''}"`
            ];
            csvRows.push(row.join(','));
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sessions_report_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Sessions report CSV downloaded!');
    }
};

window.adminApp = adminApp;

document.addEventListener('DOMContentLoaded', () => {
    adminApp.init();
});
