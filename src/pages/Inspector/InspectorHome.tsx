import React, { useEffect, useState } from 'react';
import { Layout, Button, Table, Typography, Avatar, Spin, message, Dropdown, Tag } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import InspectorSidebar from '../../components/Inspector/InspectorSidebar';
import InspectorLayout from '../../components/Inspector/InspectorLayout';
import { useLocation } from 'react-router-dom';

const { Header, Content } = Layout;
const { Title } = Typography;

const InspectorHome: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [userName, setUserName] = useState(''); // Lưu họ tên của Giám định viên hiện tại
    const [orders, setOrders] = useState<any[]>([]); // Đơn hàng ở tab "Chờ tiếp nhận"
    const [proposalOrders, setProposalOrders] = useState<any[]>([]); // Đơn hàng ở tab "Chờ đề xuất" (đang giám định, đề xuất lại...)
    const [inspectedOrders, setInspectedOrders] = useState<any[]>([]); // Đơn hàng ở tab "Đã giám định" (lịch trình tiếp theo)
    const [loadingUser, setLoadingUser] = useState(true); // Trạng thái tải tên người dùng
    const [loadingOrders, setLoadingOrders] = useState(true); // Trạng thái tải danh sách đơn hàng
    const [selectedKey, setSelectedKey] = useState<'orders' | 'proposal' | 'inspected'>('orders'); // Quản lý Tab đang mở
    const [refreshing, setRefreshing] = useState(false); // Trạng thái loading quay vòng khi làm mới danh sách

    // Hàm phụ trợ chuẩn hóa chuỗi viết thường không dấu
    const normalize = (s: string) => {
        if (!s) return '';
        return String(s).toLowerCase().trim();
    };

    /**
     * Tải dữ liệu các đơn sửa chữa từ Firestore và phân chia về 3 Tab tương ứng
     */
    const fetchOrdersData = async () => {
        const uid = sessionStorage.getItem('uid'); // Lấy ID giám định viên
        if (!uid) return;

        try {
            setRefreshing(true);
            const ordersRef = collection(db, 'repairOrder');

            // 1. Tải toàn bộ đơn sửa chữa từ Firestore
            const allOrdersSnapshot = await getDocs(ordersRef);

            // 2. Lọc đơn "Chờ tiếp nhận": trạng thái là "Chờ giám định"
            const waitingOrders = allOrdersSnapshot.docs.filter(doc => {
                const status = doc.data().Status;
                return status && status.trim() === 'Chờ giám định';
            });

            // Tiến hành map nạp thông tin tên Tàu & tên Xưởng tương ứng cho đơn chờ nhận
            const ordersData = await Promise.all(waitingOrders.map(async (docSnap) => {
                const order = docSnap.data();
                const createdAt = order.StartDate?.toDate ? order.StartDate.toDate().toLocaleDateString('vi-VN') : '';

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

            // 3. Lọc đơn "Chờ đề xuất": Trạng thái thuộc ['Đang giám định', 'Yêu cầu đề xuất lại', 'Đã đề xuất phương án']
            // Và đơn này đã được phân bổ cho Giám định viên này phụ trách (inspectorId === uid)
            const targetStatuses = ['Đang giám định', 'Yêu cầu đề xuất lại', 'Đã đề xuất phương án'];
            const proposalOrders = allOrdersSnapshot.docs.filter(doc => {
                const order = doc.data();
                const status = order.Status;
                return status && targetStatuses.includes(status.trim()) && order.inspectorId === uid;
            });

            const proposalData = await Promise.all(proposalOrders.map(async (docSnap) => {
                const order = docSnap.data();
                const createdAt = order.StartDate?.toDate ? order.StartDate.toDate().toLocaleDateString('vi-VN') : '';

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

            // 4. Lọc đơn "Đã giám định": Đã gán cho GĐV này phụ trách VÀ trạng thái KHÔNG NẰM trong danh sách chờ ('Chờ giám định', 'Đang giám định'...)
            const excludedList = ['Chờ giám định', 'Đang giám định', 'Yêu cầu đề xuất lại', 'Đã đề xuất phương án'].map(normalize);
            const inspectedDocs = allOrdersSnapshot.docs.filter(docSnap => {
                const order = docSnap.data();
                const status = normalize(order?.Status || '');
                return order?.inspectorId === uid && status && !excludedList.includes(status);
            });

            const inspectedData = await Promise.all(inspectedDocs.map(async (docSnap) => {
                const order = docSnap.data();
                const createdAt = order.StartDate?.toDate ? order.StartDate.toDate().toLocaleDateString('vi-VN') : '';
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
            setInspectedOrders(inspectedData);
        } catch (error) {
            message.error('Lỗi khi tải dữ liệu!');
        } finally {
            setRefreshing(false);
        }
    };

    // Điều hướng chọn Tab bằng Query Parameter (?tab=...)
    useEffect(() => {
        const urlParams = new URLSearchParams(location.search);
        const tab = urlParams.get('tab');
        if (tab === 'proposal') setSelectedKey('proposal');
        else if (tab === 'inspected') setSelectedKey('inspected');
        else setSelectedKey('orders');
    }, [location.search]);

    // Lần đầu nạp trang: Lấy thông tin họ tên của Giám định viên
    useEffect(() => {
        const fetchData = async () => {
            const uid = sessionStorage.getItem('uid');
            if (!uid) {
                navigate('/login');
                return;
            }

            try {
                const usersRef = collection(db, 'users');
                const userQuery = query(usersRef, where('__name__', '==', uid));
                const userSnapshot = await getDocs(userQuery);

                if (!userSnapshot.empty) {
                    const u = userSnapshot.docs[0].data();
                    setUserName(u.fullName || u.username || 'Không có tên');
                }

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

    // Cột của bảng Tab 1: Tiếp nhận đơn hàng mới
    const columnsAccept = [
        {
            title: 'STT',
            key: 'stt',
            width: 60,
            render: (_: any, __: any, index: number) => index + 1,
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
            render: (v: string) => <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{v}</div>
        },
        {
            title: 'Xưởng',
            dataIndex: 'workshopName',
            key: 'workshopName',
            render: (v: string) => <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{v}</div>
        },
        {
            title: 'Mô tả',
            dataIndex: 'description',
            key: 'description',
            render: (desc: string) => <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{desc}</div>,
        },
        {
            title: 'Hành động',
            key: 'action',
            render: (_: any, record: any) => (
                <Button
                    type="default"
                    className="!p-0 !text-blue-600 !border-blue-600 !bg-white hover:!bg-blue-50"
                    onClick={() => navigate(`/inspector/orders/${record.id}`)} // Chuyển trang tiếp nhận chi tiết
                >
                    Tiếp nhận đơn
                </Button>
            ),
        },
    ];

    // Cột của bảng Tab 2: Lập phương án đề xuất kỹ thuật/vật liệu/ngày công
    const columnsProposal = [
        {
            title: 'STT',
            key: 'stt',
            width: 60,
            render: (_: any, __: any, index: number) => index + 1,
        },
        {
            title: 'Trạng thái',
            dataIndex: 'Status',
            key: 'Status',
            render: (status: string) => {
                const st = status?.toString().trim() || '';
                let color = 'default';
                if (st === 'Đang giám định') color = 'orange';
                else if (st === 'Yêu cầu đề xuất lại') color = 'red';
                else if (st === 'Đã đề xuất phương án') color = 'green';
                return <Tag color={color}>{st}</Tag>; // Hiển thị nhãn màu sắc
            }
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
            render: (v: string) => <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{v}</div>
        },
        {
            title: 'Xưởng',
            dataIndex: 'workshopName',
            key: 'workshopName',
            render: (v: string) => <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{v}</div>
        },
        {
            title: 'Mô tả',
            dataIndex: 'description',
            key: 'description',
            render: (desc: string) => <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{desc}</div>,
        },
        {
            title: 'Hành động',
            key: 'action',
            render: (_: any, record: any) => {
                const st = (record.Status || '').toString().trim();
                let label = 'Đề xuất';
                if (st === 'Đã đề xuất phương án') label = 'Xem';
                else if (st === 'Yêu cầu đề xuất lại') label = 'Đề xuất lại';
                return (
                    <Button
                        type="default"
                        className="!p-0 !text-blue-600 !border-blue-600 !bg-white hover:!bg-blue-50"
                        onClick={() => navigate(`/inspector/proposal/${record.id}`)} // Chuyển trang viết phương án
                    >
                        {label}
                    </Button>
                );
            },
        },
    ];

    // Cột của bảng Tab 3: Xem lại thông tin các đơn đã hoàn tất giám định
    const columnsInspected = [
        ...columnsProposal.filter((c: any) => c.key !== 'action'),
        {
            title: 'Hành động',
            key: 'action',
            render: (_: any, record: any) => (
                <Button
                    type="default"
                    className="!p-0 !text-blue-600 !border-blue-600 !bg-white hover:!bg-blue-50"
                    onClick={() => navigate(`/inspector/done/${record.id}`)} // Chuyển trang xem chi tiết kết quả đã duyệt
                >
                    Xem
                </Button>
            ),
        },
    ];

    return (
        <InspectorLayout
            selectedKey={selectedKey}
            onSelect={(key) => {
                setSelectedKey(key as 'orders' | 'proposal' | 'inspected');
                if (key === 'proposal') navigate('/inspector?tab=proposal', { replace: true });
                else if (key === 'inspected') navigate('/inspector?tab=inspected', { replace: true });
                else navigate('/inspector', { replace: true });
            }}
            userName={userName}
            loadingUser={loadingUser}
        >
            <div className="m-0 p-0">
                {/* RENDERING THE 3 DIFFERENT VIEWS ACCORDING TO THE ACTIVE TAB KEY */}
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
                            />
                        </div>
                    </>
                )}

                {selectedKey === 'inspected' && (
                    <>
                        <Title level={4}>Danh sách đơn đã giám định</Title>
                        <div className="w-full overflow-x-auto">
                            <Table
                                columns={columnsInspected}
                                dataSource={inspectedOrders}
                                rowKey="id"
                                loading={loadingOrders || refreshing}
                                bordered
                                className="shadow-sm"
                            />
                        </div>
                    </>
                )}
            </div>
        </InspectorLayout>
    );
};

export default InspectorHome;
