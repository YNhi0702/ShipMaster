import React, { useEffect, useState } from 'react';
import { Layout, Button, Table, Typography, Avatar, Spin } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import CustomerLayout from '../components/CustomerLayout';

const { Header, Content } = Layout;
const { Title } = Typography;

const CustomerHome: React.FC = () => {
    const navigate = useNavigate();
    const [userName, setUserName] = useState('');
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
                    setUserName(customerSnapshot.docs[0].data().fullName || 'Khách hàng');
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

                        try {
                            const shipSnap = await getDoc(doc(db, 'ship', order.shipId));
                            if (shipSnap.exists()) {
                                shipName = shipSnap.data().name || shipName;
                            }
                        } catch (err) {
                            console.warn('Không thể lấy tên tàu:', order.shipId);
                        }

                        return {
                            id: docSnap.id,
                            ...order,
                            createdAt,
                            shipName,
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

    const columns = [
        {
            title: 'Mã đơn',
            dataIndex: 'id',
            key: 'id',
        },
        {
            title: 'Ngày tạo',
            dataIndex: 'createdAt',
            key: 'createdAt',
        },
        {
            title: 'Tàu',
            dataIndex: 'shipName',
            key: 'shipName',
        },
        {
            title: 'Trạng thái',
            dataIndex: 'Status',
            key: 'Status',
            render: (status: string) => {
                let color = 'text-blue-600';
                if (status === 'Hoàn thành') color = 'text-green-600 font-semibold';
                else if (status === 'Đang giám định') color = 'text-yellow-600 font-semibold';
                return <span className={color}>{status}</span>;
            },
        },
        {
            title: 'Hành động',
            key: 'action',
            render: (_: any, record: any) => (
                <Button
                    type="link"
                    className="!p-0 !text-blue-600 hover:underline"
                    onClick={() => navigate(`/orders/${record.id}`, { state: record })}
                >
                    Xem chi tiết
                </Button>
            ),
        },
    ];

    return (
        <CustomerLayout userName={userName} loadingUser={loadingUser}>
            <div className="m-0 p-0">
                <Button
                    type="primary"
                    size="large"
                    className="mb-5 bg-blue-600 hover:bg-blue-700 border-none"
                    onClick={() => navigate('/createRepairOder')}
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
