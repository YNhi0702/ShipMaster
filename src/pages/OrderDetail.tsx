import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Layout, Typography, Descriptions, Image, Button, Spin, message, Avatar, Dropdown } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { collection, query, where, getDocs, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import CustomerLayout from '../components/CustomerLayout';

const { Header, Content } = Layout;
const { Title } = Typography;

const OrderDetail: React.FC = () => {
    const { state } = useLocation();
    const { id } = useParams();
    const navigate = useNavigate();

    const [orderData, setOrderData] = useState<any>(state || null);
    const [loading, setLoading] = useState(!state);
    const [shipName, setShipName] = useState('');
    const [workshopName, setWorkshopName] = useState('');
    const [employeeName, setEmployeeName] = useState('');
    const [userName, setUserName] = useState('');
    const [loadingUser, setLoadingUser] = useState(true);
    const [canceling, setCanceling] = useState(false);
    const [accepting, setAccepting] = useState(false);

    useEffect(() => {
        const fetchOrder = async () => {
            const uid = sessionStorage.getItem('uid');
            if (!uid) {
                navigate('/login');
                return;
            }

            try {
                // Lấy tên khách hàng cho header
                const customersRef = collection(db, 'customers');
                const customerQuery = query(customersRef, where('uid', '==', uid));
                const customerSnapshot = await getDocs(customerQuery);
                if (!customerSnapshot.empty) {
                    setUserName(customerSnapshot.docs[0].data().fullName || 'Khách hàng');
                }
            } catch {
                // ignore
            } finally {
                setLoadingUser(false);
            }

            if (!state && id) {
                try {
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
                        navigate('/');
                    }
                } catch {
                    message.error('Lỗi tải đơn hàng.');
                } finally {
                    setLoading(false);
                }
            }
        };

        fetchOrder();
    }, [state, id, navigate]);

    useEffect(() => {
        const fetchNames = async () => {
            if (!orderData) return;

            try {
                if (orderData.shipId) {
                    const shipSnap = await getDoc(doc(db, 'ship', orderData.shipId));
                    setShipName(shipSnap.exists() ? shipSnap.data().name : 'Không xác định');
                } else setShipName('Không xác định');
            } catch {
                setShipName('Không xác định');
            }

            try {
                if (orderData.workshopId) {
                    const workshopSnap = await getDoc(doc(db, 'workShop', orderData.workshopId));
                    setWorkshopName(workshopSnap.exists() ? workshopSnap.data().name : 'Không xác định');
                } else setWorkshopName('Không xác định');
            } catch {
                setWorkshopName('Không xác định');
            }

            try {
                if (orderData.inspectorId) {
                    const employeeSnap = await getDoc(doc(db, 'employees', orderData.inspectorId));
                    setEmployeeName(employeeSnap.exists() ? employeeSnap.data().fullName : orderData.inspectorId);
                } else {
                    setEmployeeName('');
                }
            } catch {
                setEmployeeName(orderData.inspectorId || '');
            }
        };

        fetchNames();
    }, [orderData]);

    if (loading || !orderData) {
        return <div className="p-6"><Spin /> Đang tải dữ liệu...</div>;
    }

    const { createdAt, Status, description, imageList = {}, repairplan } = orderData;

    // 👉 Menu dropdown đăng xuất
    const menuItems = [
        { key: 'logout', label: 'Đăng xuất' },
    ];

    const handleMenuClick = ({ key }: { key: string }) => {
        if (key === 'logout') {
            sessionStorage.clear();
            navigate('/login');
        }
    };

    const handleAcceptRepair = async () => {
        if (!id) return;
        setAccepting(true);
        try {
            await updateDoc(doc(db, 'repairOrder', id), {
                Status: 'Đã đồng ý sửa chữa',
            });
            message.success('Đã đồng ý phương án sửa chữa!');
            // Refresh the page to update the status
            window.location.reload();
        } catch (error) {
            message.error('Lỗi khi đồng ý sửa chữa.');
        } finally {
            setAccepting(false);
        }
    };

    return (
        <CustomerLayout userName={userName} loadingUser={loadingUser}>
                <div className="flex justify-between items-center mb-4">
                    <Title level={4} className="m-0">Chi tiết đơn sửa chữa</Title>
                    <Button onClick={() => navigate(-1)}>Quay lại</Button>
                </div>

                <Descriptions title="Thông tin đơn" bordered column={1}>
                    <Descriptions.Item label="Mã đơn">{id}</Descriptions.Item>
                    <Descriptions.Item label="Ngày tạo">{createdAt}</Descriptions.Item>
                    <Descriptions.Item label="Trạng thái">{Status}</Descriptions.Item>
                    <Descriptions.Item label="Tàu">{shipName}</Descriptions.Item>
                    <Descriptions.Item label="Cán bộ giám định">{employeeName || 'Chưa được gán'}</Descriptions.Item>
                    <Descriptions.Item label="Xưởng">{workshopName}</Descriptions.Item>
                    {description && <Descriptions.Item label="Mô tả">{description}</Descriptions.Item>}
                </Descriptions>

                {repairplan && (
                    <div className="mt-6">
                        <Title level={4}>Phương án sửa chữa</Title>
                        <div className="bg-gray-50 p-4 rounded border border-gray-200 whitespace-pre-line">
                            {repairplan}
                        </div>
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

                <div className="mt-6 flex justify-end">
                        <Button
                            danger
                            loading={canceling}
                            onClick={async () => {
                                if (!id) return;
                                const ok = window.confirm('Bạn có chắc chắn muốn huỷ đơn sửa chữa này?');
                                if (!ok) return;
                                setCanceling(true);
                                try {
                                    await deleteDoc(doc(db, 'repairOrder', id));
                                    message.success('Đã xóa đơn sửa chữa.');
                                    navigate('/');
                                } catch {
                                    message.error('Không thể xóa đơn.');
                                } finally {
                                    setCanceling(false);
                                }
                            }}
                        >
                            Hủy đơn
                        </Button>
                </div>
        </CustomerLayout>
    );
};

export default OrderDetail;
