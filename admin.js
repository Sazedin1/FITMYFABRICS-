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
        this.checkAuth();
        showToast('Login successful');
    },

    logout() {
        sessionStorage.removeItem('fmf_admin_session');
        this.checkAuth();
    },

    navigate(page, navElement) {
        if (!this.currentUser) return;
        
        // Enforce RBAC (Role-Based Access Control)
        if (page !== 'dashboard' && this.currentUser.role !== 'master') {
            if (!this.currentUser.access || !this.currentUser.access.includes(page)) {
                showToast('Access denied', 'error');
                return;
            }
        }

        this.currentRoute = page;
        // Update active nav
        if (navElement) {
            document.querySelectorAll('.admin-nav a').forEach(el => el.classList.remove('active'));
            navElement.classList.add('active');
        }

        const content = document.getElementById('admin-content');
        
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
                                    <button class="action-btn edit-btn" onclick="adminApp.toggleBlockCustomer('${c.id}', ${c.blocked ? 'false' : 'true'})">${c.blocked ? 'Unblock' : 'Block'}</button>
                                    <button class="action-btn delete-btn" onclick="adminApp.confirmDelete('customers', '${c.id}', 'adminApp.renderCustomers()')">Delete</button>
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
                        <div style="flex:1;">
                            <label>Product Image Width</label>
                            <input type="text" id="a-product-width" value="${s.productImgWidth || '100%'}" placeholder="e.g. 100%, 300px">
                        </div>
                        <div style="flex:1;">
                            <label>Product Image Height</label>
                            <input type="text" id="a-product-height" value="${s.productImgHeight || '200px'}" placeholder="e.g. 200px, 300px">
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

                    <h3 class="mt-2">Social Media Links</h3>
                    <div style="display:flex; gap:1rem; flex-wrap:wrap; background: #f9fafb; padding:1rem; border-radius:4px;" class="mt-1">
                        <div class="form-group" style="flex:1; min-width: 200px;">
                            <label>Facebook URL</label>
                            <input type="text" id="a-social-fb" value="${s.socialFb || ''}" placeholder="https://facebook.com/yourpage">
                        </div>
                        <div class="form-group" style="flex:1; min-width: 200px;">
                            <label>Instagram URL</label>
                            <input type="text" id="a-social-ig" value="${s.socialIg || ''}" placeholder="https://instagram.com/yourhandle">
                        </div>
                        <div class="form-group" style="flex:1; min-width: 200px;">
                            <label>TikTok URL</label>
                            <input type="text" id="a-social-tt" value="${s.socialTt || ''}" placeholder="https://tiktok.com/@yourhandle">
                        </div>
                        <div class="form-group" style="flex:1; min-width: 200px;">
                            <label>YouTube URL</label>
                            <input type="text" id="a-social-yt" value="${s.socialYt || ''}" placeholder="https://youtube.com/c/yourchannel">
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
        
        settings.heroBannerWidth = document.getElementById('a-hero-width').value;
        settings.heroBannerHeight = document.getElementById('a-hero-height').value;
        settings.productImgWidth = document.getElementById('a-product-width').value;
        settings.productImgHeight = document.getElementById('a-product-height').value;

        settings.showFeatured = document.getElementById('a-show-featured').checked;
        settings.showNewArrivals = document.getElementById('a-show-new').checked;
        settings.showOnSale = document.getElementById('a-show-sale').checked;

        settings.socialFb = document.getElementById('a-social-fb').value.trim();
        settings.socialIg = document.getElementById('a-social-ig').value.trim();
        settings.socialTt = document.getElementById('a-social-tt').value.trim();
        settings.socialYt = document.getElementById('a-social-yt').value.trim();

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

                    <h3 class="mt-2">Global Size Guide (HTML)</h3>
                    <div class="form-group mt-1">
                        <label>This guide is displayed in a popup on all product pages when the user clicks 'Size Guide'.</label>
                        <textarea id="s-size-guide" rows="10" style="width:100%; font-family:monospace; margin-top:0.5rem; padding:0.5rem; border:1px solid #ddd;">${s.globalSizeGuide || ''}</textarea>
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
                                    <button class="action-btn delete-btn" onclick="adminApp.confirmDelete('admins', '${a.id}', 'adminApp.renderStaff()')">Delete</button>
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
    }
};

window.adminApp = adminApp;

document.addEventListener('DOMContentLoaded', () => {
    adminApp.init();
});
