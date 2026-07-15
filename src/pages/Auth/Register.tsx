// src/pages/Auth/Register.tsx
// Component này xử lý đăng ký tài khoản Khách hàng (customer) mới, hỗ trợ kiểm tra số điện thoại duy nhất.
import React, { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../../firebase';

// Định nghĩa kiểu dữ liệu cho form đăng ký
interface RegisterFormValues {
    email: string;
    password: string;
    fullName: string;
    phone: string;
}

const Register: React.FC = () => {
    const [loading, setLoading] = useState(false); // Trạng thái chờ xử lý khi submit form
    const [messageApi, contextHolder] = message.useMessage(); // Sử dụng api thông báo của Ant Design

    // Hàm xử lý chính khi người dùng nhấn nút Đăng ký và form hợp lệ
    const onFinish = async (values: RegisterFormValues) => {
        setLoading(true);
        try {
            // 1. Kiểm tra xem số điện thoại đã được đăng ký bởi tài khoản nào khác trong hệ thống chưa
            const q = query(collection(db, "users"), where("phone", "==", values.phone));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                messageApi.error("Số điện thoại đã tồn tại trong hệ thống!");
                setLoading(false);
                return;
            }

            // 2. Gọi Firebase Auth để tạo tài khoản mới với email và password
            const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
            const user = userCredential.user;

            // 3. Lưu thông tin tài khoản cơ bản và phân quyền vào collection 'users'
            await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                email: values.email,
                phone: values.phone,
                fullName: values.fullName,
                role: 'customer',           // Mặc định đăng ký qua giao diện này là Khách hàng (customer)
            });

            // 4. Lưu thông tin hồ sơ chi tiết vào collection 'customers' để quản lý thông tin khách hàng
            await setDoc(doc(db, 'customers', user.uid), {
                uid: user.uid,
                fullName: values.fullName,
                phone: values.phone,
                email: values.email,
            });

            messageApi.success('Đăng ký thành công!');
        } catch (error: any) {
             // Bắt và xử lý các lỗi thường gặp từ Firebase Auth
             if (error.code === 'auth/email-already-in-use') {
                 messageApi.error("Email đã tồn tại trong hệ thống!");
             } else if (error.code === 'auth/invalid-email') {
                 messageApi.error("Email không hợp lệ!");
             } else if (error.code === 'auth/weak-password') {
                 messageApi.error("Mật khẩu quá yếu! Mật khẩu phải có ít nhất 6 ký tự.");
             } else {
                 messageApi.error("Đăng ký thất bại: " + error.message);
             }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-h-[60vh] overflow-y-auto">
            {contextHolder}
            <Form
                name="register"
                layout="vertical"
                onFinish={onFinish}
            >
                <Form.Item
                    label="Họ tên"
                    name="fullName"
                    rules={[{required: true, message: 'Vui lòng nhập họ tên!'}]}
                >
                    <Input/>
                </Form.Item>

                <Form.Item
                    label="Số điện thoại"
                    name="phone"
                    rules={[{required: true, message: 'Vui lòng nhập số điện thoại!'}]}
                >
                    <Input/>
                </Form.Item>

                <Form.Item
                    label="Email"
                    name="email"
                    rules={[
                        {required: true, message: 'Vui lòng nhập email!'},
                        {type: 'email', message: 'Email không hợp lệ!'},
                    ]}
                >
                    <Input/>
                </Form.Item>

                <Form.Item
                    label="Mật khẩu"
                    name="password"
                    rules={[{required: true, message: 'Vui lòng nhập mật khẩu!'}]}
                >
                    <Input.Password/>
                </Form.Item>

                <Form.Item>
                    <Button type="primary" htmlType="submit" loading={loading}>
                        Đăng ký
                    </Button>
                </Form.Item>
            </Form>
        </div>
    );
};

export default Register;
