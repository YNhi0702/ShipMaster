import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, message, Popconfirm, Spin, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

const { Option } = Select;

interface StaffRecord {
    id?: string;
    fullName?: string; // display name (UserName)
    phone?: string;
    email?: string;
    expertise?: string; // Base Expertise field
    level?: string;     // Level field parsed from Expertise
    roleId?: any; // Role_ID
    workShopID?: string; // workShopID field in employees
    createdAt?: any;
    rawExpertise?: string; // original Expertise string
}

interface Workshop {
    id: string;
    name: string;
}

const StaffManagement: React.FC = () => {
    const [staff, setStaff] = useState<StaffRecord[]>([]);
    const [workshops, setWorkshops] = useState<Workshop[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState<StaffRecord | null>(null);

    const [form] = Form.useForm();
    const [selectedWorkshop, setSelectedWorkshop] = useState<string>('all');

    const fetchStaff = async () => {
        try {
            setLoading(true);
            const snap = await getDocs(collection(db, 'employees'));
            const rows = snap.docs.map((d) => {
                const data = d.data() as any;
                const rawExp = data.Expertise || data.expertise || '';
                const parts = rawExp.split(' - ');
                const baseExp = parts[0] ? parts[0].trim() : '';
                const lvl = parts[1] ? parts[1].trim() : 'Bậc 2';

                return {
                    id: d.id,
                    fullName: data.UserName || data.fullName || data.name || '',
                    phone: data.Phone || data.phone || data.mobile || data.PhoneNumber || '',
                    email: data.Email || data.email || '',
                    expertise: baseExp,
                    level: lvl,
                    roleId: (data.Role_ID ?? data.roleId ?? data.Role) || null,
                    workShopID: data.workShopID || data.workShopId || data.workshopId || data.workshop || null,
                    createdAt: data.createdAt || data.created_at || null,
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

    useEffect(() => {
        fetchStaff();
        fetchWorkshops();
    }, []);

    const openAdd = () => {
        setEditing(null);
        form.resetFields();
        form.setFieldsValue({ level: 'Bậc 2' });
        setModalOpen(true);
    };

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

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            setSaving(true);
            const finalExpertise = `${values.expertise} - ${values.level || 'Bậc 2'}`;

            if (editing && editing.id) {
                const ref = doc(db, 'employees', editing.id);
                await updateDoc(ref, {
                    UserName: values.fullName || '',
                    Phone: values.phone || '',
                    Email: values.email || '',
                    Expertise: finalExpertise,
                    Role_ID: 5,
                    workShopID: values.workshopSelect || null,
                    updatedAt: serverTimestamp(),
                });
                message.success('Cập nhật nhân sự thành công.');
            } else {
                await addDoc(collection(db, 'employees'), {
                    UserName: values.fullName || '',
                    Phone: values.phone || '',
                    Email: values.email || '',
                    Expertise: finalExpertise,
                    Role_ID: 5,
                    workShopID: values.workshopSelect || null,
                    createdAt: serverTimestamp(),
                });
                message.success('Thêm nhân sự thành công.');
            }

            setModalOpen(false);
            form.resetFields();
            await fetchStaff();
        } catch (error: any) {
            if (error.errorFields) return; // validation error
            console.error('Save failed', error);
            message.error('Không thể lưu nhân sự.');
        } finally {
            setSaving(false);
        }
    };

    const columns = [
        { title: 'Họ tên', dataIndex: 'fullName', key: 'fullName' },
        { title: 'Số điện thoại', dataIndex: 'phone', key: 'phone' },
        { title: 'Email', dataIndex: 'email', key: 'email' },
        { title: 'Chuyên môn', dataIndex: 'expertise', key: 'expertise' },
        {
            title: 'Năng lực / Bậc',
            key: 'level',
            render: (_: any, record: StaffRecord) => (
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
                    <div className="mb-4">
                        <Select
                            showSearch
                            placeholder="Tất cả"
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
