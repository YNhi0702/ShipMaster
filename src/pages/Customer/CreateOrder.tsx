// src/pages/Customer/CreateOrder.tsx
// Trang này cho phép Khách hàng điền thông tin tàu (hoặc chọn tàu cũ), chọn xưởng sửa chữa, mô tả hỏng hóc, tải ảnh lên Firebase Storage và gửi yêu cầu tạo đơn sửa chữa (repairOrder) mới.
import React, { useEffect, useState } from 'react';
import {
    Layout, Typography, Form, Select, Input, Upload,
    Button, message, Spin, Row, Col
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { storage } from '../../firebase';
import CustomerLayout from '../../components/Customer/CustomerLayout';
import { authService } from '../../services/authService';
import { shipService } from '../../services/shipService';
import { workshopService } from '../../services/workshopService';
import { orderService } from '../../services/orderService';
import {
    ref, uploadBytes, getDownloadURL
} from 'firebase/storage';

const { Header, Content } = Layout;
const { Title } = Typography;
const { Option } = Select;

const CreateOrder: React.FC = () => {
    const navigate = useNavigate();
    const [form] = Form.useForm(); // Hook quản lý form của Ant Design
    const [ships, setShips] = useState<any[]>([]); // Danh sách các tàu đã có của khách hàng
    const [workshops, setWorkshops] = useState<any[]>([]); // Danh sách các xưởng sửa chữa trong hệ thống
    const [fileList, setFileList] = useState<any[]>([]); // Danh sách các file ảnh khách hàng đính kèm
    const [uploading, setUploading] = useState(false); // Trạng thái đang tải ảnh lên Storage và tạo đơn
    const [loading, setLoading] = useState(false); // Trạng thái đang tải dữ liệu khởi tạo
    const [selectedShipId, setSelectedShipId] = useState<string | null>(null); // Lưu ID tàu được chọn từ danh sách tàu cũ

    // 1. Tải danh sách tàu đã đăng ký của khách hàng và danh sách các xưởng sửa chữa khi mở trang
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const uid = sessionStorage.getItem('uid'); // Lấy UID người dùng hiện tại từ session
            if (!uid) {
                navigate('/login');
                return;
            }

            try {
                // Tải song song danh sách tàu của khách hàng và danh sách xưởng
                const [shipData, workshopData] = await Promise.all([
                    shipService.getUserShips(uid),
                    workshopService.getAllWorkshops()
                ]);

                setShips(shipData);
                setWorkshops(workshopData);
            } catch (error) {
                console.error("Error fetching data:", error);
                message.error('Lỗi khi tải dữ liệu.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [navigate]);

    // 2. Xử lý tải ảnh lên Firebase Storage và gọi Service tạo đơn sửa chữa mới
    const handleUpload = async () => {
        console.log("[DEBUG] Bấm nút tạo đơn");
        const uid = sessionStorage.getItem('uid');
        if (!uid) {
            message.error('Người dùng chưa đăng nhập.');
            return;
        }

        try {
            // Xác thực dữ liệu nhập vào form xem đã điền đủ các trường bắt buộc chưa
            const values = await form.validateFields();
            setUploading(true);

            // Tải ảnh lên Firebase Storage và lấy URL công khai
            const imageUrls: { [key: string]: string } = {};
            for (let i = 0; i < fileList.length; i++) {
                const file = fileList[i].originFileObj as File;
                // Chuẩn hóa tên file: loại bỏ các ký tự đặc biệt tránh lỗi URL
                const safeName = `${Date.now()}_${(file.name || 'file')}`.replace(/[^A-Za-z0-9._-]/g, '_');
                // Tạo đường dẫn lưu trữ trên Firebase Storage: repairOrders/{uid}/{tên_file}
                const storageRef = ref(storage, `repairOrders/${uid}/${safeName}`);
                
                // Tải byte dữ liệu lên Storage
                await uploadBytes(storageRef, file, { contentType: file.type || 'application/octet-stream' });
                // Lấy liên kết tải xuống (Download URL)
                const url = await getDownloadURL(storageRef);
                imageUrls[`img${i + 1}`] = url;
            }

            let shipId = selectedShipId;
            // Nếu khách hàng nhập tàu mới (không chọn từ danh sách tàu cũ), tiến hành tạo tài liệu Tàu mới trong DB
            if (!shipId) {
                try {
                    console.log("Tạo ship mới...");
                    shipId = await shipService.createShip({
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
                    console.log("Tạo ship thành công, ID:", shipId);
                } catch (e) {
                    console.error("Lỗi khi tạo ship:", e);
                }
            }

            // Gọi dịch vụ tạo đơn sửa chữa với thông tin tàu, xưởng và các ảnh hỏng hóc đã tải lên
            await orderService.createRepairOrder({
                uid: uid,
                shipId: shipId || '',
                workshopId: values.workshopId,
                description: values.description,
                imageList: imageUrls,
            });

            message.success('Tạo đơn sửa chữa thành công!');
            navigate('/'); // Quay về trang chủ dashboard khách hàng
        } catch (error) {
            message.error('Lỗi khi tạo đơn sửa chữa.');
        } finally {
            setUploading(false);
        }
    };

    // Hàm chuẩn hóa danh sách file từ sự kiện Upload
    const normFile = (e: any) => {
        if (Array.isArray(e)) return e;
        return e && e.fileList;
    };

    // Nếu chọn tàu đã tồn tại thì khóa các ô nhập liệu tàu để tránh ghi đè thông số
    const isReadOnly = selectedShipId !== null;

    const [customerName, setCustomerName] = useState('');
    const [loadingUser, setLoadingUser] = useState(true);

    // Tải thông tin họ tên khách hàng để hiển thị trên Layout Header
    useEffect(() => {
        const loadCustomer = async () => {
            try {
                const uid = sessionStorage.getItem('uid');
                if (!uid) return;
                const profile = await authService.getCustomerProfile(uid);
                if (profile) setCustomerName(profile.fullName);
            } finally {
                setLoadingUser(false);
            }
        };
        loadCustomer();
    }, []);

    // Hiển thị vòng xoay tải dữ liệu ban đầu
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
                {/* Khu vực chọn tàu cũ để tự động điền (Auto-fill) dữ liệu tàu */}
                <div className="flex justify-between items-center mb-4">
                    <Title level={4}>Thông tin tàu</Title>
                    <Select
                        style={{ width: 300 }}
                        placeholder="Chọn tàu đã từng sửa (nếu có)"
                        allowClear
                        onChange={(value) => {
                            if (value) {
                                // Tìm tàu tương ứng trong danh sách để điền tự động
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
                                // Nếu nhấn xóa chọn tàu cũ, xóa hết các trường thông tin tàu để nhập mới
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

                {/* Các ô nhập liệu thông số kỹ thuật của tàu */}
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

                {/* Chọn xưởng sửa chữa mong muốn */}
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

                {/* Nhập mô tả hỏng hóc từ phía khách hàng */}
                <Form.Item
                    name="description"
                    label="Mô tả"
                    rules={[{ required: true, message: 'Vui lòng nhập mô tả' }]}
                >
                    <Input.TextArea rows={4} placeholder="Nhập mô tả công việc sửa chữa" />
                </Form.Item>
                
                {/* Đính kèm ảnh chỗ hỏng để xưởng và giám định viên có cái nhìn trực quan */}
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

