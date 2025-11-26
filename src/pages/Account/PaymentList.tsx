import React, { useEffect, useMemo, useState } from 'react';
import { Table, Typography, message, Input, Tag, Button, Modal, Form, Select, InputNumber } from 'antd';
import { collection, getDocs, doc, getDoc, updateDoc, query, where, addDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase';

const { Title } = Typography;

interface PaymentRow {
    id: string;
    orderCode: string;
    shipName: string;
    totalAmount: number;
    remainingAmount: number;
    paymentStatus: string;
    invoiceCreatedAt: string;
    invoiceId?: string;
}

const PaymentList: React.FC = () => {
    const [orders, setOrders] = useState<PaymentRow[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [searchValue, setSearchValue] = useState<string>('');
    const [paymentModalVisible, setPaymentModalVisible] = useState<boolean>(false);
    const [selectedOrder, setSelectedOrder] = useState<PaymentRow | null>(null);
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
    const [processingPayment, setProcessingPayment] = useState<boolean>(false);
    const [form] = Form.useForm();

    const formatCurrency = (value: number) =>
        Number.isFinite(value) ? value.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' }) : '---';

    // =================== FETCH ORDERS ===================
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
                    const rawStatus = orderData?.Status || orderData?.status;
                    const lowerStatus = (rawStatus || '').toLowerCase();

                    if (!lowerStatus.includes('đã tạo hóa đơn')) return null;

                    let shipName = orderData?.ShipName || orderData?.shipName || '';

                    if (!shipName) {
                        try {
                            const shipId = orderData?.shipId || orderData?.ShipId;
                            if (shipId) {
                                const shipSnap = await getDoc(doc(db, 'ship', shipId));
                                if (shipSnap.exists()) {
                                    const shipData = shipSnap.data() as Record<string, any>;
                                    shipName = shipData?.Name || shipData?.name;
                                }
                            }
                        } catch {}
                    }

                    const invoiceData = invoiceMap.get(orderDoc.id) || null;

                    const totalAmount = Number(
                        invoiceData?.TotalAmount ?? orderData?.TotalCost ?? 0
                    );

                    const remainingAmount = Number(
                        invoiceData?.RemainingAmount ?? totalAmount
                    );

                    let paymentStatus = 'Chưa thanh toán';
                    if (remainingAmount === 0) paymentStatus = 'Đã thanh toán';
                    else if (remainingAmount < totalAmount) paymentStatus = 'Thanh toán một phần';

                    const createdSource = invoiceData?.CreatedDate;
                    let createdDate: any = null;
                    if (createdSource?.toDate) createdDate = createdSource.toDate();
                    else if (createdSource?.seconds) createdDate = new Date(createdSource.seconds * 1000);

                    const formattedCreated = createdDate
                        ? createdDate.toLocaleDateString('vi-VN')
                        : '';

                    return {
                        id: orderDoc.id,
                        orderCode: orderData?.OrderCode || orderDoc.id,
                        shipName,
                        totalAmount,
                        remainingAmount,
                        paymentStatus,
                        invoiceCreatedAt: formattedCreated,
                        invoiceId: invoiceData?.id,
                    } as PaymentRow;
                })
            );

            setOrders(rows.filter(Boolean) as PaymentRow[]);
        } catch (error) {
            message.error('Lỗi tải dữ liệu!');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPaymentOrders();
    }, []);

    // =================== HANDLE PAYMENT ===================
    const handlePayment = async (record: PaymentRow) => {
        setSelectedOrder(record);

        if (record.invoiceId) {
            const invSnap = await getDoc(doc(db, 'invoice', record.invoiceId));
            if (invSnap.exists()) setSelectedInvoice({ id: invSnap.id, ...invSnap.data() });
        }

        form.resetFields();
        setPaymentModalVisible(true);
    };

    const handleProcessPayment = async () => {
        try {
            if (!selectedOrder) return;

            const values = await form.validateFields();
            const paymentAmount = Number(values.amount);

            if (paymentAmount <= 0) {
                message.error('Số tiền phải lớn hơn 0');
                return;
            }

            setProcessingPayment(true);

            // Load invoice doc
            let invoiceDocRef: any;
            let invoiceData: any = {};

            if (selectedInvoice?.id) {
                invoiceDocRef = doc(db, 'invoice', selectedInvoice.id);
                const snap = await getDoc(invoiceDocRef);
                invoiceData = snap.data();
            }

            const currentRemaining = Number(
                invoiceData?.RemainingAmount ?? selectedOrder.totalAmount
            );

            if (paymentAmount > currentRemaining) {
                message.error('Số tiền vượt quá số nợ!');
                return;
            }

            const newRemainingAmount = currentRemaining - paymentAmount;

            let newPaymentStatus = 'Chưa thanh toán';
            if (newRemainingAmount === 0) newPaymentStatus = 'Đã thanh toán';
            else if (newRemainingAmount < selectedOrder.totalAmount) newPaymentStatus = 'Thanh toán một phần';

            // Run transaction
            await runTransaction(db, async (transaction) => {
                const paymentRef = doc(collection(db, 'payment'));
                transaction.set(paymentRef, {
                    Amount: paymentAmount,
                    Invoice_ID: invoiceDocRef.id,
                    PaymentDate: serverTimestamp(),
                    PaymentMethod: values.paymentMethod,
                });

                transaction.update(invoiceDocRef, {
                    RemainingAmount: newRemainingAmount,
                    PaymentStatus: newPaymentStatus,
                });
            });

            message.success('Thanh toán thành công!');
            setPaymentModalVisible(false);
            form.resetFields();
            fetchPaymentOrders();
        } catch (err) {
            message.error('Không thể thanh toán!');
        } finally {
            setProcessingPayment(false);
        }
    };

    const filteredOrders = useMemo(() => {
        if (!searchValue) return orders;
        const t = searchValue.toLowerCase();

        return orders.filter((order) =>
            [order.orderCode, order.shipName, order.paymentStatus]
                .join(' ')
                .toLowerCase()
                .includes(t)
        );
    }, [orders, searchValue]);

    const columns = [
        {
            title: 'STT',
            render: (_: any, __: any, idx: number) => idx + 1,
            width: 50,
        },
        { title: 'Tàu', dataIndex: 'shipName' },
        {
            title: 'Tổng tiền',
            dataIndex: 'totalAmount',
            render: (v: number) => formatCurrency(v),
        },
        {
            title: 'Còn lại',
            dataIndex: 'remainingAmount',
            render: (v: number) => formatCurrency(v),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'paymentStatus',
            render: (v: string) => {
                const l = v.toLowerCase();
                let color = 'gold';
                if (l.includes('đã thanh toán')) color = 'green';
                if (l.includes('một phần')) color = 'orange';
                return <Tag color={color}>{v}</Tag>;
            },
        },
        { title: 'Ngày tạo', dataIndex: 'invoiceCreatedAt' },
        {
            title: 'Hành động',
            render: (_: any, r: PaymentRow) => (
                <Button
                    type="primary"
                    size="small"
                    disabled={r.remainingAmount <= 0}
                    onClick={() => handlePayment(r)}
                >
                    {r.remainingAmount > 0 ? 'Thanh toán' : 'Đã thanh toán'}
                </Button>
            ),
        },
    ];

    return (
        <div>
            <div className="flex justify-between mb-4">
                <Title level={5}>Đơn chờ thanh toán</Title>
                <Input.Search
                    placeholder="Tìm theo tàu hoặc trạng thái"
                    allowClear
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    style={{ width: 300 }}
                />
            </div>

            <Table
                loading={loading}
                columns={columns}
                dataSource={filteredOrders}
                rowKey="id"
                bordered
            />

            <Modal
                title="Thanh toán"
                open={paymentModalVisible}
                onOk={handleProcessPayment}
                onCancel={() => setPaymentModalVisible(false)}
                confirmLoading={processingPayment}
            >
                {selectedOrder && (
                    <div className="mb-3 p-3 bg-gray-50 rounded">
                        <p><b>Tàu:</b> {selectedOrder.shipName}</p>
                        <p><b>Còn lại:</b> {formatCurrency(selectedOrder.remainingAmount)}</p>
                    </div>
                )}

                <Form form={form} layout="vertical">
                    <Form.Item
                        label="Số tiền thanh toán"
                        name="amount"
                        rules={[{ required: true, message: 'Nhập số tiền!' }]}
                    >
                        <InputNumber
                            style={{ width: '100%' }}
                            min={1}
                            max={selectedOrder?.remainingAmount}
                            formatter={(v) =>
                                `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                            }
                            parser={(v) =>
                                Number(v?.replace(/,/g, '') || 0)
                            }
                        />
                    </Form.Item>

                    <Form.Item
                        label="Phương thức thanh toán"
                        name="paymentMethod"
                        rules={[{ required: true, message: 'Chọn phương thức!' }]}
                    >
                        <Select placeholder="Chọn phương thức">
                            <Select.Option value="Tiền mặt">Tiền mặt</Select.Option>
                            <Select.Option value="Chuyển khoản">Chuyển khoản</Select.Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default PaymentList;
