import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Tag, Space, Popconfirm, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, KeyOutlined } from '@ant-design/icons';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { httpsCallable } from 'firebase/functions';
import { db, auth as mainAuth, functions } from '../../firebase';

// Cấu hình Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAwe46FT7movyzNSXNPNpb7DVkXzn2-AKc",
    authDomain: "shipmaster-fb2eb.firebaseapp.com",
    projectId: "shipmaster-fb2eb",
    storageBucket: "shipmaster-fb2eb.firebasestorage.app",
    messagingSenderId: "281630004223",
    appId: "1:281630004223:web:d0032ad53a540815e50dca",
    measurementId: "G-8LKJW3RCG6"
};

// Khởi tạo app phụ để tạo user mà không bị logout
const getSecondaryAuth = () => {
    const appName = "SecondaryApp";
    let secondaryApp;
    const apps = getApps();
    const existingApp = apps.find(app => app.name === appName);
    
    if (existingApp) {
        secondaryApp = existingApp;
    } else {
        secondaryApp = initializeApp(firebaseConfig, appName);
    }
    
    return getAuth(secondaryApp);
};

interface UserData {
    id: string;
    uid: string;
    email: string;
    phone: string;
    role: string;
    createdAt?: any;
}

const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState<UserData | null>(null);
    const [changePassModalVisible, setChangePassModalVisible] = useState(false);
    const [selectedUserForPass, setSelectedUserForPass] = useState<UserData | null>(null);
    const [passForm] = Form.useForm();
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);
    const [messageApi, contextHolder] = message.useMessage();

    // Fetch users
    const fetchUsers = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'users'));
            const userList: UserData[] = [];
            querySnapshot.forEach((doc) => {
                userList.push({ id: doc.id, ...doc.data() } as UserData);
            });
            setUsers(userList);
        } catch (error) {
            messageApi.error('Lỗi tải danh sách người dùng');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // Handle Change Password
    const handleChangePassword = async () => {
        try {
            const values = await passForm.validateFields();
            setSubmitting(true);
            
            // Gọi Cloud Function để đổi mật khẩu (Cách chuẩn Backend)
            const changeUserPassword = httpsCallable(functions, 'changeUserPassword');
            
            await changeUserPassword({
                uid: selectedUserForPass?.uid,
                newPassword: values.newPassword
            });
            
            setChangePassModalVisible(false);
            passForm.resetFields();
            
            messageApi.success(`Đã cập nhật mật khẩu thành công!`);
            
        } catch (error: any) {
            console.error(error);
            // Nếu function chưa được deploy, nó sẽ lỗi. Fallback về thông báo cũ hoặc hiển thị lỗi.
            if (error.message.includes('internal') || error.message.includes('not found')) {
                 messageApi.warning("Chức năng đang được triển khai (Cloud Function). Vui lòng deploy backend để hoạt động.");
            } else {
                 messageApi.error("Lỗi đổi mật khẩu: " + error.message);
            }
        } finally {
            setSubmitting(false);
        }
    };

    // Handle Create/Update
    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);

            if (editingUser) {
                // Update
                const userRef = doc(db, 'users', editingUser.id);
                await updateDoc(userRef, {
                    fullName: values.fullName,
                    phone: values.phone,
                    role: values.role,
                });
                messageApi.success('Cập nhật thành công');
                setModalVisible(false);
                form.resetFields();
                fetchUsers();
            } else {
                // Create

                // Check phone uniqueness first
                const usersRef = collection(db, 'users');
                const q = query(usersRef, where("phone", "==", values.phone));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    messageApi.error("Số điện thoại đã tồn tại!");
                    setSubmitting(false);
                    return;
                }

                // 1. Create in Auth (using secondary app)
                const secondaryAuth = getSecondaryAuth();
                const userCredential = await createUserWithEmailAndPassword(secondaryAuth, values.email, values.password);
                const user = userCredential.user;

                // 2. Create in Firestore
                // Lưu đúng các trường như yêu cầu: email, fullName, phone, role, uid
                await setDoc(doc(db, 'users', user.uid), {
                    uid: user.uid,
                    email: values.email,
                    fullName: values.fullName,
                    phone: values.phone,
                    role: values.role,
                });

                // Nếu là customer, thêm vào collection customers
                if (values.role === 'customer') {
                    await setDoc(doc(db, 'customers', user.uid), {
                        uid: user.uid,
                        email: values.email,
                        phone: values.phone,
                        fullName: values.fullName,
                    });
                }

                messageApi.success('Tạo người dùng thành công');
                setModalVisible(false);
                form.resetFields();
                fetchUsers();
            }
        } catch (error: any) {
            console.error(error);
            if (error.code === 'auth/email-already-in-use') {
                messageApi.error("Email đã tồn tại!");
            } else if (error.code === 'auth/invalid-email') {
                messageApi.error("Email không hợp lệ!");
            } else if (error.code === 'auth/weak-password') {
                messageApi.error("Mật khẩu quá yếu! Mật khẩu phải có ít nhất 6 ký tự.");
            } else {
                messageApi.error("Có lỗi xảy ra: " + error.message);
            }
        } finally {
            setSubmitting(false);
        }
    };

    // Handle Delete
    const handleDelete = async (id: string) => {
        try {
            // 1. Gọi Cloud Function để xóa user trong Auth (Standard Backend)
            // Bắt buộc xóa Auth thành công mới xóa data để đảm bảo đồng bộ
            const deleteUserAuth = httpsCallable(functions, 'deleteUserAuth');
            await deleteUserAuth({ uid: id });

            // 2. Xóa dữ liệu trong Firestore (users và customers)
            await deleteDoc(doc(db, 'users', id));
            try {
                await deleteDoc(doc(db, 'customers', id));
            } catch (e) {
                // Ignore if not exists
            }
            
            message.success('Đã xóa người dùng hoàn toàn (Auth & Data).');
            fetchUsers();
        } catch (error: any) {
            console.error(error);
            message.error('Lỗi xóa người dùng: ' + error.message);
        }
    };

    // Handle Reset Password (Email) - Giữ lại như fallback hoặc bỏ nếu user không muốn
    const handleResetPassword = async (email: string) => {
        try {
            await sendPasswordResetEmail(mainAuth, email);
            message.success(`Đã gửi email đặt lại mật khẩu tới ${email}`);
        } catch (error: any) {
            message.error('Lỗi gửi email: ' + error.message);
        }
    };

    const columns = [
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
        },
        {
            title: 'Họ và tên',
            dataIndex: 'fullName',
            key: 'fullName',
        },
        {
            title: 'Số điện thoại',
            dataIndex: 'phone',
            key: 'phone',
        },
        {
            title: 'Vai trò',
            dataIndex: 'role',
            key: 'role',
            render: (role: string) => {
                let color = 'default';
                let text = role;
                switch (role) {
                    case 'director': color = 'gold'; text = 'Giám đốc'; break;
                    case 'accountant': color = 'green'; text = 'Kế toán'; break;
                    case 'inspector': color = 'cyan'; text = 'Giám định viên'; break;
                    case 'workshop_owner': color = 'purple'; text = 'Chủ xưởng'; break;
                    case 'customer': color = 'blue'; text = 'Khách hàng'; break;
                }
                return <Tag color={color}>{text.toUpperCase()}</Tag>;
            }
        },
        {
            title: 'Hành động',
            key: 'action',
            render: (_: any, record: UserData) => (
                <Space size="small">
                    <Tooltip title="Chỉnh sửa">
                        <Button 
                            icon={<EditOutlined />} 
                            onClick={() => {
                                setEditingUser(record);
                                form.setFieldsValue({
                                    email: record.email,
                                    fullName: (record as any).fullName,
                                    phone: record.phone,
                                    role: record.role
                                });
                                setModalVisible(true);
                            }} 
                        />
                    </Tooltip>
                    <Tooltip title="Đổi mật khẩu">
                        <Button 
                            icon={<KeyOutlined />} 
                            onClick={() => {
                                setSelectedUserForPass(record);
                                passForm.resetFields();
                                setChangePassModalVisible(true);
                            }}
                        />
                    </Tooltip>
                    <Tooltip title="Xóa">
                        <Popconfirm
                            title="Bạn có chắc chắn muốn xóa?"
                            onConfirm={() => handleDelete(record.id)}
                            okText="Xóa"
                            cancelText="Hủy"
                        >
                            <Button danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                    </Tooltip>
                </Space>
            ),
        },
    ];

    return (
        <div>
            {contextHolder}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Danh sách người dùng</h2>
                <Button 
                    type="primary" 
                    icon={<PlusOutlined />} 
                    onClick={() => {
                        setEditingUser(null);
                        form.resetFields();
                        setModalVisible(true);
                    }}
                >
                    Thêm người dùng
                </Button>
            </div>

            <Table 
                columns={columns} 
                dataSource={users} 
                rowKey="id" 
                loading={loading}
                pagination={{ pageSize: 10 }}
            />

            <Modal
                title="Đổi mật khẩu người dùng"
                open={changePassModalVisible}
                onOk={handleChangePassword}
                onCancel={() => setChangePassModalVisible(false)}
                confirmLoading={submitting}
            >
                <Form form={passForm} layout="vertical">
                    <div className="mb-4">
                        Đang đổi mật khẩu cho tài khoản: <strong>{selectedUserForPass?.email}</strong>
                    </div>
                    <Form.Item
                        name="newPassword"
                        label="Mật khẩu mới"
                        rules={[
                            { required: true, message: 'Vui lòng nhập mật khẩu mới' },
                            { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' }
                        ]}
                    >
                        <Input.Password />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={editingUser ? "Chỉnh sửa người dùng" : "Thêm người dùng mới"}
                open={modalVisible}
                onOk={handleOk}
                onCancel={() => setModalVisible(false)}
                confirmLoading={submitting}
            >
                <Form form={form} layout="vertical" autoComplete="off">
                    {/* Hack to disable browser autocomplete */}
                    <input type="text" style={{ position: 'absolute', opacity: 0, height: 0, width: 0, margin: 0, padding: 0, border: 0 }} />
                    <input type="password" style={{ position: 'absolute', opacity: 0, height: 0, width: 0, margin: 0, padding: 0, border: 0 }} />

                    <Form.Item
                        name="email"
                        label="Email"
                        rules={[
                            { required: true, message: 'Vui lòng nhập email' },
                            { type: 'email', message: 'Email không hợp lệ' }
                        ]}
                    >
                        <Input disabled={!!editingUser} autoComplete="new-password" />
                    </Form.Item>

                    {!editingUser && (
                        <Form.Item
                            name="password"
                            label="Mật khẩu"
                            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
                        >
                            <Input.Password autoComplete="new-password" />
                        </Form.Item>
                    )}

                    <Form.Item
                        name="fullName"
                        label="Họ và tên"
                        rules={[{ required: true, message: 'Vui lòng nhập họ và tên' }]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        name="phone"
                        label="Số điện thoại"
                        rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        name="role"
                        label="Vai trò"
                        rules={[{ required: true, message: 'Vui lòng chọn vai trò' }]}
                    >
                        <Select>
                            <Select.Option value="director">Giám đốc</Select.Option>
                            <Select.Option value="accountant">Kế toán</Select.Option>
                            <Select.Option value="inspector">Giám định viên</Select.Option>
                            <Select.Option value="workshop_owner">Chủ xưởng</Select.Option>
                            <Select.Option value="customer">Khách hàng</Select.Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default UserManagement;
