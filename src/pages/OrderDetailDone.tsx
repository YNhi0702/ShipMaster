import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Typography, Descriptions, Image, Button, Spin, message } from 'antd';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import InspectorLayout from '../components/InspectorLayout';

const { Title } = Typography;

const OrderDetailDone: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [orderData, setOrderData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [shipName, setShipName] = useState('');
    const [shipInfo, setShipInfo] = useState<any | null>(null);
    const [workshopName, setWorkshopName] = useState('');
    const [employeeName, setEmployeeName] = useState('');
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
                const employeesRef = collection(db, 'employees');
                const empQuery = query(employeesRef, where('__name__', '==', uid));
                const empSnapshot = await getDocs(empQuery);
                if (!empSnapshot.empty) {
                    setUserName(empSnapshot.docs[0].data().UserName || 'Giám định viên');
                }
                setLoadingUser(false);

                if (id) {
                    setLoading(true);
                    const orderRef = doc(db, 'repairOrder', id);
                    const orderSnap = await getDoc(orderRef);
                    if (orderSnap.exists()) {
                        const data = orderSnap.data();
                        setOrderData({ id, ...data, createdAt: data?.StartDate?.toDate().toLocaleDateString('vi-VN') });
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
                if (orderData.shipId) {
                    const shipSnap = await getDoc(doc(db, 'ship', orderData.shipId));
                    if (shipSnap.exists()) {
                        const s = shipSnap.data();
                        setShipName(s.name || 'Không xác định');
                        setShipInfo(s);
                    } else {
                        setShipName('Không xác định');
                        setShipInfo(null);
                    }
                } else {
                    setShipName('Không xác định');
                    setShipInfo(null);
                }
            } catch {
                setShipName('Không xác định');
                setShipInfo(null);
            }

            try {
                if (orderData.workshopId) {
                    const workshopSnap = await getDoc(doc(db, 'workShop', orderData.workshopId));
                    setWorkshopName(workshopSnap.exists() ? workshopSnap.data().name : 'Không xác định');
                } else {
                    setWorkshopName('Không xác định');
                }
            } catch {
                setWorkshopName('Không xác định');
            }

            try {
                if (orderData.inspectorId) {
                    const employeeSnap = await getDoc(doc(db, 'employees', orderData.inspectorId));
                    setEmployeeName(employeeSnap.exists() ? (employeeSnap.data().fullName || employeeSnap.data().UserName || orderData.inspectorId) : orderData.inspectorId);
                } else {
                    setEmployeeName('');
                }
            } catch {
                setEmployeeName(orderData.inspectorId || '');
            }
        };
        fetchNames();
    }, [orderData]);

    if (loading || !orderData) return <div className="p-6"><Spin /> Đang tải dữ liệu...</div>;

    const { createdAt, Status, description, imageList = {}, repairplan, proposal } = orderData;

    return (
        <InspectorLayout
            // make this page inherit the inspector layout and highlight the "Đã giám định" tab
            selectedKey="inspected"
            onSelect={(key) => {
                if (key === 'orders') navigate('/inspector');
                else if (key === 'proposal') navigate('/inspector?tab=proposal');
                else if (key === 'inspected') navigate('/inspector?tab=inspected');
            }}
            userName={userName}
            loadingUser={loadingUser}
        >
            <div className="flex justify-between items-center mb-6">
                <Title level={4} className="m-0">Chi tiết đơn sửa chữa</Title>
                <Button onClick={() => navigate(-1)}>Quay lại</Button>
            </div>

            <Descriptions title="Thông tin đơn" bordered column={1}>
                <Descriptions.Item label="Mã đơn">{id}</Descriptions.Item>
                <Descriptions.Item label="Ngày tạo">{createdAt}</Descriptions.Item>
                <Descriptions.Item label="Trạng thái">{Status}</Descriptions.Item>
                <Descriptions.Item label="Tàu">{shipName}</Descriptions.Item>
                <Descriptions.Item label="Cán bộ giám định">{orderData.assignedInspector || employeeName || 'Chưa được gán'}</Descriptions.Item>
                <Descriptions.Item label="Xưởng">{workshopName}</Descriptions.Item>
                {orderData.description && <Descriptions.Item label="Mô tả">{orderData.description}</Descriptions.Item>}

                {/* Ship detailed info (if available) */}
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

            {(repairplan || proposal) && (
                <div className="mt-8 max-w-xl">
                    <Title level={4}>Phương án đã đề xuất</Title>
                    <div className="bg-gray-50 p-4 rounded border border-gray-200 whitespace-pre-line">{repairplan || proposal}</div>
                </div>
            )}

            <div className="mt-6">
                <Title level={4}>Hình ảnh</Title>
                <div className="flex gap-4 flex-wrap">
                    {Object.values(imageList as { [key: string]: string }).map((url, index) => (
                        <Image key={index} width={200} src={url} alt={`img-${index}`} />
                    ))}
                </div>
            </div>
        </InspectorLayout>
    );
};

export default OrderDetailDone;
