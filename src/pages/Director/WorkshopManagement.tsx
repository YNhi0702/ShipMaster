import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, message, Space, Popconfirm, Tooltip, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';

interface Workshop {
    id: string;
    name: string;
    location: string;
    area: string;
    status: string;
    ownerID: string;
}

interface UserOption {
    uid: string;
    name: string;
    role: string;
}

const WorkshopManagement: React.FC = () => {
    const [workshops, setWorkshops] = useState<Workshop[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingWorkshop, setEditingWorkshop] = useState<Workshop | null>(null);
    const [userMap, setUserMap] = useState<Record<string, string>>({});
    const [potentialOwners, setPotentialOwners] = useState<UserOption[]>([]);
    const [form] = Form.useForm();
    const [messageApi, contextHolder] = message.useMessage();

    const fetchPotentialOwners = async () => {
        try {
            // Use Firestore query to filter by role
            const q = query(collection(db, 'users'),where('role', '==', 'workshop_owner'));
            const usersSnap = await getDocs(q);
            const options: UserOption[] = [];
            usersSnap.forEach(doc => {
                const d = doc.data();
                options.push({
                    uid: d.uid || doc.id,
                    name: d.fullName || d.UserName || d.name || d.displayName || d.email || 'Unknown',
                    role: d.role
                });
            });
            setPotentialOwners(options);
        } catch (error) {
            console.error("Error fetching potential owners", error);
        }
    };

    const fetchWorkshops = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'workShop'));
            const workshopList: Workshop[] = [];
            querySnapshot.forEach((doc) => {
                workshopList.push({ id: doc.id, ...doc.data() } as Workshop);
            });
            setWorkshops(workshopList);
            
            // Fetch owner names
            const ownerIds = Array.from(new Set(workshopList.map(w => w.ownerID).filter(id => id)));
            const newUserMap: Record<string, string> = {};
            
            await Promise.all(ownerIds.map(async (uid) => {
                if (!uid) return;
                try {
                    let name = '';
                    
                    // 1. Try users collection by Doc ID
                    const userDoc = await getDoc(doc(db, 'users', uid));
                    if (userDoc.exists()) {
                        const d = userDoc.data();
                        name = d.fullName || d.UserName || d.name || d.displayName || '';
                    }

                    // 2. If not found, try users collection by uid field
                    if (!name) {
                         const q = query(collection(db, 'users'), where('uid', '==', uid));
                         const snap = await getDocs(q);
                         if (!snap.empty) {
                             const d = snap.docs[0].data();
                             name = d.fullName || d.UserName || d.name || d.displayName || '';
                         }
                    }

                    // 3. If not found, try employees collection by Doc ID
                    if (!name) {
                        const empDoc = await getDoc(doc(db, 'employees', uid));
                        if (empDoc.exists()) {
                            const d = empDoc.data();
                            name = d.fullName || d.UserName || d.name || d.displayName || '';
                        }
                    }

                    // 4. If not found, try employees collection by uid field
                    if (!name) {
                         const q = query(collection(db, 'employees'), where('uid', '==', uid));
                         const snap = await getDocs(q);
                         if (!snap.empty) {
                             const d = snap.docs[0].data();
                             name = d.fullName || d.UserName || d.name || d.displayName || '';
                         }
                    }

                    // 5. If not found, try customers collection by Doc ID
                    if (!name) {
                        const custDoc = await getDoc(doc(db, 'customers', uid));
                        if (custDoc.exists()) {
                            const d = custDoc.data();
                            name = d.fullName || d.UserName || d.name || d.displayName || '';
                        }
                    }

                    // 6. If not found, try customers collection by uid field
                    if (!name) {
                         const q = query(collection(db, 'customers'), where('uid', '==', uid));
                         const snap = await getDocs(q);
                         if (!snap.empty) {
                             const d = snap.docs[0].data();
                             name = d.fullName || d.UserName || d.name || d.displayName || '';
                         }
                    }

                    if (name) {
                        newUserMap[uid] = name;
                    } else {
                        newUserMap[uid] = 'Chưa cập nhật';
                    }
                } catch (e) {
                    console.error(`Error fetching user ${uid}`, e);
                    newUserMap[uid] = 'Chưa cập nhật';
                }
            }));
            setUserMap(newUserMap);

        } catch (error) {
            console.error("Error fetching workshops: ", error);
            messageApi.error('Không thể tải danh sách xưởng');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWorkshops();
        fetchPotentialOwners();
    }, []);

    const handleAdd = () => {
        setEditingWorkshop(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    const handleEdit = (record: Workshop) => {
        setEditingWorkshop(record);
        
        // Kiểm tra xem ownerID hiện tại có nằm trong danh sách chủ xưởng (có tên) hay không
        // Nếu không có trong danh sách (tức là không lấy được tên), thì set thành undefined để ô input trống
        const ownerExists = potentialOwners.some(u => u.uid === record.ownerID);
        
        form.setFieldsValue({
            ...record,
            ownerID: ownerExists ? record.ownerID : undefined
        });
        setIsModalVisible(true);
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'workShop', id));
            messageApi.success('Xóa xưởng thành công');
            fetchWorkshops();
        } catch (error) {
            console.error("Error deleting workshop: ", error);
            messageApi.error('Không thể xóa xưởng');
        }
    };

    const handleOk = async () => {
        try {
            const values = await form.validateFields();

            // Check duplicate name
            const isDuplicate = workshops.some(w => 
                w.name.trim().toLowerCase() === values.name.trim().toLowerCase() && 
                (!editingWorkshop || w.id !== editingWorkshop.id)
            );

            if (isDuplicate) {
                messageApi.error('Xưởng đã tồn tại');
                return;
            }

            if (editingWorkshop) {
                // Update
                const workshopRef = doc(db, 'workShop', editingWorkshop.id);
                await updateDoc(workshopRef, values);
                messageApi.success('Cập nhật xưởng thành công');
            } else {
                // Create
                await addDoc(collection(db, 'workShop'), values);
                messageApi.success('Thêm xưởng thành công');
            }
            setIsModalVisible(false);
            fetchWorkshops();
        } catch (error) {
            console.error("Error saving workshop: ", error);
            // message.error('Có lỗi xảy ra khi lưu thông tin'); // Prevent double error if validateFields fails
        }
    };

    const handleCancel = () => {
        setIsModalVisible(false);
    };

    const columns = [
        {
            title: 'Tên xưởng',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: 'Địa chỉ',
            dataIndex: 'location',
            key: 'location',
        },
        {
            title: 'Diện tích',
            dataIndex: 'area',
            key: 'area',
        },
        {
            title: 'Chủ xưởng',
            dataIndex: 'ownerID',
            key: 'ownerID',
            render: (id: string) => userMap[id] || id || 'Chưa có',
        },
        {
            title: 'Hành động',
            key: 'action',
            render: (_: any, record: Workshop) => (
                <Space size="small">
                    <Tooltip title="Sửa">
                        <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
                    </Tooltip>
                    <Popconfirm
                        title="Bạn có chắc chắn muốn xóa xưởng này?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Có"
                        cancelText="Không"
                    >
                        <Tooltip title="Xóa">
                            <Button type="text" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div style={{ padding: '20px' }}>
            {contextHolder}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2 className="text-xl font-bold">Danh sách xưởng</h2>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                    Thêm xưởng
                </Button>
            </div>

            <Table
                columns={columns}
                dataSource={workshops}
                rowKey="id"
                loading={loading}
            />

            <Modal
                title={editingWorkshop ? "Sửa thông tin xưởng" : "Thêm xưởng mới"}
                open={isModalVisible}
                onOk={handleOk}
                onCancel={handleCancel}
            >
                <Form
                    form={form}
                    layout="vertical"
                    name="workshopForm"
                >
                    <Form.Item
                        name="name"
                        label="Tên xưởng"
                        rules={[{ required: true, message: 'Vui lòng nhập tên xưởng!' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="location"
                        label="Địa chỉ"
                        rules={[{ required: true, message: 'Vui lòng nhập địa chỉ!' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="area"
                        label="Diện tích"
                        rules={[{ required: true, message: 'Vui lòng nhập diện tích!' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="ownerID"
                        label="Chủ xưởng"
                        rules={[{ required: true, message: 'Vui lòng chọn chủ xưởng!' }]}
                    >
                        <Select
                            showSearch
                            placeholder="Chọn chủ xưởng"
                            optionFilterProp="children"
                            filterOption={(input, option) =>
                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                            options={potentialOwners.map(u => ({
                                value: u.uid,
                                label: `${u.name}`
                            }))}
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default WorkshopManagement;
