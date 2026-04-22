// data.js - Shared data layer for FIT MY FABRICS

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection, getDocs, setLogLevel } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// Suppress benign WebChannel transport warnings from Firebase
setLogLevel('error');

const firebaseApp = initializeApp(firebaseConfig);
const firestore = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const DB_PREFIX = 'fmf_';

const defaultSettings = {
    storeName: 'FIT MY FABRICS',
    tagline: 'Wear Your Style',
    phone: '01700000000',
    email: 'contact@fitmyfabrics.com',
    address: 'Dhaka, Bangladesh',
    bkash: '01700000000',
    nagad: '01700000000',
    rocket: '01700000000',
    deliveryInside: 60,
    deliveryOutside: 120,
    deliveryExpress: 200,
    freeDeliveryThreshold: 999,
    facebook: '#',
    instagram: '#',
    whatsapp: '#',
    youtube: '',
    tiktok: '',
    twitter: '',
    mailProvider: 'simulation',
    mailServiceId: '',
    mailTemplateId: '',
    mailPublicKey: '',
    primaryColor: '#1a1a1a',
    accentColor: '#c9a84c',
    topBarText: 'Free shipping on all orders above ৳999!',
    heroHeadline: 'Wear Your Style',
    heroSubheadline: 'Discover the latest trends in Bangladeshi fashion.',
    heroImage: '',
    storeLogo: '',
    logoDisplayMode: 'logo-text',
    footerAbout: 'Wear Your Style. Premium clothing for the modern Bangladeshi.',
    showFeatured: true,
    showNewArrivals: true,
    showOnSale: true,
    maintenanceMode: false,
    heroBannerWidth: '100%',
    heroBannerHeight: '400px',
    productImgWidth: '100%',
    productImgHeight: '200px',
    globalSizeGuide: `<h4>Round Neck T-Shirt Size Chart (Inches)</h4>
<p>Round neck t-shirts are often designed with a "Regular Fit." If you are looking for a "Slim Fit," the chest measurements are usually reduced by 1 inch.</p>
<table width="100%" border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse; margin-bottom:1rem; text-align:center;">
    <tr><th>Size</th><th>Chest (Width)</th><th>Length</th><th>Sleeve Length</th></tr>
    <tr><td>M</td><td>38"</td><td>27"</td><td>7.5"</td></tr>
    <tr><td>L</td><td>40"</td><td>28"</td><td>8"</td></tr>
    <tr><td>XL</td><td>42"</td><td>29"</td><td>8.5"</td></tr>
    <tr><td>XXL</td><td>44"</td><td>30"</td><td>9"</td></tr>
</table>
<h4>Polo T-Shirt Size Chart (Inches)</h4>
<p>Polo shirts generally use a slightly heavier fabric (like Lacoste or Pique) and have a more structured fit compared to round necks.</p>
<table width="100%" border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse; margin-bottom:1rem; text-align:center;">
    <tr><th>Size</th><th>Chest (Width)</th><th>Length</th><th>Shoulder</th></tr>
    <tr><td>M</td><td>39"</td><td>27.5"</td><td>17.5"</td></tr>
    <tr><td>L</td><td>41"</td><td>28.5"</td><td>18.5"</td></tr>
    <tr><td>XL</td><td>43"</td><td>29.5"</td><td>19.5"</td></tr>
    <tr><td>XXL</td><td>45"</td><td>30.5"</td><td>20.5"</td></tr>
</table>
<h4>Key Considerations for Local Production</h4>
<p>Tolerance (garments sector), a +/- 0.5 inch tolerance is standard.</p>`
};

const seedCategories = [
    { id: 'c1', name: "Men's Wear", slug: 'mens-wear', description: 'Fashion for men', status: 'Active', comingSoon: false, image: '' },
    { id: 'c2', name: "Women's Wear", slug: 'womens-wear', description: 'Fashion for women', status: 'Active', comingSoon: true, image: '' },
    { id: 'c3', name: "Kids Collection", slug: 'kids-collection', description: 'Fashion for kids', status: 'Active', comingSoon: true, image: '' },
    { id: 'c4', name: "Traditional & Ethnic", slug: 'traditional-ethnic', description: 'Traditional wear', status: 'Active', comingSoon: true, image: '' },
    { id: 'c5', name: "Accessories", slug: 'accessories', description: 'Fashion accessories', status: 'Active', comingSoon: true, image: '' }
];

