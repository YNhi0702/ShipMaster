// src/services/shipService.ts
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface ShipData {
    id?: string;
    name: string;
    registration_number: string;
    registered_port: string;
    type: string;
    year_built: string;
    hull_material: string;
    length_overall: number;
    width: number;
    daft: number;
    main_engine_count: number;
    auxiliary_engines_count: number;
    uid: string;
}

export const shipService = {
    /**
     * Fetch all ships belonging to a specific user
     */
    getUserShips: async (uid: string): Promise<ShipData[]> => {
        const shipQuery = query(collection(db, 'ship'), where('uid', '==', uid));
        const shipSnapshot = await getDocs(shipQuery);
        return shipSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as ShipData[];
    },

    /**
     * Create a new ship document
     */
    createShip: async (shipData: Omit<ShipData, 'id'>): Promise<string> => {
        const docRef = await addDoc(collection(db, 'ship'), shipData);
        return docRef.id;
    }
};
