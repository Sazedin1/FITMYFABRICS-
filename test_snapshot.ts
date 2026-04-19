import { initializeApp } from 'firebase/app';
import { getFirestore, onSnapshot, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const firebaseApp = initializeApp(firebaseConfig);
const firestore = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const syncTables = ['categories', 'products', 'coupons', 'orders', 'banners', 'admins', 'customers'];
let ready = 0;

syncTables.forEach(table => {
    try {
        onSnapshot(collection(firestore, table), (snapshot) => {
            const data = [];
            snapshot.forEach(doc => data.push(doc.data()));
            console.log(`Synced ${table}: ${data.length} items`);
            ready++;
            if (ready === 7) {
                console.log("All synced successfully.");
                process.exit(0);
            }
        }, (error) => {
            console.error(`Error syncing ${table}:`, error);
        });
    } catch (e) {
        console.error("Setup error:", e);
    }
});
