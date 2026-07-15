// src/services/shipService.ts
// Service này quản lý thông tin các Tàu thuyền (ship) của khách hàng trên Firestore
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Interface đại diện cho dữ liệu của một chiếc Tàu trong hệ thống
export interface ShipData {
    id?: string;                     // ID tự động của Document trên Firestore
    name: string;                    // Tên tàu
    registration_number: string;     // Số đăng kiểm của tàu
    registered_port: string;         // Cảng đăng ký
    type: string;                    // Loại tàu (ví dụ: Tàu chở hàng, Tàu du lịch, v.v.)
    year_built: string;              // Năm đóng tàu
    hull_material: string;           // Vật liệu vỏ tàu (ví dụ: Sắt, Thép, Composite, v.v.)
    length_overall: number;          // Chiều dài lớn nhất (LOA) tính bằng mét
    width: number;                   // Chiều rộng lớn nhất tính bằng mét
    daft: number;                    // Mớn nước tính bằng mét
    main_engine_count: number;       // Số lượng máy chính
    auxiliary_engines_count: number; // Số lượng máy phụ
    uid: string;                     // UID của chủ tàu (khách hàng)
}

export const shipService = {
    /**
     * Hàm lấy tất cả các tàu thuộc sở hữu của một khách hàng cụ thể
     * @param uid UID của khách hàng (chủ tàu)
     * @returns Mảng chứa danh sách các tàu kèm theo ID tương ứng
     */
    getUserShips: async (uid: string): Promise<ShipData[]> => {
        // Tạo truy vấn lọc các tài liệu trong collection 'ship' có trường 'uid' khớp với UID truyền vào
        const shipQuery = query(collection(db, 'ship'), where('uid', '==', uid));
        const shipSnapshot = await getDocs(shipQuery);
        // Map kết quả trả về để thêm trường ID của tài liệu Firestore vào object dữ liệu tàu
        return shipSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as ShipData[];
    },

    /**
     * Hàm thêm mới một chiếc tàu vào hệ thống Firestore
     * @param shipData Dữ liệu tàu cần lưu (không bao gồm trường id)
     * @returns ID của tài liệu vừa được tạo trên Firestore
     */
    createShip: async (shipData: Omit<ShipData, 'id'>): Promise<string> => {
        // Thêm tài liệu mới vào collection 'ship'
        const docRef = await addDoc(collection(db, 'ship'), shipData);
        return docRef.id;
    }
};

