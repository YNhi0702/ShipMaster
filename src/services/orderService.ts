// src/services/orderService.ts
// Service này chịu trách nhiệm quản lý thông tin các đơn sửa chữa tàu (repairOrder) trên Firestore.
import { collection, query, where, getDocs, getDoc, doc, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Định nghĩa interface mô tả cấu trúc của một Đơn sửa chữa tàu
export interface RepairOrderData {
    id?: string;                            // ID tự động của Document trên Firestore
    StartDate: any;                         // Thời gian bắt đầu tạo đơn sửa chữa (Timestamp)
    Status: string;                         // Trạng thái đơn (ví dụ: "Chờ giám định", "Đang giám định", "Hoàn thành sửa chữa", v.v.)
    description: string;                    // Mô tả chi tiết hỏng hóc từ phía khách hàng
    imageList: { [key: string]: string };   // Danh sách URL ảnh chụp chỗ hỏng hóc (dưới dạng key-value)
    inspectorId: string;                    // UID của Giám định viên được phân công
    invoiceId: string;                      // ID của Hóa đơn đi kèm (nếu đã tạo hóa đơn)
    shipId: string;                         // ID của Tàu cần sửa chữa (tham chiếu bảng 'ship')
    totalCostId: number;                    // ID chi phí hoặc mã liên kết chi phí (nếu có)
    totalCost: number;                      // Tổng chi phí sửa chữa (được cập nhật sau khi giám định/hoàn thành)
    uid: string;                            // UID của khách hàng chủ tàu (chủ đơn hàng)
    workshopId: string;                     // ID của Xưởng sửa chữa được khách hàng chọn
    repairplan: string;                     // Kế hoạch/Phương án sửa chữa chi tiết do Giám định viên đề xuất
    
    // Các trường bổ sung hiển thị ở phía Client (không lưu trực tiếp cấu trúc thô trong DB này)
    createdAt?: string;                     // Ngày tạo định dạng chuỗi dễ đọc (DD/MM/YYYY)
    shipName?: string;                      // Tên của Tàu (lấy từ bảng 'ship' qua liên kết shipId)
    workshopName?: string;                  // Tên Xưởng sửa chữa (lấy từ bảng 'workShop' qua liên kết workshopId)
    rawStatus?: string;                     // Trạng thái gốc chưa qua xử lý
}

export const orderService = {
    /**
     * Hàm lấy tất cả đơn sửa chữa của một khách hàng dựa trên UID.
     * Sử dụng thuật toán tối ưu truy vấn O(1) Map Lookup tránh lỗi N+1 Query (tải dữ liệu tàu & xưởng song song).
     * @param uid UID của khách hàng
     * @returns Danh sách các đơn sửa chữa đã được map đầy đủ tên Tàu và tên Xưởng
     */
    getCustomerOrders: async (uid: string): Promise<RepairOrderData[]> => {
        // 1. Lấy danh sách các đơn sửa chữa thô của khách hàng từ Firestore
        const ordersRef = collection(db, 'repairOrder');
        const ordersQuery = query(ordersRef, where('uid', '==', uid));
        const ordersSnapshot = await getDocs(ordersQuery);
        
        const rawOrders = ordersSnapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
        })) as RepairOrderData[];

        // 2. Tối ưu hóa truy vấn: Gom các ID tàu (shipId) và ID xưởng (workshopId) độc nhất (không trùng lặp)
        const uniqueShipIds = Array.from(new Set(rawOrders.map(o => o.shipId).filter(Boolean)));
        const uniqueWorkshopIds = Array.from(new Set(rawOrders.map(o => o.workshopId).filter(Boolean)));

        // 3. Sử dụng Promise.all để gửi các yêu cầu truy vấn thông tin Tàu và Xưởng song song lên Firestore
        const [shipsSnapshots, workshopsSnapshots] = await Promise.all([
            Promise.all(uniqueShipIds.map(id => getDoc(doc(db, 'ship', id)))),
            Promise.all(uniqueWorkshopIds.map(id => getDoc(doc(db, 'workShop', id))))
        ]);

        // 4. Xây dựng Map tra cứu nhanh với độ phức tạp O(1) cho Tàu (Ship)
        const shipMap = new Map<string, string>();
        shipsSnapshots.forEach(snap => {
            if (snap.exists()) {
                shipMap.set(snap.id, snap.data().name || '');
            }
        });

        // 5. Xây dựng Map tra cứu nhanh với độ phức tạp O(1) cho Xưởng (Workshop)
        const workshopMap = new Map<string, string>();
        workshopsSnapshots.forEach(snap => {
            if (snap.exists()) {
                workshopMap.set(snap.id, snap.data().name || '');
            }
        });

        // 6. Ánh xạ ngược thông tin từ Map vào danh sách đơn sửa chữa để hoàn thiện dữ liệu hiển thị (DTO)
        return rawOrders.map(order => {
            // Định dạng ngày tạo dễ đọc
            let createdAt = '';
            if (order.StartDate?.toDate && typeof order.StartDate.toDate === 'function') {
                createdAt = order.StartDate.toDate().toLocaleDateString('vi-VN');
            } else if (order.StartDate) {
                const date = new Date(order.StartDate);
                if (!isNaN(date.getTime())) {
                    createdAt = date.toLocaleDateString('vi-VN');
                }
            }

            // Tra cứu nhanh tên tàu và tên xưởng từ Map (O(1)) thay vì truy vấn tuần tự DB trong vòng lặp
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
     * Hàm tạo mới một Đơn sửa chữa tàu (Repair Order) trên Firestore
     * Trạng thái mặc định khi tạo mới là "Chờ giám định"
     * @param orderData Thông tin của đơn hàng mới bao gồm UID khách hàng, ID tàu, ID xưởng, mô tả và danh sách ảnh
     * @returns ID của tài liệu (document) đơn sửa chữa vừa được tạo trên Firestore
     */
    createRepairOrder: async (orderData: {
        uid: string;
        shipId: string;
        workshopId: string;
        description: string;
        imageList: { [key: string]: string };
    }): Promise<string> => {
        const newOrder = {
            StartDate: Timestamp.now(),          // Đánh dấu thời điểm tạo đơn sửa chữa hiện tại
            Status: 'Chờ giám định',              // Trạng thái ban đầu chờ Giám định viên tiếp nhận
            description: orderData.description,
            imageList: orderData.imageList,
            inspectorId: '',                     // Chưa phân công Giám định viên
            invoiceId: '',                       // Chưa tạo hóa đơn
            shipId: orderData.shipId,
            totalCostId: 0,
            totalCost: 0,                        // Chi phí ban đầu bằng 0
            uid: orderData.uid,
            workshopId: orderData.workshopId,
            repairplan: '',                      // Chưa có phương án sửa chữa
        };
        // Thêm tài liệu mới vào collection 'repairOrder'
        const docRef = await addDoc(collection(db, 'repairOrder'), newOrder);
        return docRef.id;
    }
};

