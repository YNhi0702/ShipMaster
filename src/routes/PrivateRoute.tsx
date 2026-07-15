import React, { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { authService } from '../services/authService';

// Định nghĩa kiểu dữ liệu cho Props truyền vào Component PrivateRoute
interface PrivateRouteProps {
    children: ReactNode;      // Các component con được bảo vệ bên trong Route này
    allowedRoles: string[];   // Danh sách các vai trò (roles) được phép truy cập vào Route này
}

/**
 * Component định tuyến bảo vệ (Guard Route) để kiểm soát quyền truy cập trang dựa trên vai trò của người dùng
 */
const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, allowedRoles }) => {
    const [userRole, setUserRole] = useState<string | null>(null); // Trạng thái lưu vai trò hiện tại của user
    const [loading, setLoading] = useState(true);                  // Trạng thái chờ tải thông tin vai trò

    useEffect(() => {
        let isActive = true; // Cờ hiệu ngăn ngừa tình trạng Memory Leak khi component bị unmount trước khi call API hoàn tất

        const fetchUserRole = async () => {
            setLoading(true);

            // 1. Kiểm tra xem vai trò đã được lưu trong SessionStorage hoặc LocalStorage trước đó chưa (để tránh gọi API liên tục)
            const cachedRole = sessionStorage.getItem('role') || localStorage.getItem('role');
            if (cachedRole) {
                if (isActive) {
                    setUserRole(cachedRole);
                    setLoading(false);
                }
                return;
            }

            // 2. Nếu chưa cache, kiểm tra xem UID của user có tồn tại trong storage không (chứng minh đã đăng nhập)
            const uid = sessionStorage.getItem('uid') || localStorage.getItem('uid');
            if (!uid) {
                if (isActive) {
                    setUserRole(null);
                    setLoading(false);
                }
                return;
            }

            // 3. Nếu đã đăng nhập nhưng chưa có vai trò trong cache, thực hiện gọi Service lấy vai trò từ Firestore
            try {
                const roleFromDb = await authService.getUserRole(uid);

                if (roleFromDb) {
                    // Lưu vai trò vào cache để tối ưu hiệu năng cho các lần chuyển hướng sau
                    sessionStorage.setItem('role', roleFromDb);
                    localStorage.setItem('role', roleFromDb);
                }

                if (isActive) {
                    setUserRole(roleFromDb);
                }
            } catch (error) {
                console.error('Error fetching user role:', error);
                if (isActive) {
                    setUserRole(null);
                }
            } finally {
                if (isActive) {
                    setLoading(false);
                }
            }
        };

        fetchUserRole();

        // Cleanup function được gọi khi Component bị hủy
        return () => {
            isActive = false;
        };
    }, []);

    // Hiển thị trạng thái đang tải trong lúc xác thực vai trò
    if (loading) return <div>Loading...</div>;
    
    // Nếu chưa đăng nhập (không có vai trò), chuyển hướng ngay về trang đăng nhập
    if (!userRole) return <Navigate to="/login" replace />;
    
    // Nếu đã đăng nhập nhưng vai trò hiện tại không thuộc danh sách được cho phép, chặn lại và trả về trang đăng nhập
    if (!allowedRoles.includes(userRole)) return <Navigate to="/login" replace />;

    // Nếu thỏa mãn mọi điều kiện, hiển thị các component con bên trong
    return <>{children}</>;
};

export default PrivateRoute;

