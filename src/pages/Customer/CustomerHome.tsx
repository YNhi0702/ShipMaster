import React, { useEffect, useState } from 'react';
import { Layout, Button, Table, Typography, message, Card, Space, Tag, Input, Select, Row, Col } from 'antd';
import { useNavigate } from 'react-router-dom';
import { SearchOutlined, FilterOutlined } from '@ant-design/icons';
import { authService } from '../../services/authService';
import { orderService } from '../../services/orderService';
import CustomerLayout from '../../components/Customer/CustomerLayout';

const { Header, Content } = Layout;
const { Title } = Typography;

const CustomerHome: React.FC = () => {
    const navigate = useNavigate();
    const [userName, setUserName] = useState(''); // Họ tên của Khách hàng hiện tại
    const [orders, setOrders] = useState<any[]>([]); // Danh sách các đơn sửa chữa của Khách hàng
    const [loadingUser, setLoadingUser] = useState(true); // Trạng thái tải thông tin người dùng
    const [loadingOrders, setLoadingOrders] = useState(true); // Trạng thái tải danh sách đơn hàng
    const [searchText, setSearchText] = useState(''); // Từ khóa tìm kiếm tàu, xưởng, mô tả hoặc mã đơn
    const [statusFilter, setStatusFilter] = useState(''); // Trạng thái lọc

    useEffect(() => {
        const fetchData = async () => {
            const uid = sessionStorage.getItem('uid'); // Lấy UID của khách hàng từ session storage
            if (!uid) {
                navigate('/login'); // Nếu chưa đăng nhập thì chuyển hướng ngay sang trang Login
                return;
            }

            try {
                // 1. Tải thông tin tài khoản Khách hàng
                const profile = await authService.getCustomerProfile(uid);
                if (profile) {
                    setUserName(profile.fullName);
                }

                // 2. Tải toàn bộ danh sách đơn hàng mà khách này đã gửi lên hệ thống
                const ordersData = await orderService.getCustomerOrders(uid);
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

    /**
     * Chuẩn hóa trạng thái đơn hàng (loại bỏ dấu tiếng Việt, chữ viết thường) phục vụ logic check
     */
    const normalizeStatus = (status: any) => {
        if (!status) return '';
        return String(status)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    };

    /**
     * Hàm xóa dấu tiếng Việt phục vụ logic tìm kiếm không phân biệt dấu/lệch dấu Unicode
     */
    const removeVietnameseTones = (str: string) => {
        if (!str) return '';
        return str
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'd')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    };

    // Hàm định dạng số hiển thị sang Việt Nam Đồng
    const formatCurrency = (value: any) => {
        const numeric = typeof value === 'number' ? value : Number(value);
        if (Number.isFinite(numeric)) {
            return numeric.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
        }
        return '---';
    };

    /**
     * Hàm xử lý định dạng ngày giờ an toàn trên bảng chính
     */
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

    // Cấu hình các cột của Table đơn sửa chữa phía Khách hàng
    const columns = [
        {
            title: 'Tàu',
            dataIndex: 'shipName', // Tên tàu sửa chữa
            key: 'shipName',
        },
        {
            title: 'Xưởng',
            dataIndex: 'workshopName', // Xưởng tiếp nhận sửa chữa
            key: 'workshopName',
        },
        {
            title: 'Ngày tạo',
            dataIndex: 'createdAt', // Ngày gửi yêu cầu sửa chữa
            key: 'createdAt',
        },
        {
            title: 'Trạng thái',
            dataIndex: 'Status',
            key: 'Status',
            render: (_: string, record: any) => {
                const status = record.Status || '';
                let color = 'text-blue-600';
                
                // Tô màu sắc thái trực quan theo từng tiến trình trạng thái
                if (status === 'Hoàn thành sửa chữa' || status === 'Đã hoàn thành thanh toán') {
                    color = 'text-green-600 font-semibold';
                } else if (status === 'Đang giám định' || status === 'Đã lên lịch') {
                    color = 'text-yellow-600 font-semibold';
                }
                return <span className={color}>{status}</span>;
            },
        },
        {
            title: 'Hành động',
            key: 'action',
            render: (_: any, record: any) => {
                return (
                    <Button
                        type="link"
                        className="!p-0 !text-blue-600 hover:underline"
                        onClick={() => navigate(`/orders/${record.id}`, { state: record })} // Di chuyển đến trang xem chi tiết
                    >
                        Xem chi tiết
                    </Button>
                );
            },
        },
    ];

    // Lọc đơn hàng dựa trên từ khóa tìm kiếm và bộ lọc trạng thái
    const filteredOrders = orders.filter((order: any) => {
        const shipName = removeVietnameseTones(order.shipName || '');
        const workshopName = removeVietnameseTones(order.workshopName || '');
        const search = removeVietnameseTones(searchText);

        const matchesSearch =
            shipName.includes(search) ||
            workshopName.includes(search);

        const matchesStatus = !statusFilter || order.Status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    return (
        <CustomerLayout userName={userName} loadingUser={loadingUser}>
            <div className="m-0 p-0">
                {/* Nút hành động Tạo đơn sửa chữa */}
                <Button
                    type="primary"
                    size="large"
                    className="mb-5 bg-blue-600 hover:bg-blue-700 border-none"
                    onClick={() => navigate('/createRepairOrder')}
                >
                    Tạo đơn sửa chữa mới
                </Button>

                {/* Thanh tìm kiếm và Bộ lọc nâng cao */}
                <Card className="mb-6 shadow-sm border border-gray-100">
                    <Row gutter={[16, 16]} align="middle">
                        <Col xs={24} md={16} lg={18}>
                            <Input
                                placeholder="Tìm kiếm theo tên tàu hoặc xưởng..."
                                prefix={<SearchOutlined className="text-gray-400" />}
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                allowClear
                                size="large"
                                className="w-full rounded-md"
                            />
                        </Col>
                        <Col xs={24} md={8} lg={6}>
                            <Select
                                placeholder="Lọc theo trạng thái"
                                value={statusFilter || undefined}
                                onChange={(value) => setStatusFilter(value || '')}
                                allowClear
                                size="large"
                                className="w-full"
                                suffixIcon={<FilterOutlined className="text-gray-400" />}
                                options={[
                                    { value: 'Chờ giám định', label: 'Chờ giám định' },
                                    { value: 'Đang giám định', label: 'Đang giám định' },
                                    { value: 'Đã đề xuất phương án', label: 'Đã đề xuất phương án' },
                                    { value: 'Yêu cầu đề xuất lại', label: 'Yêu cầu đề xuất lại' },
                                    { value: 'Sắp xếp lịch sửa chữa', label: 'Sắp xếp lịch sửa chữa' },
                                    { value: 'Đã lên lịch', label: 'Đã lên lịch' },
                                    { value: 'Đã tạo hóa đơn', label: 'Đã tạo hóa đơn' },
                                    { value: 'Thanh toán một phần', label: 'Thanh toán một phần' },
                                    { value: 'Đã hoàn thành thanh toán', label: 'Đã hoàn thành thanh toán' },
                                    { value: 'Hoàn thành sửa chữa', label: 'Hoàn thành sửa chữa' },
                                ]}
                            />
                        </Col>
                    </Row>
                </Card>

                <Title level={4} className="mb-4">
                    Danh sách đơn sửa chữa
                </Title>
                
                {/* Bảng hiển thị danh sách đơn sửa chữa */}
                <Table
                    columns={columns}
                    dataSource={filteredOrders}
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
