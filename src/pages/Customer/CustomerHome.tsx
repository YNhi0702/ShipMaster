import React, { useEffect, useState } from 'react';
import { Layout, Button, Table, Typography, message, Card, Space, Tag } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import CustomerLayout from '../../components/Customer/CustomerLayout';

const { Header, Content } = Layout;
const { Title } = Typography;

const CustomerHome: React.FC = () => {
    const navigate = useNavigate();
    const [userName, setUserName] = useState('');
    const [myReferralCode, setMyReferralCode] = useState('');
    const [orders, setOrders] = useState<any[]>([]);
    const [loadingUser, setLoadingUser] = useState(true);
    const [loadingOrders, setLoadingOrders] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const uid = sessionStorage.getItem('uid');
            if (!uid) {
                navigate('/login');
                return;
            }

            try {
                // Lấy thông tin khách hàng
                const customersRef = collection(db, 'customers');
                const customerQuery = query(customersRef, where('uid', '==', uid));
                const customerSnapshot = await getDocs(customerQuery);
                if (!customerSnapshot.empty) {
                    const customerData = customerSnapshot.docs[0].data();
                    setUserName(customerData.fullName || 'Khách hàng');
                    setMyReferralCode(customerData.myreferralCode || '');
                }

                // Lấy danh sách đơn sửa chữa
                const ordersRef = collection(db, 'repairOrder');
                const ordersQuery = query(ordersRef, where('uid', '==', uid));
                const ordersSnapshot = await getDocs(ordersQuery);

                const ordersData = await Promise.all(
                    ordersSnapshot.docs.map(async (docSnap) => {
                        const order = docSnap.data();
                        const createdAt = order.StartDate?.toDate().toLocaleDateString('vi-VN');
                        let shipName = 'Không xác định';
                        let workshopName = 'Không xác định';

                        try {
                            if (order.shipId) {
                                const shipSnap = await getDoc(doc(db, 'ship', order.shipId));
                                if (shipSnap.exists()) {
                                    shipName = shipSnap.data().name || shipName;
                                }
                            }
                        } catch (err) {
                            console.warn('Không thể lấy tên tàu:', order.shipId);
                        }

                        try {
                            if (order.workshopId) {
                                const workshopSnap = await getDoc(doc(db, 'workShop', order.workshopId));
                                if (workshopSnap.exists()) {
                                    workshopName = workshopSnap.data().name || workshopName;
                                }
                            }
                        } catch (err) {
                            console.warn('Không thể lấy tên xưởng:', order.workshopId);
                        }

                        const totalCost = Number(order.totalCost || order.TotalCost || order.totalPrice || order.TotalPrice || 0);
                        const rawStatus = order.Status || order.status || order.currentStatus || '';

                        return {
                            id: docSnap.id,
                            ...order,
                            createdAt,
                            shipName,
                            workshopName,
                            totalCost,
                            rawStatus,
                        };
                    })
                );

                setOrders(ordersData);
            } catch (error) {
                console.error('Lỗi khi tải dữ liệu:', error);
            } finally {
                setLoadingUser(false);
                setLoadingOrders(false);
            }
        };

        fetchData();
    }, [navigate]);

    const normalizeStatus = (status: any) => {
        if (!status) return '';
        return String(status)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    };

    const formatCurrency = (value: any) => {
        const numeric = typeof value === 'number' ? value : Number(value);
        if (Number.isFinite(numeric)) {
            return numeric.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
        }
        return '---';
    };

    const formatDateTime = (value: any) => {
        if (!value) return '';
        if (value instanceof Date) {
            return isNaN(value.getTime()) ? '' : value.toLocaleString('vi-VN');
        }
        if (value?.toDate && typeof value.toDate === 'function') {
            const d = value.toDate();
            return !d || isNaN(d.getTime()) ? '' : d.toLocaleString('vi-VN');
        }
        if (typeof value === 'string') {
            const parsed = new Date(value);
            return isNaN(parsed.getTime()) ? value : parsed.toLocaleString('vi-VN');
        }
        if (value?.seconds) {
            const d = new Date(value.seconds * 1000);
            return isNaN(d.getTime()) ? '' : d.toLocaleString('vi-VN');
        }
        return '';
    };

    const handleCopyReferralCode = async () => {
        if (!myReferralCode) {
            message.warning('Chưa có mã giới thiệu để sao chép.');
            return;
        }

        try {
            await navigator.clipboard.writeText(myReferralCode);
            message.success('Đã sao chép mã giới thiệu');
        } catch (error) {
            message.error('Không thể sao chép mã giới thiệu');
        }
    };


    const columns = [
        {
            title: 'Tàu',
            dataIndex: 'shipName',
            key: 'shipName',
        },
        {
            title: 'Xưởng',
            dataIndex: 'workshopName',
            key: 'workshopName',
        },
        
        {
            title: 'Ngày tạo',
            dataIndex: 'createdAt',
            key: 'createdAt',
        },
        {
            title: 'Trạng thái',
            dataIndex: 'Status',
            key: 'Status',
            render: (_: string, record: any) => {
                const status = record.Status || record.status || record.currentStatus || '';
                let color = 'text-blue-600';
                if (status === 'Hoàn thành') color = 'text-green-600 font-semibold';
                else if (status === 'Đang giám định') color = 'text-yellow-600 font-semibold';
                return <span className={color}>{status}</span>;
            },
        },
        {
            title: 'Hành động',
            key: 'action',
            render: (_: any, record: any) => {
                const statusOriginal = record.Status || record.status || record.currentStatus || '';
                return (
                    <Button
                        type="link"
                        className="!p-0 !text-blue-600 hover:underline"
                        onClick={() => navigate(`/orders/${record.id}`, { state: record })}
                    >
                        Xem chi tiết
                    </Button>
                );
            },
        },
    ];

    return (
        <CustomerLayout userName={userName} loadingUser={loadingUser}>
            <div className="m-0 p-0">
                <Card className="mb-5 shadow-sm border border-blue-100 bg-gradient-to-r from-blue-50 to-white">
                    <Space direction="vertical" size={8} className="w-full">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                                <div className="text-sm text-gray-500">Mã giới thiệu của bạn</div>
                                <div className="text-2xl font-semibold tracking-wider text-blue-700">
                                    {myReferralCode || 'Chưa có mã'}
                                </div>
                            </div>
                            <Button
                                type="primary"
                                icon={<CopyOutlined />}
                                onClick={handleCopyReferralCode}
                                disabled={!myReferralCode}
                            >
                                Sao chép
                            </Button>
                        </div>
                        <div className="text-sm text-gray-600">
                            Chia sẻ mã giới thiệu của bạn cho khách hàng mới. Khi khách hàng đó phát sinh đơn hàng đầu tiên,giảm 5% trên giá trị đơn hàng.
                        </div>
                    </Space>
                </Card>
                <Button
                    type="primary"
                    size="large"
                    className="mb-5 bg-blue-600 hover:bg-blue-700 border-none"
                    onClick={() => navigate('/createRepairOrder')}
                >
                    Tạo đơn sửa chữa mới
                </Button>
                <Title level={4}>Danh sách đơn sửa chữa</Title>
                <Table
                    columns={columns}
                    dataSource={orders}
                    rowKey="id"
                    loading={loadingOrders}
                    bordered
                    className="shadow-sm"
                />
            
            </div>
        </CustomerLayout>
    );
};

export default CustomerHome;
