import React, { useEffect, useMemo, useState } from 'react';
import { Table, Typography, message, Input, Tag } from 'antd';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const { Title } = Typography;

interface PaymentRow {
    id: string;
    orderCode: string;
    shipName: string;
    totalAmount: number;
    paymentStatus: string;
    paymentMethod: string;
    invoiceCreatedAt: string;
}

const PaymentList: React.FC = () => {
    const [orders, setOrders] = useState<PaymentRow[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [searchValue, setSearchValue] = useState<string>('');

    const formatCurrency = (value: number) =>
        Number.isFinite(value) ? value.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' }) : '---';

    const fetchPaymentOrders = async () => {
        try {
            setLoading(true);
            const [orderSnapshot, invoiceSnapshot] = await Promise.all([
                getDocs(collection(db, 'repairOrder')),
                getDocs(collection(db, 'invoice')),
            ]);

            const invoiceMap = new Map<string, any>();
            invoiceSnapshot.docs.forEach((invoiceDoc) => {
                const invoiceData = invoiceDoc.data() as Record<string, any>;
                const repairOrderId =
                    invoiceData?.RepairOrder_ID ||
                    invoiceData?.repairOrderId ||
                    invoiceData?.repair_order_id ||
                    invoiceData?.repairOrderID;
                if (repairOrderId) {
                    invoiceMap.set(String(repairOrderId), { id: invoiceDoc.id, ...invoiceData });
                }
            });

            const rows = await Promise.all(
                orderSnapshot.docs.map(async (orderDoc) => {
                    const orderData = orderDoc.data() as Record<string, any>;
                    const rawStatus = orderData?.Status || orderData?.status || orderData?.currentStatus || '';
                    const normalizedStatus = typeof rawStatus === 'string' ? rawStatus.toLowerCase() : '';
                    if (!normalizedStatus.includes('đã tạo hóa đơn')) {
                        return null;
                    }

                    let shipName = orderData?.shipName || orderData?.ShipName || '';
                    if (!shipName) {
                        try {
                            const shipId = orderData?.shipId || orderData?.ShipId || orderData?.shipID;
                            if (shipId) {
                                const shipSnap = await getDoc(doc(db, 'ship', shipId));
                                if (shipSnap.exists()) {
                                    const shipData = shipSnap.data() as Record<string, any>;
                                    shipName = shipData?.name || shipData?.Name || shipData?.shipName || '';
                                }
                            }
                        } catch (error) {
                            // ship lookup is best effort
                        }
                    }

                    const invoiceData = invoiceMap.get(orderDoc.id) || null;
                    const totalAmount = Number(
                        invoiceData?.TotalAmount ??
                        invoiceData?.totalAmount ??
                        orderData?.totalCost ??
                        orderData?.TotalCost ??
                        0
                    ) || 0;

                    const createdSource = invoiceData?.CreatedDate;
                    const createdDate = createdSource?.toDate
                        ? createdSource.toDate()
                        : createdSource instanceof Date
                            ? createdSource
                            : createdSource?.seconds
                                ? new Date(createdSource.seconds * 1000)
                                : null;
                    const formattedCreated = createdDate && !isNaN(createdDate.getTime())
                        ? createdDate.toLocaleDateString('vi-VN')
                        : '';

                    return {
                        id: orderDoc.id,
                        orderCode: orderData?.OrderCode || orderData?.orderCode || orderData?.code || orderDoc.id,
                        shipName: shipName || '---',
                        totalAmount,
                        paymentStatus: invoiceData?.PaymentStatus || 'Chưa thanh toán',
                        paymentMethod: invoiceData?.PaymentMethod || '---',
                        invoiceCreatedAt: formattedCreated,
                    } as PaymentRow;
                })
            );

            setOrders(rows.filter(Boolean) as PaymentRow[]);
        } catch (error) {
            message.error('Lỗi khi tải dữ liệu thanh toán!');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPaymentOrders();
    }, []);

    const filteredOrders = useMemo(() => {
        if (!searchValue) return orders;
        const term = searchValue.toLowerCase();
        return orders.filter((order) =>
            [order.orderCode, order.shipName, order.paymentStatus]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(term)
        );
    }, [orders, searchValue]);

    const columns = [
        {
            title: 'STT',
            key: 'stt',
            width: 60,
            render: (_: PaymentRow, __: PaymentRow, index: number) => index + 1,
        },
        { title: 'Mã đơn', dataIndex: 'orderCode', key: 'orderCode' },
        { title: 'Tàu', dataIndex: 'shipName', key: 'shipName' },
        {
            title: 'Tổng tiền',
            dataIndex: 'totalAmount',
            key: 'totalAmount',
            render: (value: number) => formatCurrency(value),
        },
        {
            title: 'Trạng thái thanh toán',
            dataIndex: 'paymentStatus',
            key: 'paymentStatus',
            render: (status: string) => (
                <Tag color={status.toLowerCase().includes('đã') ? 'green' : 'gold'}>{status}</Tag>
            ),
        },
        { title: 'Phương thức', dataIndex: 'paymentMethod', key: 'paymentMethod' },
        { title: 'Ngày tạo hóa đơn', dataIndex: 'invoiceCreatedAt', key: 'invoiceCreatedAt' },
    ];

    return (
        <div className="w-full overflow-x-auto">
            <div className="flex items-center justify-between mb-4">
                <Title level={5} className="m-0">Đơn chờ thanh toán</Title>
                <Input.Search
                    placeholder="Tìm theo mã đơn, tàu, trạng thái"
                    allowClear
                    onSearch={(v) => setSearchValue(v)}
                    onChange={(e) => setSearchValue(e.target.value)}
                    style={{ width: 360 }}
                    value={searchValue}
                />
            </div>
            <Table
                columns={columns}
                dataSource={filteredOrders}
                rowKey="id"
                loading={loading}
                bordered
                className="shadow-sm"
                scroll={{ x: 'max-content' }}
            />
        </div>
    );
};

export default PaymentList;
