import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, message, Popconfirm, Spin, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

const { Option } = Select;

// Định nghĩa Interface dữ liệu nhân viên
interface StaffRecord {
    id?: string;           // ID tài liệu trong collection 'employees'
    fullName?: string;     // Tên nhân viên (UserName)
    phone?: string;        // Số điện thoại
    email?: string;        // Địa chỉ email
    expertise?: string;    // Chuyên môn cơ bản (Ví dụ: Thợ máy tàu)
    level?: string;        // Bậc tay nghề (Bậc 1, Bậc 2, Bậc 3)
    roleId?: any;          // Role ID phân quyền
    workShopID?: string;   // ID xưởng nơi nhân viên làm việc
    createdAt?: any;
    rawExpertise?: string; // Chuỗi Expertise gốc gộp (Ví dụ: "Thợ máy tàu - Bậc 2")
}

// Định nghĩa Interface Xưởng sửa chữa
interface Workshop {
    id: string;
    name: string;
}

const StaffManagement: React.FC = () => {
    const [staff, setStaff] = useState<StaffRecord[]>([]); // Danh sách nhân viên thợ
    const [workshops, setWorkshops] = useState<Workshop[]>([]); // Danh sách các xưởng sửa chữa
    const [loading, setLoading] = useState<boolean>(true); // Trạng thái tải danh sách
    const [modalOpen, setModalOpen] = useState(false); // Trạng thái ẩn/hiện Modal CRUD
    const [saving, setSaving] = useState(false); // Trạng thái spinner khi ấn lưu nhân sự
    const [editing, setEditing] = useState<StaffRecord | null>(null); // Bản ghi nhân viên đang sửa (null nếu là thêm mới)

    const [form] = Form.useForm(); // Quản lý dữ liệu Form
    const [selectedWorkshop, setSelectedWorkshop] = useState<string>('all'); // Bộ lọc danh sách thợ theo xưởng

    /**
     * Tải danh sách nhân sự từ collection 'employees'
     */
    const fetchStaff = async () => {
        try {
            setLoading(true);
            const snap = await getDocs(collection(db, 'employees'));
            const rows = snap.docs.map((d) => {
                const data = d.data() as any;
                const rawExp = data.Expertise || data.expertise || '';
                
                // Tách chuỗi chuyên môn động (Ví dụ: "Thợ điện tàu - Bậc 3" -> "Thợ điện tàu" và "Bậc 3")
                const parts = rawExp.split(' - ');
                const baseExp = parts[0] ? parts[0].trim() : '';
                const lvl = parts[1] ? parts[1].trim() : 'Bậc 2'; // Mặc định là Bậc 2

                return {
                    id: d.id,
                    fullName: data.UserName || data.fullName || data.name || '',
                    phone: data.Phone || data.PhoneNumber || '',
                    email: data.Email || data.email || '',
                    expertise: baseExp,
                    level: lvl,
                    roleId: (data.Role_ID ?? data.roleId) || null,
                    workShopID: data.workShopID || data.workShopId || data.workshopId || null,
                    createdAt: data.createdAt || null,
                    rawExpertise: rawExp,
                    raw: data,
                } as StaffRecord;
            });
            setStaff(rows as StaffRecord[]);
        } catch (error) {
            console.error('Failed to load staff', error);
            message.error('Lỗi khi tải danh sách nhân sự.');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Tải danh sách xưởng để đưa vào select box chọn xưởng cho nhân sự
     */
    const fetchWorkshops = async () => {
        try {
            const snap = await getDocs(collection(db, 'workShop'));
            const ws = snap.docs.map((d) => ({
                id: d.id,
                name: (d.data() as any).WorkShopName || (d.data() as any).name || 'Xưởng',
            }));
            setWorkshops(ws);
        } catch (error) {
            console.error('Failed to load workshops', error);
        }
    };

    // Tự động tải danh sách thợ và xưởng khi mở phân hệ quản lý nhân sự
    useEffect(() => {
        fetchStaff();
        fetchWorkshops();
    }, []);

    // Nhấp nút "Thêm nhân sự" để mở form trắng
    const openAdd = () => {
        setEditing(null);
        form.resetFields();
        form.setFieldsValue({ level: 'Bậc 2' }); // Đặt mặc định bậc thợ là Bậc 2
        setModalOpen(true);
    };

    // Nhấp nút "Chỉnh sửa" để mở form nạp thông tin nhân sự được chọn
    const openEdit = (record: StaffRecord) => {
        setEditing(record);
        form.setFieldsValue({
            fullName: record.fullName,
            phone: record.phone,
            email: record.email,
            expertise: record.expertise,
            level: record.level || 'Bậc 2',
            workshopSelect: record.workShopID,
        });
        setModalOpen(true);
    };

    // Xóa nhân viên khỏi database
    const handleDelete = async (id?: string) => {
        if (!id) return;
        try {
            await deleteDoc(doc(db, 'employees', id));
            message.success('Đã xoá nhân sự.');
            await fetchStaff();
        } catch (error) {
            console.error('Delete failed', error);
            message.error('Không thể xoá nhân sự.');
        }
    };

    // Lưu thông tin nhân viên (Thêm mới hoặc Cập nhật)
    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            setSaving(true);
            
            // Hợp nhất chuyên môn và bậc tay nghề thành 1 chuỗi để lưu vào Firestore (Ví dụ: "Thợ máy tàu - Bậc 3")
            const finalExpertise = `${values.expertise} - ${values.level || 'Bậc 2'}`;

            if (editing && editing.id) {
                // Thực hiện cập nhật
                const ref = doc(db, 'employees', editing.id);
                await updateDoc(ref, {
                    UserName: values.fullName || '',
                    Phone: values.phone || '',
                    Email: values.email || '',
                    Expertise: finalExpertise,
                    Role_ID: 5, // Gán cứng Role_ID = 5 đại diện cho Thợ sửa chữa
                    workShopID: values.workshopSelect || null,
                    updatedAt: serverTimestamp(),
                });
                message.success('Cập nhật nhân sự thành công.');
            } else {
                // Thực hiện thêm mới thợ vào collection 'employees'
                await addDoc(collection(db, 'employees'), {
                    UserName: values.fullName || '',
                    Phone: values.phone || '',
                    Email: values.email || '',
                    Expertise: finalExpertise,
                    Role_ID: 5, // Thợ kỹ thuật
                    workShopID: values.workshopSelect || null,
                    createdAt: serverTimestamp(),
                });
                message.success('Thêm nhân sự thành công.');
            }

            setModalOpen(false);
            form.resetFields();
            await fetchStaff();
        } catch (error: any) {
            if (error.errorFields) return; // Nếu form chưa nhập đủ thì bỏ qua
            console.error('Save failed', error);
            message.error('Không thể lưu nhân sự.');
        } finally {
            setSaving(false);
        }
    };

    // Định nghĩa các cột của bảng danh sách thợ
    const columns = [
        { title: 'Họ tên', dataIndex: 'fullName', key: 'fullName' },
        { title: 'Số điện thoại', dataIndex: 'phone', key: 'phone' },
        { title: 'Email', dataIndex: 'email', key: 'email' },
        { title: 'Chuyên môn', dataIndex: 'expertise', key: 'expertise' },
        {
            title: 'Năng lực / Bậc',
            key: 'level',
            render: (_: any, record: StaffRecord) => (
                // Hỗ trợ cập nhật nhanh Bậc thợ trực tiếp tại cột mà không cần mở modal
                <Select
                    value={record.level || 'Bậc 2'}
                    style={{ width: 110 }}
                    onChange={async (newLevel) => {
                        try {
                            const ref = doc(db, 'employees', record.id!);
                            const newExpString = `${record.expertise} - ${newLevel}`;
                            await updateDoc(ref, {
                                Expertise: newExpString,
                                updatedAt: serverTimestamp(),
                            });
                            message.success(`Đã cập nhật ${record.fullName} lên ${newLevel}`);
                            fetchStaff();
                        } catch (e) {
                            console.error('Failed to quick update level', e);
                            message.error('Không thể cập nhật bậc.');
                        }
                    }}
                >
                    <Option value="Bậc 1">Bậc 1</Option>
                    <Option value="Bậc 2">Bậc 2</Option>
                    <Option value="Bậc 3">Bậc 3</Option>
                </Select>
            ),
        },
        {
            title: 'Hành động',
            key: 'actions',
            render: (_: any, record: StaffRecord) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
                    <Popconfirm title="Bạn có muốn xoá?" onConfirm={() => handleDelete(record.id)}>
                        <Button danger icon={<DeleteOutlined />} size="small" />
                    </Popconfirm>
                </div>
            ),
        },
    ];

    return (
        <div className="p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="m-0" style={{ fontWeight: 'bold', fontSize: '16px' }}>Quản lý nhân sự</h3>
                <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Thêm nhân sự</Button>
            </div>

            {loading ? (
                <div className="p-6"><Spin /> Đang tải...</div>
            ) : (
                <>
                    {/* Bộ lọc nhân viên theo từng xưởng sửa chữa cụ thể */}
                    <div className="mb-4">
                        <Select
                            showSearch
                            placeholder="Tất cả xưởng"
                            style={{ width: 320 }}
                            optionFilterProp="children"
                            value={selectedWorkshop}
                            onChange={(val: any) => setSelectedWorkshop(val)}
                            filterOption={(input, option: any) =>
                                (option?.children ?? '').toString().toLowerCase().includes(input.toLowerCase())
                            }
                            allowClear
                        >
                            <Option value="all">Tất cả</Option>
                            {workshops.map((ws) => (
                                <Option key={ws.id} value={ws.id}>{ws.name}</Option>
                            ))}
                        </Select>
                    </div>

                    {/* Bảng hiển thị danh sách thợ sửa chữa */}
                    <Table
                        columns={columns}
                        dataSource={
                            selectedWorkshop === 'all' || !selectedWorkshop
                                ? staff
                                : staff.filter((s) => (s.workShopID || '') === selectedWorkshop)
                        }
                        rowKey={(r: any) => r.id}
                    />
                </>
            )}

            {/* Modal CRUD thêm / sửa thông tin nhân viên */}
            <Modal
                title={editing ? 'Sửa nhân sự' : 'Thêm nhân sự'}
                open={modalOpen}
                onCancel={() => { setModalOpen(false); form.resetFields(); }}
                onOk={handleSave}
                confirmLoading={saving}
                destroyOnClose
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="phone" label="Số điện thoại">
                        <Input />
                    </Form.Item>
                    <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Email không hợp lệ' }]}>
                        <Input />
                    </Form.Item>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <Form.Item name="expertise" label="Chuyên môn" rules={[{ required: true, message: 'Chọn chuyên môn' }]} style={{ flex: 1 }}>
                            <Select placeholder="Chọn chuyên môn">
                                <Option value="Thợ hàn / cơ khí vỏ tàu">Thợ hàn / cơ khí vỏ tàu</Option>
                                <Option value="Thợ máy tàu">Thợ máy tàu</Option>
                                <Option value="Thợ điện tàu">Thợ điện tàu</Option>
                                <Option value="Thợ sơn / vệ sinh tàu">Thợ sơn / vệ sinh tàu</Option>
                            </Select>
                        </Form.Item>
                        <Form.Item name="level" label="Năng lực (Bậc)" rules={[{ required: true, message: 'Chọn năng lực' }]} style={{ width: 150 }}>
                            <Select placeholder="Chọn bậc">
                                <Option value="Bậc 1">Bậc 1 (Mới / Phụ)</Option>
                                <Option value="Bậc 2">Bậc 2 (Thợ chính)</Option>
                                <Option value="Bậc 3">Bậc 3 (Thợ cả)</Option>
                            </Select>
                        </Form.Item>
                    </div>
                    <Form.Item name="workshopSelect" label="Xưởng" rules={[{ required: true, message: 'Chọn xưởng' }]}>
                        <Select placeholder="Chọn xưởng">
                            {workshops.map((ws) => (
                                <Option key={ws.id} value={ws.id}>{ws.name}</Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default StaffManagement;
