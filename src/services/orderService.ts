// src/services/orderService.ts
import { collection, query, where, getDocs, getDoc, doc, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface RepairOrderData {
    id?: string;
    StartDate: any;
    Status: string;
    description: string;
    imageList: { [key: string]: string };
    inspectorId: string;
    invoiceId: string;
    shipId: string;
    totalCostId: number;
    totalCost: number;
    uid: string;
    workshopId: string;
    repairplan: string;
    // client populated fields
    createdAt?: string;
    shipName?: string;
    workshopName?: string;
    rawStatus?: string;
}

export const orderService = {
    /**
     * Fetch all repair orders for a user with pre-fetched ship and workshop names (Map-optimized)
     */
    getCustomerOrders: async (uid: string): Promise<RepairOrderData[]> => {
        const ordersRef = collection(db, 'repairOrder');
        const ordersQuery = query(ordersRef, where('uid', '==', uid));
        const ordersSnapshot = await getDocs(ordersQuery);
        
        const rawOrders = ordersSnapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
        })) as RepairOrderData[];

        // Extract unique IDs to batch query
        const uniqueShipIds = Array.from(new Set(rawOrders.map(o => o.shipId).filter(Boolean)));
        const uniqueWorkshopIds = Array.from(new Set(rawOrders.map(o => o.workshopId).filter(Boolean)));

        // Run batch queries in parallel
        const [shipsSnapshots, workshopsSnapshots] = await Promise.all([
            Promise.all(uniqueShipIds.map(id => getDoc(doc(db, 'ship', id)))),
            Promise.all(uniqueWorkshopIds.map(id => getDoc(doc(db, 'workShop', id))))
        ]);

        // Build O(1) maps
        const shipMap = new Map<string, string>();
        shipsSnapshots.forEach(snap => {
            if (snap.exists()) {
                shipMap.set(snap.id, snap.data().name || '');
            }
        });

        const workshopMap = new Map<string, string>();
        workshopsSnapshots.forEach(snap => {
            if (snap.exists()) {
                workshopMap.set(snap.id, snap.data().name || '');
            }
        });

        // Map over raw orders to build final response DTO
        return rawOrders.map(order => {
            let createdAt = '';
            if (order.StartDate?.toDate && typeof order.StartDate.toDate === 'function') {
                createdAt = order.StartDate.toDate().toLocaleDateString('vi-VN');
            } else if (order.StartDate) {
                const date = new Date(order.StartDate);
                if (!isNaN(date.getTime())) {
                    createdAt = date.toLocaleDateString('vi-VN');
                }
            }

            const shipName = shipMap.get(order.shipId) || 'Không xác định';
            const workshopName = workshopMap.get(order.workshopId) || 'Không xác định';
            const totalCost = Number(order.totalCost || 0);
            const rawStatus = order.Status || '';

            return {
                ...order,
                createdAt,
                shipName,
                workshopName,
                totalCost,
                rawStatus
            };
        });
    },

    /**
     * Create a new repair order document
     */
    createRepairOrder: async (orderData: {
        uid: string;
        shipId: string;
        workshopId: string;
        description: string;
        imageList: { [key: string]: string };
    }): Promise<string> => {
        const newOrder = {
            StartDate: Timestamp.now(),
            Status: 'Chờ giám định',
            description: orderData.description,
            imageList: orderData.imageList,
            inspectorId: '',
            invoiceId: '',
            shipId: orderData.shipId,
            totalCostId: 0,
            totalCost: 0,
            uid: orderData.uid,
            workshopId: orderData.workshopId,
            repairplan: '',
        };
        const docRef = await addDoc(collection(db, 'repairOrder'), newOrder);
        return docRef.id;
    }
};
