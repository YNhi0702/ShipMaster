import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, message, Space, Popconfirm, Tooltip, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';

// Định nghĩa Interface Xưởng sửa chữa
interface Workshop {
    id: string;
    name: string;
    location: string;
    area: string;
    status: string;
    ownerID: string; // Khóa ngoại liên kết tới Chủ xưởng sửa chữa
}

// Interface định dạng Options cho ô Select chọn chủ xưởng
interface UserOption {
    uid: string;
    name: string;
    role: string;
}

const WorkshopManagement: React.FC = () => {
    const [workshops, setWorkshops] = useState<Workshop[]>([]); // Danh sách xưởng
    const [loading, setLoading] = useState(false); // Trạng thái tải bảng xưởng
    const [isModalVisible, setIsModalVisible] = useState(false); // Trạng thái đóng/mở Modal CRUD
    const [editingWorkshop, setEditingWorkshop] = useState<Workshop | null>(null); // Bản ghi xưởng đang sửa (null là thêm mới)
    const [userMap, setUserMap] = useState<Record<string, string>>({}); // Bản đồ ánh xạ ID người dùng sang Họ tên (để hiển thị nhanh tên chủ xưởng)
    const [potentialOwners, setPotentialOwners] = useState<UserOption[]>([]); // Danh sách chủ xưởng hợp lệ để lựa chọn
    const [form] = Form.useForm(); // Quản lý dữ liệu Form
    const [messageApi, contextHolder] = message.useMessage(); // Thông báo toast

    /**
     * Tải danh sách những người dùng có vai trò là "workshop_owner" (Chủ xưởng) 
     * để làm nguồn dữ liệu nạp vào Select Box
     */
    const fetchPotentialOwners = async () => {
        try {
            const q = query(collection(db, 'users'), where('role', '==', 'workshop_owner'));
            const usersSnap = await getDocs(q);
            const options: UserOption[] = [];
            usersSnap.forEach(doc => {
                const d = doc.data();
                options.push({
                    uid: d.uid || doc.id,
                    name: d.fullName || d.UserName || d.email || 'Unknown',
                    role: d.role
                });
            });
            setPotentialOwners(options);
        } catch (error) {
            console.error("Error fetching potential owners", error);
        }
    };

    /**
     * Tải toàn bộ danh sách các xưởng sửa chữa và lấy tên chủ xưởng tương ứng
     */
    const fetchWorkshops = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'workShop'));
            const workshopList: Workshop[] = [];
            querySnapshot.forEach((doc) => {
                workshopList.push({ id: doc.id, ...doc.data() } as Workshop);
            });
            setWorkshops(workshopList);
            
            // Lấy danh sách các ID chủ xưởng duy nhất để truy vấn họ tên hiển thị
            const ownerIds = Array.from(new Set(workshopList.map(w => w.ownerID).filter(id => id)));
            const newUserMap: Record<string, string> = {};
            
            // Truy vấn thông tin tên của từng chủ xưởng dựa trên UID qua 4 bước kiểm tra
            await Promise.all(ownerIds.map(async (uid) => {
                if (!uid) return;
                try {
                    let name = '';
                    
                    // 1. Kiểm tra trong collection 'users' theo Document ID
                    const userDoc = await getDoc(doc(db, 'users', uid));
                    if (userDoc.exists()) {
                        const d = userDoc.data();
                        name = d.fullName || d.UserName || '';
                    }

                    // 2. Dự phòng 1: Kiểm tra trong 'users' theo thuộc tính uid
                    if (!name) {
                         const q = query(collection(db, 'users'), where('uid', '==', uid));
                         const snap = await getDocs(q);
                         if (!snap.empty) {
                             const d = snap.docs[0].data();
                             name = d.fullName || d.UserName || '';
                         }
                    }

                    // 3. Dự phòng 2: Kiểm tra trong 'employees' theo Doc ID
                    if (!name) {
                        const empDoc = await getDoc(doc(db, 'employees', uid));
                        if (empDoc.exists()) {
                            const d = empDoc.data();
                            name = d.fullName || d.UserName || '';
                        }
                    }

                    // 4. Dự phòng 3: Kiểm tra trong 'customers' theo Doc ID
                    if (!name) {
                        const custDoc = await getDoc(doc(db, 'customers', uid));
                        if (custDoc.exists()) {
                            const d = custDoc.data();
                            name = d.fullName || d.UserName || '';
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

    // Tải dữ liệu ban đầu
    useEffect(() => {
        fetchWorkshops();
        fetchPotentialOwners();
    }, []);

    // Nhấp nút "Thêm xưởng" để mở Form rỗng
    const handleAdd = () => {
        setEditingWorkshop(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    // Nhấp "Sửa" xưởng để mở Form điền dữ liệu của xưởng đã chọn
    const handleEdit = (record: Workshop) => {
        setEditingWorkshop(record);
        
        // Kiểm tra xem ID chủ xưởng này có nằm trong danh sách chủ xưởng hợp lệ hiện tại hay không
        const ownerExists = potentialOwners.some(u => u.uid === record.ownerID);
        
        form.setFieldsValue({
            ...record,
            ownerID: ownerExists ? record.ownerID : undefined
        });
        setIsModalVisible(true);
    };

    // Xóa xưởng khỏi Firestore
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

    // Thực hiện Lưu thông tin xưởng (Thêm mới hoặc Cập nhật)
    const handleOk = async () => {
        try {
            const values = await form.validateFields();

            // Kiểm tra trùng lặp tên xưởng
            const isDuplicate = workshops.some(w => 
                w.name.trim().toLowerCase() === values.name.trim().toLowerCase() && 
                (!editingWorkshop || w.id !== editingWorkshop.id)
            );

            if (isDuplicate) {
                messageApi.error('Xưởng đã tồn tại');
                return;
            }

            if (editingWorkshop) {
                // Cập nhật thông tin xưởng đã có
                const workshopRef = doc(db, 'workShop', editingWorkshop.id);
                await updateDoc(workshopRef, values);
                messageApi.success('Cập nhật xưởng thành công');
            } else {
                // Tạo tài liệu xưởng mới
                await addDoc(collection(db, 'workShop'), values);
                messageApi.success('Thêm xưởng thành công');
            }
            setIsModalVisible(false);
            fetchWorkshops();
        } catch (error) {
            console.error("Error saving workshop: ", error);
        }
    };

    // Hủy bỏ thao tác sửa/thêm
    const handleCancel = () => {
        setIsModalVisible(false);
    };

    // Cấu hình các cột hiển thị của bảng quản lý xưởng
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
            render: (id: string) => userMap[id] || id || 'Chưa có', // Đối chiếu tên chủ xưởng qua map
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

            {/* Bảng hiển thị danh sách xưởng */}
            <Table
                columns={columns}
                dataSource={workshops}
                rowKey="id"
                loading={loading}
            />

            {/* Modal CRUD thêm / sửa xưởng */}
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