const seedProducts = [
    { id: 'p1', name: 'Classic White Shirt', category: 'c1', price: 1299, costPrice: 800, discountPrice: 999, stock: 50, sku: 'M-001', sizes: ['S', 'M', 'L', 'XL'], colors: ['#ffffff'], images: [], status: 'Active', featured: true, newArrival: false, description: 'A classic white shirt for men.' },
    { id: 'p2', name: 'Denim Jacket', category: 'c1', price: 2499, costPrice: 1500, discountPrice: null, stock: 20, sku: 'M-002', sizes: ['M', 'L', 'XL'], colors: ['#1e3a8a'], images: [], status: 'Active', featured: false, newArrival: true, description: 'Stylish denim jacket.' },
    { id: 'p3', name: 'Casual Chinos', category: 'c1', price: 1499, costPrice: 900, discountPrice: 1299, stock: 30, sku: 'M-003', sizes: ['30', '32', '34'], colors: ['#d1d5db', '#4b5563'], images: [], status: 'Active', featured: false, newArrival: false, description: 'Comfortable casual chinos.' },
    { id: 'p4', name: 'Floral Summer Dress', category: 'c2', price: 1899, costPrice: 1200, discountPrice: null, stock: 15, sku: 'W-001', sizes: ['S', 'M', 'L'], colors: ['#fecaca', '#bfdbfe'], images: [], status: 'Active', featured: true, newArrival: true, description: 'Beautiful floral summer dress.' },
    { id: 'p5', name: 'Elegant Saree', category: 'c4', price: 4500, costPrice: 2800, discountPrice: 3999, stock: 10, sku: 'T-001', sizes: ['Free Size'], colors: ['#dc2626', '#16a34a'], images: [], status: 'Active', featured: true, newArrival: false, description: 'Traditional elegant saree.' },
    { id: 'p6', name: 'Kids T-Shirt Combo', category: 'c3', price: 899, costPrice: 500, discountPrice: 799, stock: 40, sku: 'K-001', sizes: ['2-3Y', '4-5Y', '6-7Y'], colors: ['#fef08a', '#93c5fd'], images: [], status: 'Active', featured: false, newArrival: true, description: 'Pack of 2 kids t-shirts.' },
    { id: 'p7', name: 'Leather Wallet', category: 'c5', price: 599, costPrice: 300, discountPrice: null, stock: 100, sku: 'A-001', sizes: ['Free Size'], colors: ['#78350f', '#000000'], images: [], status: 'Active', featured: false, newArrival: false, description: 'Genuine leather wallet.' },
    { id: 'p8', name: 'Silk Panjabi', category: 'c4', price: 2199, costPrice: 1400, discountPrice: 1999, stock: 25, sku: 'T-002', sizes: ['38', '40', '42', '44'], colors: ['#000000', '#1e40af'], images: [], status: 'Active', featured: true, newArrival: true, description: 'Premium silk panjabi.' },
    { id: 'p9', name: 'Women Denim Pants', category: 'c2', price: 1599, costPrice: 900, discountPrice: null, stock: 35, sku: 'W-002', sizes: ['28', '30', '32'], colors: ['#1e3a8a', '#000000'], images: [], status: 'Active', featured: false, newArrival: false, description: 'High waist denim pants.' },
    { id: 'p10', name: 'Kids Party Frock', category: 'c3', price: 1799, costPrice: 1100, discountPrice: 1499, stock: 12, sku: 'K-002', sizes: ['3-4Y', '5-6Y'], colors: ['#fbcfe8'], images: [], status: 'Active', featured: true, newArrival: false, description: 'Cute party frock for girls.' },
    { id: 'p11', name: 'Sunglasses', category: 'c5', price: 499, costPrice: 200, discountPrice: 399, stock: 50, sku: 'A-002', sizes: ['Free Size'], colors: ['#000000'], images: [], status: 'Active', featured: false, newArrival: true, description: 'UV protection sunglasses.' },
    { id: 'p12', name: 'Formal Trousers', category: 'c1', price: 1699, costPrice: 900, discountPrice: null, stock: 28, sku: 'M-004', sizes: ['30', '32', '34', '36'], colors: ['#000000', '#374151'], images: [], status: 'Active', featured: false, newArrival: false, description: 'Slim fit formal trousers.' }
];

