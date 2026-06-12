// src/services/workshopService.ts
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export interface WorkshopData {
    id: string;
    name: string;
    [key: string]: any;
}

export const workshopService = {
    /**
     * Fetch all workshops available in the database
     */
    getAllWorkshops: async (): Promise<WorkshopData[]> => {
        const workshopSnapshot = await getDocs(collection(db, 'workShop'));
        return workshopSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as WorkshopData[];
    }
};
