import React, { useEffect, useState } from 'react';
import { Layout, Button, Table, Typography, Avatar, Spin, Modal, message } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import CustomerLayout from '../../components/Customer/CustomerLayout';

const { Header, Content } = Layout;
const { Title } = Typography;

const CustomerHome: React.FC = () => {
    const navigate = useNavigate();
    const [userName, setUserName] = useState('');
    const [orders, setOrders] = useState<any[]>([]);
    const [loadingUser, setLoadingUser] = useState(true);
    const [loadingOrders, setLoadingOrders] = useState(true);
    const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
    const [invoiceModalLoading, setInvoiceModalLoading] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

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

                        return {
                            id: docSnap.id,
                            ...order,
                            createdAt,
                            shipName,
                            workshopName,
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

    const isInvoiceStatus = (status: any) => {
        const normalized = normalizeStatus(status);
        if (!normalized) return false;
        return normalized === 'da tao hoa don' || normalized.includes('da tao hoa don');
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

    const handleViewInvoice = async (record: any) => {
        try {
            setInvoiceModalLoading(true);
            const invoiceQuery = query(collection(db, 'invoice'), where('RepairOrder_ID', '==', record.id));
            const invoiceSnap = await getDocs(invoiceQuery);
            if (invoiceSnap.empty) {
                message.warning('Không tìm thấy hóa đơn cho đơn này.');
                setInvoiceModalVisible(false);
                setSelectedInvoice(null);
                return;
            }

            const invoiceDoc = invoiceSnap.docs[0];
            const invoice = {
                id: invoiceDoc.id,
                ...invoiceDoc.data(),
                shipName: record.shipName,
                workshopName: record.workshopName || record.workShopName || record.workshop || '',
                orderCode: record.OrderCode || record.orderCode || record.code || record.id,
            };
            setSelectedInvoice(invoice);
            setInvoiceModalVisible(true);
        } catch (error) {
            console.error('Failed to load invoice for customer modal', error);
            message.error('Không thể tải hóa đơn.');
        } finally {
            setInvoiceModalLoading(false);
        }
    };

    const columns = [
        {
            title: 'Tàu',
            dataIndex: 'shipName',
            key: 'shipName',
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
            render: (_: any, record: any) => {
                const statusOriginal = record.Status || record.status || record.currentStatus || '';
                if (isInvoiceStatus(statusOriginal)) {
                    return (
                        <Button
                            type="link"
                            className="!p-0 !text-blue-600 hover:underline"
                            onClick={() => handleViewInvoice(record)}
                        >
                            Xem hóa đơn
                        </Button>
                    );
                }

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
                <Modal
                    open={invoiceModalVisible}
                    onCancel={() => {
                        setInvoiceModalVisible(false);
                        setSelectedInvoice(null);
                    }}
                    footer={null}
                    title="Hóa đơn sửa chữa"
                    width={720}
                    destroyOnClose
                >
                    {invoiceModalLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Spin tip="Đang tải hóa đơn..." />
                        </div>
                    ) : selectedInvoice ? (
                        <div className="space-y-4">
                            <div className="grid gap-2 text-sm">
                                <div className="flex justify-between"><span>Mã hóa đơn:</span><span>{selectedInvoice.Invoice_ID || selectedInvoice.id || '---'}</span></div>
                                <div className="flex justify-between"><span>Tàu:</span><span>{selectedInvoice.shipName || '---'}</span></div>
                                <div className="flex justify-between"><span>Xưởng:</span><span>{selectedInvoice.workshopName || '---'}</span></div>
                                <div className="flex justify-between"><span>Ngày tạo:</span><span>{formatDateTime(selectedInvoice.CreatedDate) || '---'}</span></div>
                                <div className="flex justify-between"><span>Phương thức thanh toán:</span><span>{selectedInvoice.PaymentMethod || '---'}</span></div>
                                <div className="flex justify-between"><span>Trạng thái thanh toán:</span><span>{selectedInvoice.PaymentStatus || 'Chưa thanh toán'}</span></div>
                            </div>

                            {Array.isArray(selectedInvoice.MaterialLines) && selectedInvoice.MaterialLines.length > 0 && (
                                <div>
                                    <Title level={5} className="mb-2">Vật liệu</Title>
                                    <table className="w-full text-sm border border-gray-200">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="p-2 text-left">STT</th>
                                                <th className="p-2 text-left">Tên vật liệu</th>
                                                <th className="p-2 text-right">Số lượng</th>
                                                <th className="p-2 text-right">Đơn giá</th>
                                                <th className="p-2 text-right">Thành tiền</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedInvoice.MaterialLines.map((line: any, index: number) => (
                                                <tr key={line.id || index} className="border-t border-gray-200">
                                                    <td className="p-2">{index + 1}</td>
                                                    <td className="p-2">{line.name || line.materialId || '---'}</td>
                                                    <td className="p-2 text-right">{line.quantity ?? 0}</td>
                                                    <td className="p-2 text-right">{formatCurrency(line.unitPrice)}</td>
                                                    <td className="p-2 text-right">{formatCurrency(line.cost)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {Array.isArray(selectedInvoice.LaborLines) && selectedInvoice.LaborLines.length > 0 && (
                                <div>
                                    <Title level={5} className="mb-2">Nhân công</Title>
                                    <table className="w-full text-sm border border-gray-200">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="p-2 text-left">STT</th>
                                                <th className="p-2 text-left">Nhân viên</th>
                                                <th className="p-2 text-left">Công việc</th>
                                                <th className="p-2 text-right">Số ngày</th>
                                                <th className="p-2 text-right">Đơn giá</th>
                                                <th className="p-2 text-right">Thành tiền</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedInvoice.LaborLines.map((line: any, index: number) => (
                                                <tr key={line.id || index} className="border-t border-gray-200">
                                                    <td className="p-2">{index + 1}</td>
                                                    <td className="p-2">{line.employeeName || line.employeeId || '---'}</td>
                                                    <td className="p-2">{line.jobName || '---'}</td>
                                                    <td className="p-2 text-right">{line.days ?? 0}</td>
                                                    <td className="p-2 text-right">{formatCurrency(line.unitRate)}</td>
                                                    <td className="p-2 text-right">{formatCurrency(line.cost)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className="text-right font-semibold">
                                Tổng cộng: {formatCurrency(selectedInvoice.TotalAmount || ((selectedInvoice.MaterialLines || []).reduce((sum: number, line: any) => sum + (Number(line.cost) || 0), 0) + (selectedInvoice.LaborLines || []).reduce((sum: number, line: any) => sum + (Number(line.cost) || 0), 0)))}
                            </div>
                        </div>
                    ) : (
                        <div>Không có dữ liệu hóa đơn.</div>
                    )}
                </Modal>
            </div>
        </CustomerLayout>
    );
};

export default CustomerHome;