const seedCoupons = [
    { id: 'cp1', code: 'WELCOME10', type: '%', value: 10, minOrder: 1000, expiry: '2026-12-31', usageCount: 0, status: 'Active' },
    { id: 'cp2', code: 'FLAT100', type: 'flat', value: 100, minOrder: 1500, expiry: '2026-12-31', usageCount: 0, status: 'Active' }
];

// Initialize DB
function initDB() {
    let settings = JSON.parse(localStorage.getItem(DB_PREFIX + 'settings'));
    if (!settings) {
        settings = defaultSettings;
        localStorage.setItem(DB_PREFIX + 'settings', JSON.stringify(settings));
    } else if (typeof settings.globalSizeGuide === 'undefined') {
        settings.globalSizeGuide = defaultSettings.globalSizeGuide;
        localStorage.setItem(DB_PREFIX + 'settings', JSON.stringify(settings));
        // We also want to push this to firestore if app is initialized, but doing it via setDoc is cleaner below
    }
    if (!localStorage.getItem(DB_PREFIX + 'categories')) {
        localStorage.setItem(DB_PREFIX + 'categories', JSON.stringify(seedCategories));
    }
    if (!localStorage.getItem(DB_PREFIX + 'products')) {
        localStorage.setItem(DB_PREFIX + 'products', JSON.stringify(seedProducts));
    }
    if (!localStorage.getItem(DB_PREFIX + 'coupons')) {
        localStorage.setItem(DB_PREFIX + 'coupons', JSON.stringify(seedCoupons));
    }
    if (!localStorage.getItem(DB_PREFIX + 'orders')) {
        localStorage.setItem(DB_PREFIX + 'orders', JSON.stringify([]));
    }
    if (!localStorage.getItem(DB_PREFIX + 'banners')) {
        localStorage.setItem(DB_PREFIX + 'banners', JSON.stringify([]));
    }
    if (!localStorage.getItem(DB_PREFIX + 'admins')) {
        localStorage.setItem(DB_PREFIX + 'admins', JSON.stringify([]));
    }
    if (!localStorage.getItem(DB_PREFIX + 'customers')) {
        localStorage.setItem(DB_PREFIX + 'customers', JSON.stringify([]));
    }
    if (!localStorage.getItem(DB_PREFIX + 'cart')) {
        localStorage.setItem(DB_PREFIX + 'cart', JSON.stringify([]));
    }
    if (!localStorage.getItem(DB_PREFIX + 'wishlist')) {
        localStorage.setItem(DB_PREFIX + 'wishlist', JSON.stringify([]));
    }
}

initDB();

// CRUD Helpers
const db = {
    get: (table) => JSON.parse(localStorage.getItem(DB_PREFIX + table) || '[]'),
    set: (table, data) => localStorage.setItem(DB_PREFIX + table, JSON.stringify(data)),
    getOne: (table, id) => db.get(table).find(item => item.id === id),
    add: (table, item) => {
        const data = db.get(table);
        if (!item.id) {
            item.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        }
        data.push(item);
        localStorage.setItem(DB_PREFIX + table, JSON.stringify(data));
        setDoc(doc(firestore, table, item.id), item);
        return item;
    },
    update: (table, id, updates) => {
        const data = db.get(table);
        const index = data.findIndex(item => item.id === id);
        if (index !== -1) {
            data[index] = { ...data[index], ...updates };
            localStorage.setItem(DB_PREFIX + table, JSON.stringify(data));
            setDoc(doc(firestore, table, id), data[index]);
            return data[index];
        }
        return null;
    },
    delete: (table, id) => {
        const data = db.get(table);
        localStorage.setItem(DB_PREFIX + table, JSON.stringify(data.filter(item => item.id !== id)));
        deleteDoc(doc(firestore, table, id));
    },
    getSettings: () => JSON.parse(localStorage.getItem(DB_PREFIX + 'settings') || '{}'),
    setSettings: (settings) => {
        localStorage.setItem(DB_PREFIX + 'settings', JSON.stringify(settings));
        setDoc(doc(firestore, 'system', 'settings'), settings);
    }
};

