import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout, Typography, Descriptions, Image, Button, Spin, message, Form, Input } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import InspectorSidebar from '../components/InspectorSidebar';
import InspectorLayout from '../components/InspectorLayout';

const { Header, Content } = Layout;
const { Title } = Typography;
const { TextArea } = Input;


const ProposalInspector: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [orderData, setOrderData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [shipName, setShipName] = useState('');
    const [workshopName, setWorkshopName] = useState('');
    const [shipInfo, setShipInfo] = useState<any | null>(null);
    const [employeeName, setEmployeeName] = useState('');
    const [proposalLoading, setProposalLoading] = useState(false);
    const [form] = Form.useForm();
    const [proposal, setProposal] = useState<string>('');
    const [userName, setUserName] = useState('');
    const [loadingUser, setLoadingUser] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const uid = sessionStorage.getItem('uid');
            if (!uid) {
                navigate('/login');
                return;
            }

            try {
                // Lấy thông tin giám định viên
                const employeesRef = collection(db, 'employees');
                const empQuery = query(employeesRef, where('__name__', '==', uid));
                const empSnapshot = await getDocs(empQuery);
                if (!empSnapshot.empty) {
                    setUserName(empSnapshot.docs[0].data().UserName || 'Giám định viên');
                }
                setLoadingUser(false);

                // Lấy thông tin đơn hàng
                if (id) {
                    setLoading(true);
                    const orderRef = doc(db, 'repairOrder', id);
                    const orderSnap = await getDoc(orderRef);
                    if (orderSnap.exists()) {
                        const data = orderSnap.data();
                        setOrderData({
                            id,
                            ...data,
                            createdAt: data?.StartDate?.toDate().toLocaleDateString('vi-VN'),
                        });
                    } else {
                        message.error('Không tìm thấy đơn hàng.');
                        navigate('/inspector');
                    }
                }
            } catch (error) {
                message.error('Lỗi tải dữ liệu.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, navigate]);

    useEffect(() => {
        const fetchNames = async () => {
            if (!orderData) return;
            try {
                const [shipSnap, workshopSnap, employeeSnap] = await Promise.all([
                    getDoc(doc(db, 'ship', orderData.shipId)),
                    getDoc(doc(db, 'workShop', orderData.workshopId)),
                    getDoc(doc(db, 'employees', orderData.inspectorId)),
                ]);
                if (shipSnap.exists()) {
                    const s = shipSnap.data();
                    setShipName(s.name || 'Không xác định');
                    setShipInfo(s);
                } else {
                    setShipName('Không xác định');
                    setShipInfo(null);
                }
                setWorkshopName(workshopSnap.exists() ? workshopSnap.data().name : 'Không xác định');
                setEmployeeName(employeeSnap.exists() ? employeeSnap.data().fullName : orderData.inspectorId);
            } catch (error) {
                // ignore
            }
        };
        fetchNames();
    }, [orderData]);


    const handleSubmitProposal = async (values: any) => {
        if (!orderData) return;
        setProposalLoading(true);
        try {
            await updateDoc(doc(db, 'repairOrder', orderData.id), {
                repairplan: proposal,
                Status: 'Đã đề xuất phương án',
            });
            
            message.success('Đã gửi đề xuất phương án thành công!');
            setTimeout(() => {
                navigate('/inspector');
            }, 1500);
        } catch (e) {
            message.error('Lỗi khi gửi đề xuất.');
        } finally {
            setProposalLoading(false);
        }
    };


    if (loading || !orderData) {
        return <div className="p-6"><Spin /> Đang tải dữ liệu...</div>;
    }

    const {
        createdAt,
        Status,
        invoiceId,
        totalCostId,
        imageList = {},
    } = orderData;

    return (
        <InspectorLayout
            selectedKey="proposal"
            onSelect={(key) => {
                if (key === 'orders') navigate('/inspector');
                else if (key === 'proposal') navigate('/inspector?tab=proposal');
            }}
            userName={userName}
            loadingUser={loadingUser}
        >
                    <div className="flex justify-between items-center mb-6">
                        <Title level={3} className="m-0">Đề xuất phương án sửa chữa</Title>
                        <Button onClick={() => navigate(-1)}>Quay lại</Button>
                    </div>
                <Descriptions title="Thông tin đơn" bordered column={1}>
                    <Descriptions.Item label="Mã đơn">{id}</Descriptions.Item>
                    <Descriptions.Item label="Ngày tạo">{createdAt}</Descriptions.Item>
                    <Descriptions.Item label="Trạng thái">{Status}</Descriptions.Item>
                    <Descriptions.Item label="Tàu">{shipName}</Descriptions.Item>
                    <Descriptions.Item label="Cán bộ giám định">{orderData.assignedInspector || employeeName || 'Chưa được gán'}</Descriptions.Item>
                    <Descriptions.Item label="Xưởng">{workshopName}</Descriptions.Item>
                    {orderData.description && (
                        <Descriptions.Item label="Mô tả">{orderData.description}</Descriptions.Item>
                    )}

                    {/* Thông tin tàu gộp chung trong bảng */}
                    {shipInfo?.registration_number && (
                        <Descriptions.Item label="Số đăng ký">{shipInfo.registration_number}</Descriptions.Item>
                    )}
                    {shipInfo?.registered_port && (
                        <Descriptions.Item label="Cảng đăng ký">{shipInfo.registered_port}</Descriptions.Item>
                    )}
                    {shipInfo?.type && (
                        <Descriptions.Item label="Loại tàu">{shipInfo.type}</Descriptions.Item>
                    )}
                    {shipInfo?.year_built && (
                        <Descriptions.Item label="Năm đóng tàu">{shipInfo.year_built}</Descriptions.Item>
                    )}
                    {shipInfo?.hull_material && (
                        <Descriptions.Item label="Vật liệu vỏ">{shipInfo.hull_material}</Descriptions.Item>
                    )}
                    {shipInfo?.length_overall !== undefined && (
                        <Descriptions.Item label="Chiều dài (m)">{shipInfo.length_overall}</Descriptions.Item>
                    )}
                    {shipInfo?.width !== undefined && (
                        <Descriptions.Item label="Chiều rộng (m)">{shipInfo.width}</Descriptions.Item>
                    )}
                    {shipInfo?.daft !== undefined && (
                        <Descriptions.Item label="Mớn nước (m)">{shipInfo.daft}</Descriptions.Item>
                    )}
                    {shipInfo?.main_engine_count !== undefined && (
                        <Descriptions.Item label="Số động cơ chính">{shipInfo.main_engine_count}</Descriptions.Item>
                    )}
                    {shipInfo?.auxiliary_engines_count !== undefined && (
                        <Descriptions.Item label="Số động cơ phụ">{shipInfo.auxiliary_engines_count}</Descriptions.Item>
                    )}
                </Descriptions>

                <div className="mt-6">
                    <Title level={4}>Hình ảnh</Title>
                    <div className="flex gap-4 flex-wrap">
                        {Object.values(imageList as { [key: string]: string }).map((url, index) => (
                            <Image key={index} width={200} src={url} alt={`img-${index}`} />
                        ))}
                    </div>
                </div>


                <div className="mt-8">
                    <Title level={4}>Đề xuất phương án sửa chữa</Title>
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleSubmitProposal}
                        className="max-w-2xl"
                    >
                        <Form.Item
                            label="Phương án đề xuất"
                            name="proposal"
                            rules={[{ required: true, message: 'Vui lòng nhập phương án đề xuất!' }]}
                        >
                            <Input.TextArea 
                                rows={6} 
                                value={proposal}
                                onChange={(e) => setProposal(e.target.value)}
                                placeholder="Mô tả phương án sửa chữa cụ thể: thay thế, hàn, gia công, làm mới, vật tư cần thiết, thời gian dự kiến..." 
                            />
                        </Form.Item>

                        <Form.Item>
                            <Button type="primary" htmlType="submit" loading={proposalLoading} size="large">
                                Gửi đề xuất phương án
                            </Button>
                        </Form.Item>
                    </Form>
                </div>
        </InspectorLayout>
    );
};

export default ProposalInspector;
