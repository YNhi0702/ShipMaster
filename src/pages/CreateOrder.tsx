import React, { useEffect, useState } from 'react';
import {
    Layout, Typography, Form, Select, Input, Upload,
    Button, message, Spin, Row, Col
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase';
import CustomerLayout from '../components/CustomerLayout';
import {
    collection, query, where, getDocs,
    addDoc, Timestamp
} from 'firebase/firestore';
import {
    ref, uploadBytes, getDownloadURL
} from 'firebase/storage';

const { Header, Content } = Layout;
const { Title } = Typography;
const { Option } = Select;

const CreateOrder: React.FC = () => {
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const [ships, setShips] = useState<any[]>([]);
    const [workshops, setWorkshops] = useState<any[]>([]);
    const [fileList, setFileList] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedShipId, setSelectedShipId] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            const uid = sessionStorage.getItem('uid');
            if (!uid) {
                navigate('/login');
                return;
            }

            try {
                const shipQuery = query(collection(db, 'ship'), where('uid', '==', uid));
                const shipSnapshot = await getDocs(shipQuery);
                const shipData = shipSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                const workshopQuery = query(collection(db, 'workShop'), where('status', '==', 'còn trống'));
                const workshopSnapshot = await getDocs(workshopQuery);
                const workshopData = workshopSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                setShips(shipData);
                setWorkshops(workshopData);
            } catch (error) {
                message.error('Lỗi khi tải dữ liệu.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [navigate]);

    const handleUpload = async () => {
    console.log("[DEBUG] Bấm nút tạo đơn");
    const uid = sessionStorage.getItem('uid');
        if (!uid) {
            message.error('Người dùng chưa đăng nhập.');
            return;
        }

        try {
            const values = await form.validateFields();
            setUploading(true);

            const imageUrls: { [key: string]: string } = {};
            for (let i = 0; i < fileList.length; i++) {
                const file = fileList[i].originFileObj as File;
                const safeName = `${Date.now()}_${(file.name || 'file')}`.replace(/[^A-Za-z0-9._-]/g, '_');
                const storageRef = ref(storage, `repairOrders/${uid}/${safeName}`);
                await uploadBytes(storageRef, file, { contentType: file.type || 'application/octet-stream' });
                const url = await getDownloadURL(storageRef);
                imageUrls[`img${i + 1}`] = url;
            }

            let shipId = selectedShipId;
            if (!shipId) {
                try {
                    console.log("Tạo ship");
                    const shipDoc = await addDoc(collection(db, 'ship'), {
                        name: values.name,
                        registration_number: values.registration_number,
                        registered_port: values.registered_port,
                        type: values.type,
                        year_built: values.year_built,
                        hull_material: values.hull_material,
                        length_overall: Number(values.length_overall),
                        width: Number(values.width),
                        daft: Number(values.daft),
                        main_engine_count: Number(values.main_engine_count),
                        auxiliary_engines_count: Number(values.auxiliary_engines_count),
                        uid,
                    });
                    console.log("Tạo ship thành công:", shipDoc.id);
                    shipId = shipDoc.id;
                } catch (e) {
                    console.error("Lỗi khi tạo ship:", e);
                }

            }

            await addDoc(collection(db, 'repairOrder'), {
                StartDate: Timestamp.now(),
                Status: 'Chờ giám định',
                description: values.description,
                imageList: imageUrls,
                inspectorId: '',
                invoiceId: '',
                shipId: shipId,
                totalCostId: 0,
                uid: uid,
                workshopId: values.workshopId,
                repairplan: '',
            });

            message.success('Tạo đơn sửa chữa thành công!');
            navigate('/');
        } catch (error) {
            message.error('Lỗi khi tạo đơn sửa chữa.');
        } finally {
            setUploading(false);
        }
    };

    const normFile = (e: any) => {
        if (Array.isArray(e)) return e;
        return e && e.fileList;
    };

    const isReadOnly = selectedShipId !== null;

    const [customerName, setCustomerName] = useState('');
    const [loadingUser, setLoadingUser] = useState(true);

    useEffect(() => {
        const loadCustomer = async () => {
            try {
                const uid = sessionStorage.getItem('uid');
                if (!uid) return;
                const customersRef = query(collection(db, 'customers'), where('uid', '==', uid));
                const snap = await getDocs(customersRef);
                if (!snap.empty) setCustomerName(snap.docs[0].data().fullName || 'Khách hàng');
            } finally {
                setLoadingUser(false);
            }
        };
        loadCustomer();
    }, []);

    if (loading) {
        return (
            <CustomerLayout userName={customerName} loadingUser={loadingUser}>
                <div className="p-6"><Spin /> Đang tải dữ liệu...</div>
            </CustomerLayout>
        );
    }

    return (
        <CustomerLayout userName={customerName} loadingUser={loadingUser}>
            <div className="mb-4">
                <Title level={3} className="m-0">Tạo đơn sửa chữa</Title>
            </div>
                <Form form={form} layout="vertical"  initialValues={{
                    workshopId: null,
                    description: '',
                }}>
                    <div className="flex justify-between items-center mb-4">
                        <Title level={4}>Thông tin tàu</Title>
                        <Select
                            style={{ width: 300 }}
                            placeholder="Chọn tàu đã từng sửa (nếu có)"
                            allowClear
                            onChange={(value) => {
                                if (value) {
                                    const selected = ships.find(s => s.id === value);
                                    if (selected) {
                                        setSelectedShipId(value);
                                        form.setFieldsValue({
                                            name: selected.name,
                                            registration_number: selected.registration_number,
                                            registered_port: selected.registered_port,
                                            type: selected.type,
                                            year_built: selected.year_built,
                                            hull_material: selected.hull_material,
                                            length_overall: selected.length_overall,
                                            width: selected.width,
                                            daft: selected.daft,
                                            main_engine_count: selected.main_engine_count,
                                            auxiliary_engines_count: selected.auxiliary_engines_count
                                        });
                                    }
                                } else {
                                    form.resetFields([
                                        'name',
                                        'registration_number',
                                        'registered_port',
                                        'type',
                                        'year_built',
                                        'hull_material',
                                        'length_overall',
                                        'width',
                                        'daft',
                                        'main_engine_count',
                                        'auxiliary_engines_count'
                                    ]);
                                    setSelectedShipId(null);
                                }
                            }}
                        >
                            {ships.map(ship => (
                                <Option key={ship.id} value={ship.id}>
                                    {ship.name} - {ship.registration_number}
                                </Option>
                            ))}
                        </Select>
                    </div>

                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="name" label="Tên tàu" rules={[{ required: true }]}><Input disabled={isReadOnly} /></Form.Item></Col>
                        <Col span={12}><Form.Item name="registration_number" label="Số đăng ký" rules={[{ required: true }]}><Input disabled={isReadOnly} /></Form.Item></Col>
                        <Col span={12}><Form.Item name="registered_port" label="Cảng đăng ký" rules={[{ required: true }]}><Input disabled={isReadOnly} /></Form.Item></Col>
                        <Col span={12}><Form.Item name="type" label="Loại tàu" rules={[{ required: true }]}><Input disabled={isReadOnly} /></Form.Item></Col>
                        <Col span={12}><Form.Item name="year_built" label="Năm đóng tàu" rules={[{ required: true }]}><Input disabled={isReadOnly} /></Form.Item></Col>
                        <Col span={12}><Form.Item name="hull_material" label="Vật liệu vỏ" rules={[{ required: true }]}><Input disabled={isReadOnly} /></Form.Item></Col>
                        <Col span={12}><Form.Item name="length_overall" label="Chiều dài (m)" rules={[{ required: true }]}><Input type="number" disabled={isReadOnly} /></Form.Item></Col>
                        <Col span={12}><Form.Item name="width" label="Chiều rộng (m)" rules={[{ required: true }]}><Input type="number" disabled={isReadOnly} /></Form.Item></Col>
                        <Col span={12}><Form.Item name="daft" label="Mớn nước (m)" rules={[{ required: true }]}><Input type="number" disabled={isReadOnly} /></Form.Item></Col>
                        <Col span={12}><Form.Item name="main_engine_count" label="Số động cơ chính" rules={[{ required: true }]}><Input type="number" disabled={isReadOnly} /></Form.Item></Col>
                        <Col span={12}><Form.Item name="auxiliary_engines_count" label="Số động cơ phụ" rules={[{ required: true }]}><Input type="number" disabled={isReadOnly} /></Form.Item></Col>
                    </Row>

                    <Form.Item
                        name="workshopId"
                        label="Chọn xưởng"
                        rules={[{ required: true, message: 'Vui lòng chọn xưởng' }]}
                    >
                        <Select placeholder="Chọn xưởng">
                            {workshops.map(ws => (
                                <Option key={ws.id} value={ws.id}>{ws.name}</Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="description"
                        label="Mô tả"
                        rules={[{ required: true, message: 'Vui lòng nhập mô tả' }]}
                    >
                        <Input.TextArea rows={4} placeholder="Nhập mô tả công việc sửa chữa" />
                    </Form.Item>
                    <Form.Item name="upload" label="Tải lên ảnh (tối đa 5 ảnh)" valuePropName="fileList" getValueFromEvent={normFile}>
                        <Upload listType="picture" beforeUpload={() => false} multiple maxCount={5} onChange={({ fileList }) => setFileList(fileList)}>
                            <Button icon={<UploadOutlined />}>Chọn ảnh</Button>
                        </Upload>
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" onClick={handleUpload} loading={uploading}>Tạo đơn</Button>
                    </Form.Item>
                </Form>
        </CustomerLayout>
    );
};

export default CreateOrder;