let syncReadyCount = 0;
const syncTables = ['categories', 'products', 'coupons', 'orders', 'banners', 'admins', 'customers'];

syncTables.forEach(table => {
    onSnapshot(collection(firestore, table), (snapshot) => {
        const data = [];
        snapshot.forEach(doc => data.push(doc.data()));
        localStorage.setItem(DB_PREFIX + table, JSON.stringify(data));
        syncReadyCount++;
        checkIfAppReady();
    }, (error) => {
        console.warn(`Firestore sync warning for ${table}:`, error.message);
        syncReadyCount++; // Allows app to proceed with offline/cached Data
        checkIfAppReady();
    });
});

onSnapshot(doc(firestore, 'system', 'settings'), (docSnap) => {
    if (docSnap.exists()) {
        localStorage.setItem(DB_PREFIX + 'settings', JSON.stringify(docSnap.data()));
    }
    syncReadyCount++;
    checkIfAppReady();
}, (error) => {
    console.warn(`Firestore sync warning for settings:`, error.message);
    syncReadyCount++;
    checkIfAppReady();
});

export let isAppInitialized = false;
function checkIfAppReady() {
    // Wait until all 7 collections + 1 settings document are synced at least once
    if (syncReadyCount >= 8 && !isAppInitialized) {
        isAppInitialized = true;
        
        // Ensure size guide migration pushes to Firebase
        const currentSettings = db.getSettings();
        if (typeof currentSettings.globalSizeGuide === 'undefined') {
            currentSettings.globalSizeGuide = defaultSettings.globalSizeGuide;
            db.setSettings(currentSettings);
        }

        if (window.app && window.app.init) window.app.init();
        if (window.adminApp && window.adminApp.init) window.adminApp.init();
    } else if (isAppInitialized) {
        // If data changes AFTER initialization, refresh app views.
        if (window.app && window.app.renderHome) {
            // Using hash routing
            window.app.navigate(window.app.currentPage || 'home', window.app.currentParams || {});
        }
        if (window.adminApp && window.adminApp.renderDashboard) {
            if (window.adminApp.currentUser) {
                window.adminApp.navigate(window.adminApp.currentRoute || 'dashboard');
            }
        }
    }
}

// Image compression helper
function compressImage(file, maxWidth = 800) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
        };
    });
}

// Toast Notification
function showToast(message, type = 'success') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Format Currency
window.formatMoney = function(amount) {
    return '৳' + Number(amount).toLocaleString('en-IN');
}

window.db = db;
window.showToast = showToast;
window.compressImage = compressImage;
window.isAppInitialized = () => isAppInitialized;

// Seed Firebase if it's completely empty
async function seedFirebase() {
    try {
        const prodSnapshot = await getDocs(collection(firestore, 'products'));
        if (prodSnapshot.empty) {
            console.log('Database empty! Seeding data...');
            seedCategories.forEach(c => setDoc(doc(firestore, 'categories', c.id), c));
            seedProducts.forEach(p => setDoc(doc(firestore, 'products', p.id), p));
            seedCoupons.forEach(c => setDoc(doc(firestore, 'coupons', c.id), c));
            setDoc(doc(firestore, 'system', 'settings'), defaultSettings);
            setDoc(doc(firestore, 'admins', 'admin_1'), { email: 'admin@fitmyfabrics.com', password: 'Sagor22777@', role: 'master', name: 'Master Admin' });
        }
    } catch (e) {
        console.error('Seed error:', e);
    }
}

seedFirebase();

