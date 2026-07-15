// src/services/workshopService.ts
// Service này chịu trách nhiệm quản lý thông tin các Xưởng sửa chữa (workShop) từ Firestore
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// Interface mô tả cấu trúc của Xưởng sửa chữa
export interface WorkshopData {
    id: string;          // ID tự động của Document trên Firestore
    name: string;        // Tên xưởng sửa chữa
    [key: string]: any;  // Các thuộc tính bổ sung khác (địa chỉ, số điện thoại, v.v.)
}

export const workshopService = {
    /**
     * Hàm lấy toàn bộ danh sách các Xưởng sửa chữa có trong hệ thống database
     * @returns Mảng chứa danh sách tất cả các xưởng sửa chữa
     */
    getAllWorkshops: async (): Promise<WorkshopData[]> => {
        // Tải toàn bộ tài liệu trong collection 'workShop' từ Firestore
        const workshopSnapshot = await getDocs(collection(db, 'workShop'));
        // Map kết quả để chèn ID tài liệu tương ứng vào object dữ liệu xưởng
        return workshopSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as WorkshopData[];
    }
};

