// src/services/authService.ts
// Service này chịu trách nhiệm quản lý xác thực người dùng và truy vấn hồ sơ (profile) từ Firebase
import { signInWithEmailAndPassword, User } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';

// Định nghĩa interface cho thông tin chi tiết của người dùng trong hệ thống
export interface UserProfile {
    uid: string;             // UID duy nhất do Firebase Auth tạo ra
    email: string;           // Địa chỉ email của người dùng
    phone: string;           // Số điện thoại liên hệ
    fullName: string;        // Họ và tên đầy đủ
    role: string;            // Vai trò trong hệ thống (customer, inspector, workshop, accountant, director)
}

export const authService = {
    /**
     * Hàm đăng nhập tài khoản bằng Email và Mật khẩu thông qua Firebase Authentication
     * @param email Địa chỉ email đăng nhập
     * @param password Mật khẩu đăng nhập
     * @returns Thông tin đối tượng User của Firebase sau khi đăng nhập thành công
     */
    login: async (email: string, password: string): Promise<User> => {
        // Gọi thư viện Firebase Auth để xác thực email & password
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    },

    /**
     * Hàm lấy Vai trò (Role) của người dùng từ Firestore dựa trên UID
     * @param uid UID của người dùng cần lấy vai trò
     * @returns Tên vai trò (chuỗi) hoặc null nếu không tìm thấy thông tin
     */
    getUserRole: async (uid: string): Promise<string | null> => {
        // Truy vấn tài liệu có tên là UID của user trong collection 'users'
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
            // Trả về trường 'role' trong database, nếu không có thì trả về null
            return userDoc.data().role || null;
        }
        return null;
    },

    /**
     * Hàm lấy thông tin chi tiết của khách hàng từ Firestore dựa trên UID
     * @param uid UID của khách hàng
     * @returns Đối tượng chứa Họ tên, hoặc null nếu không tồn tại
     */
    getCustomerProfile: async (uid: string): Promise<{ fullName: string } | null> => {
        // Tham chiếu tới collection 'customers' trong Firestore
        const customersRef = collection(db, 'customers');
        // Tạo truy vấn lọc các tài liệu có trường 'uid' bằng với UID truyền vào
        const q = query(customersRef, where('uid', '==', uid));
        // Thực thi truy vấn lấy dữ liệu
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            // Lấy dữ liệu của tài liệu đầu tiên tìm thấy
            const data = snapshot.docs[0].data();
            return {
                fullName: data.fullName || 'Khách hàng',
            };
        }
        return null;
    }
};
