import React, { useState } from 'react';
import { Form, Input, Button, Checkbox, message } from 'antd';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

interface LoginFormValues {
    email: string;
    password: string;
}

const Login: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [isOfficer, setIsOfficer] = useState(false);
    const navigate = useNavigate();

    const onFinish = async (values: LoginFormValues) => {
        setLoading(true);
        try {
            const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
            const user = userCredential.user;
            sessionStorage.setItem('uid', user.uid);

            if (isOfficer) {
                // Kiểm tra trong collection employees với Role_ID = 1
                const q = query(collection(db, 'employees'), where('Email', '==', values.email), where('Role_ID', '==', 1));
                const snapshot = await getDocs(q);
                if (snapshot.empty) {
                    message.error('Tài khoản này không phải giám định viên!');
                    setLoading(false);
                    return;
                }
                message.success('Đăng nhập thành công (Giám định viên)');
                navigate('/inspector');
            } else {
                // Đăng nhập khách hàng: chỉ cần đúng tài khoản là vào home
                message.success('Đăng nhập thành công (Khách hàng)');
                navigate('/');
            }
        } catch (error: any) {
            message.error("Đăng nhập thất bại: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={'container-login'}>
            <div className={'card'}>
                <Form
                    name="login"
                    layout="vertical"
                    onFinish={onFinish}
                    style={{ maxWidth: 400, margin: 'auto', marginTop: '10%' }}
                >
                    <h2>Đăng nhập</h2>
                    <Form.Item
                        label="Email"
                        name="email"
                        rules={[{ required: true, message: 'Vui lòng nhập email!' }]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        label="Mật khẩu"
                        name="password"
                        rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
                    >
                        <Input.Password />
                    </Form.Item>

                    <Form.Item>
                        <Checkbox checked={isOfficer} onChange={e => setIsOfficer(e.target.checked)}>
                            Tôi là cán bộ
                        </Checkbox>
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading}>
                            Đăng nhập
                        </Button>
                    </Form.Item>
                </Form>
            </div>
        </div>
    );
};

export default Login;
