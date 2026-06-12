// src/services/authService.ts
import { signInWithEmailAndPassword, User } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';

export interface UserProfile {
    uid: string;
    email: string;
    phone: string;
    fullName: string;
    role: string;
    myreferralCode?: string;
    referredByUid?: string;
    referredByCode?: string;
}

export const authService = {
    /**
     * Signs in a user with email and password
     */
    login: async (email: string, password: string): Promise<User> => {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    },

    /**
     * Gets the role of a user from their uid
     */
    getUserRole: async (uid: string): Promise<string | null> => {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
            return userDoc.data().role || null;
        }
        return null;
    },

    /**
     * Gets the customer details (name and referral code) for a user uid
     */
    getCustomerProfile: async (uid: string): Promise<{ fullName: string; myreferralCode: string } | null> => {
        const customersRef = collection(db, 'customers');
        const q = query(customersRef, where('uid', '==', uid));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            return {
                fullName: data.fullName || 'Khách hàng',
                myreferralCode: data.myreferralCode || data.myReferralCode || '',
            };
        }
        return null;
    }
};
