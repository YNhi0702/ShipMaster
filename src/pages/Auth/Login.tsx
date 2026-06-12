import React, { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { authService } from '../../services/authService';
import { useNavigate } from 'react-router-dom';

interface LoginFormValues {
    email: string;
    password: string;
}

const Login: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const [messageApi, contextHolder] = message.useMessage();

    const onFinish = async (values: LoginFormValues) => {
        try {
            setLoading(true);

            // Login Firebase Auth via service
            const user = await authService.login(values.email, values.password);

            sessionStorage.setItem('uid', user.uid);

            // Fetch role via service
            const role = await authService.getUserRole(user.uid);

            if (!role) {
                messageApi.error("Tài khoản chưa được cấu hình trong hệ thống!");
                setLoading(false);
                return;
            }

            // Lưu role vào session
            sessionStorage.setItem("role", role);

            messageApi.success("Đăng nhập thành công!");

            // Điều hướng theo role
            switch (role) {
                case "customer":
                    navigate("/");
                    break;
                case "inspector":
                    navigate("/inspector");
                    break;
                case "workshop_owner":
                    navigate("/workshop");
                    break;
                case "accountant":
                    navigate("/account"); 
                    break;
                case "director":
                    navigate("/director");
                    break;
                default:
                    messageApi.error("Role không hợp lệ!");
            }

        } catch (error: any) {
            console.error("Login error:", error.code);
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
