import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
    apiKey: "AIzaSyAwe46FT7movyzNSXNPNpb7DVkXzn2-AKc",
    authDomain: "shipmaster-fb2eb.firebaseapp.com",
    projectId: "shipmaster-fb2eb",
    storageBucket: "shipmaster-fb2eb.firebasestorage.app",
    messagingSenderId: "281630004223",
    appId: "1:281630004223:web:d0032ad53a540815e50dca",
    measurementId: "G-8LKJW3RCG6"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
