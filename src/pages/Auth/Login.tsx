import React, { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
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

            // Login Firebase Auth
            const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
            const user = userCredential.user;

            sessionStorage.setItem('uid', user.uid);

            // Fetch Firestore
            const userDoc = await getDoc(doc(db, 'users', user.uid));

            if (!userDoc.exists()) {
                messageApi.error("Tài khoản chưa được cấu hình trong hệ thống!");
                setLoading(false);
                return;
            }

            const data = userDoc.data();
            const role = data.role;

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
