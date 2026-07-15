// src/pages/Auth/Login.tsx
// Component này quản lý giao diện đăng nhập và thực hiện điều hướng người dùng dựa vào Vai trò (Role-based Routing) sau khi xác thực thành công.
import React, { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { authService } from '../../services/authService';
import { useNavigate } from 'react-router-dom';

// Định nghĩa kiểu dữ liệu cho form đăng nhập
interface LoginFormValues {
    email: string;
    password: string;
}

const Login: React.FC = () => {
    const [loading, setLoading] = useState(false); // Trạng thái chờ xử lý khi đang gửi thông tin đăng nhập
    const navigate = useNavigate(); // Hook dùng để điều hướng trang
    const [messageApi, contextHolder] = message.useMessage(); // Sử dụng API thông báo từ Ant Design

    // Hàm xử lý khi người dùng nhấn Đăng nhập và form hợp lệ
    const onFinish = async (values: LoginFormValues) => {
        try {
            setLoading(true);

            // 1. Gọi Service thực hiện đăng nhập bằng Email và Password thông qua Firebase Authentication
            const user = await authService.login(values.email, values.password);

            // Lưu UID của người dùng vào SessionStorage để phục vụ cho các truy vấn sau này
            sessionStorage.setItem('uid', user.uid);

            // 2. Lấy vai trò (role) của người dùng từ Firestore dựa trên UID vừa đăng nhập
            const role = await authService.getUserRole(user.uid);

            // Nếu tài khoản không có cấu hình vai trò, chặn truy cập và báo lỗi
            if (!role) {
                messageApi.error("Tài khoản chưa được cấu hình trong hệ thống!");
                setLoading(false);
                return;
            }

            // 3. Lưu vai trò của user vào SessionStorage để bộ định tuyến bảo vệ (PrivateRoute) kiểm tra
            sessionStorage.setItem("role", role);

            messageApi.success("Đăng nhập thành công!");

            // 4. Thực hiện điều hướng người dùng về các Dashboard chuyên biệt dựa theo Vai trò (Role)
            switch (role) {
                case "customer":
                    // Khách hàng -> Về trang chủ mua hàng/tạo đơn của khách hàng
                    navigate("/");
                    break;
                case "inspector":
                    // Giám định viên -> Về trang dashboard lập phương án sửa chữa
                    navigate("/inspector");
                    break;
                case "workshop_owner":
                    // Chủ xưởng sửa chữa -> Về trang dashboard điều phối nhân sự/lịch sửa chữa
                    navigate("/workshop");
                    break;
                case "accountant":
                    // Kế toán -> Về trang quản lý hóa đơn/thanh toán và thống kê tài chính
                    navigate("/account"); 
                    break;
                case "director":
                    // Ban giám đốc -> Về trang quản lý hệ thống tổng quan (Admin/Director)
                    navigate("/director");
                    break;
                default:
                    messageApi.error("Role không hợp lệ!");
            }

        } catch (error: any) {
            console.error("Login error:", error.code);
            // Xử lý các lỗi đăng nhập phổ biến từ Firebase
            if (error.code === 'auth/invalid-email') {
                messageApi.error("Email sai định dạng!");
            } else {
                messageApi.error("Email hoặc mật khẩu không chính xác!");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container-login">
            {contextHolder}
            <div className="card">
                <Form name="login" layout="vertical" onFinish={onFinish} style={{ maxWidth: 400, margin: "auto", marginTop: "10%" }}>
                    <Form.Item label="Email" name="email" rules={[{ required: true, message: "Vui lòng nhập email!" }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item label="Mật khẩu" name="password" rules={[{ required: true, message: "Vui lòng nhập mật khẩu!" }]}>
                        <Input.Password />
                    </Form.Item>
                    <Form.Item>
                        <Button loading={loading} type="primary" htmlType="submit">
                            Đăng nhập
                        </Button>
                    </Form.Item>
                </Form>
            </div>
        </div>
    );
};

export default Login;

