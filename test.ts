import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const firebaseApp = initializeApp(firebaseConfig);
const firestore = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

async function checkDB() {
    console.log("Checking DB...");
    const snap = await getDocs(collection(firestore, 'products'));
    console.log("Products count:", snap.size);
    const catSnap = await getDocs(collection(firestore, 'categories'));
    console.log("Categories count:", catSnap.size);
    process.exit(0);
}

checkDB().catch(e => {
    console.error(e);
    process.exit(1);
});
