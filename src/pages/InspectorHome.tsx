import React, { useEffect, useState } from 'react';
import { Layout, Button, Table, Typography, Avatar, Spin, message, Dropdown } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import InspectorSidebar from '../components/InspectorSidebar';
import InspectorLayout from '../components/InspectorLayout';
import { useLocation } from 'react-router-dom';

const { Header, Content } = Layout;
const { Title } = Typography;



const InspectorHome: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [userName, setUserName] = useState('');
    const [orders, setOrders] = useState<any[]>([]);
    const [proposalOrders, setProposalOrders] = useState<any[]>([]);
    const [loadingUser, setLoadingUser] = useState(true);
    const [loadingOrders, setLoadingOrders] = useState(true);
    const [selectedKey, setSelectedKey] = useState<'orders' | 'proposal'>('orders');
    const [refreshing, setRefreshing] = useState(false);

    const fetchOrdersData = async () => {
        const uid = sessionStorage.getItem('uid');
        if (!uid) return;

        try {
            setRefreshing(true);
            const ordersRef = collection(db, 'repairOrder');
            
            // Lấy tất cả đơn hàng để xử lý dấu cách thừa trong status
            const allOrdersSnapshot = await getDocs(ordersRef);
            
            // Đơn chờ tiếp nhận - filter để xử lý dấu cách thừa
            const waitingOrders = allOrdersSnapshot.docs.filter(doc => {
                const status = doc.data().Status;
                return status && status.trim() === 'Chờ giám định';
            });
            
            const ordersData = await Promise.all(waitingOrders.map(async (docSnap) => {
                const order = docSnap.data();
                const createdAt = order.StartDate?.toDate ? order.StartDate.toDate().toLocaleDateString('vi-VN') : '';
                
                // Lấy tên tàu và xưởng
                let shipName = 'Không xác định';
                let workshopName = 'Không xác định';
                
                try {
                    if (order.shipId) {
                        const shipDoc = await getDoc(doc(db, 'ship', order.shipId));
                        shipName = shipDoc.exists() ? shipDoc.data().name : 'Không xác định';
                    }
                    if (order.workshopId) {
                        const workshopDoc = await getDoc(doc(db, 'workShop', order.workshopId));
                        workshopName = workshopDoc.exists() ? workshopDoc.data().name : 'Không xác định';
                    }
                } catch (error) {
                    console.error('Error fetching ship/workshop names:', error);
                }
                
                return {
                    id: docSnap.id,
                    ...order,
                    createdAt,
                    shipName,
                    workshopName,
                    assignedInspector: order.assignedInspector || 'Chưa được gán',
                };
            }));
            setOrders(ordersData);

            // Đơn chờ đề xuất phương án - filter để xử lý dấu cách thừa
            const proposalOrders = allOrdersSnapshot.docs.filter(doc => {
                const order = doc.data();
                const status = order.Status;
                return status && status.trim() === 'Đang giám định' && order.inspectorId === uid;
            });
            
            const proposalData = await Promise.all(proposalOrders.map(async (docSnap) => {
                const order = docSnap.data();
                const createdAt = order.StartDate?.toDate ? order.StartDate.toDate().toLocaleDateString('vi-VN') : '';
                
                // Lấy tên tàu và xưởng
                let shipName = 'Không xác định';
                let workshopName = 'Không xác định';
                
                try {
                    if (order.shipId) {
                        const shipDoc = await getDoc(doc(db, 'ship', order.shipId));
                        shipName = shipDoc.exists() ? shipDoc.data().name : 'Không xác định';
                    }
                    if (order.workshopId) {
                        const workshopDoc = await getDoc(doc(db, 'workShop', order.workshopId));
                        workshopName = workshopDoc.exists() ? workshopDoc.data().name : 'Không xác định';
                    }
                } catch (error) {
                    console.error('Error fetching ship/workshop names:', error);
                }
                
                return {
                    id: docSnap.id,
                    ...order,
                    createdAt,
                    shipName,
                    workshopName,
                    assignedInspector: order.assignedInspector || 'Chưa được gán',
                };
            }));
            setProposalOrders(proposalData);
        } catch (error) {
            message.error('Lỗi khi tải dữ liệu!');
        } finally {
            setRefreshing(false);
        }
    };

    // Xử lý URL parameters để set tab đúng
    useEffect(() => {
        const urlParams = new URLSearchParams(location.search);
        const tab = urlParams.get('tab');
        if (tab === 'proposal') {
            setSelectedKey('proposal');
        } else {
            setSelectedKey('orders');
        }
    }, [location.search]);

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

                // Fetch orders data
                await fetchOrdersData();
            } catch (error) {
                message.error('Lỗi khi tải dữ liệu!');
            } finally {
                setLoadingUser(false);
                setLoadingOrders(false);
            }
        };
        fetchData();
    }, [navigate]);

    // Cột cho tab Tiếp nhận đơn
    const columnsAccept = [
        {
            title: 'STT',
            key: 'stt',
            width: 60,
            render: (_: any, __: any, index: number) => index + 1,
        },
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
            title: 'Xưởng',
            dataIndex: 'workshopName',
            key: 'workshopName',
        },
        {
            title: 'Cán bộ giám định',
            dataIndex: 'assignedInspector',
            key: 'assignedInspector',
            render: (inspector: string) => inspector || 'Chưa được gán',
        },
        {
            title: 'Mô tả',
            dataIndex: 'description',
            key: 'description',
            render: (desc: string) => <span title={desc}>{desc}</span>,
        },
        {
            title: 'Hành động',
            key: 'action',
            render: (_: any, record: any) => (
                <Button
                    type="default"
                    className="!p-0 !text-blue-600 !border-blue-600 !bg-white hover:!bg-blue-50"
                    onClick={() => navigate(`/inspector/orders/${record.id}`)}
                >
                    Tiếp nhận đơn
                </Button>
            ),
        },
    ];

    // Cột cho tab Đề xuất phương án
    const columnsProposal = [
        {
            title: 'STT',
            key: 'stt',
            width: 60,
            render: (_: any, __: any, index: number) => index + 1,
        },
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
            title: 'Xưởng',
            dataIndex: 'workshopName',
            key: 'workshopName',
        },
        {
            title: 'Cán bộ giám định',
            dataIndex: 'assignedInspector',
            key: 'assignedInspector',
            render: (inspector: string) => inspector || 'Chưa được gán',
        },
        {
            title: 'Mô tả',
            dataIndex: 'description',
            key: 'description',
            render: (desc: string) => <span title={desc}>{desc}</span>,
        },
        {
            title: 'Hành động',
            key: 'action',
            render: (_: any, record: any) => (
                <Button
                    type="default"
                    className="!p-0 !text-blue-600 !border-blue-600 !bg-white hover:!bg-blue-50"
                    onClick={() => navigate(`/inspector/proposal/${record.id}`)}
                >
                    Đề xuất
                </Button>
            ),
        },
    ];

    return (
        <InspectorLayout
            selectedKey={selectedKey}
            onSelect={(key) => {
                setSelectedKey(key as 'orders' | 'proposal');
                if (key === 'proposal') navigate('/inspector?tab=proposal', { replace: true });
                else navigate('/inspector', { replace: true });
            }}
            userName={userName}
            loadingUser={loadingUser}
        >
                <div className="m-0 p-0">
                    {selectedKey === 'orders' && (
                        <>
                            <Title level={4}>Danh sách đơn hàng chờ tiếp nhận</Title>
                            <div className="w-full overflow-x-auto">
                                <Table
                                    columns={columnsAccept}
                                    dataSource={orders}
                                    rowKey="id"
                                    loading={loadingOrders || refreshing}
                                    bordered
                                    className="shadow-sm"
                                    scroll={{ x: 'max-content' }}
                                />
                            </div>
                        </>
                    )}
                    {selectedKey === 'proposal' && (
                        <>
                            <Title level={4}>Danh sách đơn chờ đề xuất phương án</Title>
                            <div className="w-full overflow-x-auto">
                                <Table
                                    columns={columnsProposal}
                                    dataSource={proposalOrders}
                                    rowKey="id"
                                    loading={loadingOrders || refreshing}
                                    bordered
                                    className="shadow-sm"
                                    scroll={{ x: 'max-content' }}
                                />
                            </div>
                        </>
                    )}
                </div>
        </InspectorLayout>
    );
};

export default InspectorHome;
