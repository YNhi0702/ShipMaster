import React, { useState } from 'react';
import { Form, Input, Button, Checkbox, message, Radio } from 'antd';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, query, collection, where, getDocs, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

interface LoginFormValues {
    email: string;
    password: string;
}

const Login: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [isOfficer, setIsOfficer] = useState(false);
    const [staffRole, setStaffRole] = useState<'inspector' | 'workshop' | null>('inspector');
    const navigate = useNavigate();

    const onFinish = async (values: LoginFormValues) => {
        setLoading(true);
        try {
            const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
            const user = userCredential.user;
            sessionStorage.setItem('uid', user.uid);

            if (isOfficer) {
                // staff: choose between inspector (1) and workshop owner (3)
                const roleId = staffRole === 'inspector' ? 1 : 3;
                const q = query(collection(db, 'employees'), where('Email', '==', values.email), where('Role_ID', '==', roleId));
                const snapshot = await getDocs(q);
                if (snapshot.empty) {
                    message.error('Tài khoản này không thuộc role đã chọn!');
                    setLoading(false);
                    return;
                }
                const roleName = staffRole === 'inspector' ? 'Giám định viên' : 'Chủ xưởng';
                // write role into users/{uid} so PrivateRoute can detect it on auth state
                try {
                    const roleVal = staffRole === 'inspector' ? 'inspector' : 'workshop_owner';
                    await setDoc(doc(db, 'users', user.uid), { role: roleVal }, { merge: true });
                    // also fetch employee doc to get name and persist as UserName
                    const empDoc = snapshot.docs[0];
                    const empData = empDoc.data();
                    const fullName = empData.fullName || empData.UserName || empData.User || empData.name || null;
                    if (fullName) {
                        await setDoc(doc(db, 'users', user.uid), { UserName: fullName }, { merge: true });
                    }
                } catch (e) {
                    // ignore write errors
                }
                message.success(`Đăng nhập thành công (${roleName})`);
                if (staffRole === 'inspector') navigate('/inspector');
                else navigate('/workshop');
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

                    {isOfficer && (
                        <Form.Item label="Chọn vai trò">
                            <Radio.Group value={staffRole} onChange={e => setStaffRole(e.target.value)}>
                                <Radio value={'inspector'}>Giám định viên</Radio>
                                <Radio value={'workshop'}>Chủ xưởng</Radio>
                            </Radio.Group>
                        </Form.Item>
                    )}

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
