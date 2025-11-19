import React, { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';

interface RegisterFormValues {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    address: string;
}

const Register: React.FC = () => {
    const [loading, setLoading] = useState(false);

    const onFinish = async (values: RegisterFormValues) => {
        setLoading(true);
        try {
            // Tạo user bằng email/password
            const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
            const user = userCredential.user;

            // Lưu dữ liệu user vào collection users
            await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                email: values.email,
                phone: values.phone,
                username: values.email.split('@')[0],
                role: 'customer',
                createdAt: new Date().toISOString(),
            });

            // Lưu dữ liệu chi tiết khách hàng vào collection customers
            await setDoc(doc(db, 'customers', user.uid), {
                uid: user.uid,
                fullName: values.fullName,
                phone: values.phone,
                email: values.email,
                address: values.address,
            });

            message.success('Đăng ký thành công!');
        } catch (error: any) {
            message.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-h-[60vh] overflow-y-auto">
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
                    label="Địa chỉ"
                    name="address"
                    rules={[{required: true, message: 'Vui lòng nhập địa chỉ!'}]}
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
