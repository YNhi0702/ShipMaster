import React, { useEffect, useMemo, useState } from "react";
import { Typography, Input, message, Form } from "antd";
import {
    collection,
    getDocs,
    doc,
    getDoc,
    serverTimestamp,
    runTransaction
} from "firebase/firestore";

import PaymentTable from "../../components/Account/PaymentTable";
import PaymentModal from "../../components/Account/PaymentModal";
import PaymentHistoryModal from "../../components/Account/PaymentHistoryModal";

import { db } from "../../firebase";

const { Title } = Typography;

// Type dùng trong file chính
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

interface PaymentHistoryRow {
    id: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    invoiceId: string;
}

const PaymentList: React.FC = () => {
    const [orders, setOrders] = useState<PaymentRow[]>([]);
    const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryRow[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const [searchValue, setSearchValue] = useState("");
    const [selectedOrder, setSelectedOrder] = useState<PaymentRow | null>(null);
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

    // Modal states
    const [historyVisible, setHistoryVisible] = useState(false);
    const [paymentVisible, setPaymentVisible] = useState(false);
    const [processingPayment, setProcessingPayment] = useState(false);

    const [form] = Form.useForm();

    const formatCurrency = (value: number) =>
        value.toLocaleString("vi-VN", { style: "currency", currency: "VND" });

    // ================= FETCH ORDERS =================
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

                    // Nếu không có tên tàu, lấy từ bảng `ship` bằng `shipId`
                    if (!shipName) {
                        try {
                            const shipId = orderData?.shipId || orderData?.ShipId;
                            if (shipId) {
                                const shipSnap = await getDoc(doc(db, 'ship', shipId));
                                if (shipSnap.exists()) {
                                    const shipData = shipSnap.data() as Record<string, any>;
                                    shipName = shipData?.Name || shipData?.name || 'Không xác định';
                                }
                            }
                        } catch (error) {
                            console.error('Lỗi lấy tên tàu:', error);
                            shipName = 'Không xác định';
                        }
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
                        shipName, // Đảm bảo tên tàu được lấy đúng
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

    // ================= FETCH PAYMENT HISTORY =================
    const fetchPaymentHistory = async () => {
        try {
            const snap = await getDocs(collection(db, "payment"));
            const rows = snap.docs.map((doc) => {
                const d = doc.data();

                const paymentDate = d?.PaymentDate?.toDate
                    ? d.PaymentDate.toDate().toLocaleDateString("vi-VN")
                    : "---";

                return {
                    id: doc.id,
                    amount: d.Amount,
                    paymentDate,
                    paymentMethod: d.PaymentMethod,
                    invoiceId: d.Invoice_ID,
                };
            });

            setPaymentHistory(rows);
        } catch {
            message.error("Lỗi tải lịch sử thanh toán!");
        }
    };

    useEffect(() => {
        fetchPaymentOrders();
        fetchPaymentHistory();
    }, []);

    // ================= HANDLE PAYMENT =================
    const handlePay = async (record: PaymentRow) => {
        setSelectedOrder(record);

        if (record.invoiceId) {
            const snap = await getDoc(doc(db, "invoice", record.invoiceId));
            if (snap.exists()) setSelectedInvoice({ id: snap.id, ...snap.data() });
        }

        form.resetFields();
        setPaymentVisible(true);
    };

    const submitPayment = async () => {
        try {
            if (!selectedOrder) return;

            const values = await form.validateFields();
            const paymentAmount = Number(values.amount);

            if (paymentAmount <= 0) {
                message.error("Số tiền phải lớn hơn 0!");
                return;
            }

            setProcessingPayment(true);

            const invoiceRef = doc(db, "invoice", selectedInvoice.id);
            const snap = await getDoc(invoiceRef);
            const invoiceData = snap.data();

            const currentRemaining = Number(invoiceData?.RemainingAmount ?? selectedOrder.totalAmount);

            if (paymentAmount > currentRemaining) {
                message.error("Số tiền vượt quá số còn lại!");
                return;
            }

            const newRemain = currentRemaining - paymentAmount;
            let newStatus = "Chưa thanh toán";
            if (newRemain === 0) newStatus = "Đã thanh toán";
            else if (newRemain < selectedOrder.totalAmount) newStatus = "Thanh toán một phần";

            await runTransaction(db, async (transaction) => {
                const paymentRef = doc(collection(db, "payment"));
                transaction.set(paymentRef, {
                    Amount: paymentAmount,
                    Invoice_ID: selectedInvoice.id,
                    PaymentDate: serverTimestamp(),
                    PaymentMethod: values.paymentMethod,
                });

                transaction.update(invoiceRef, {
                    RemainingAmount: newRemain,
                    PaymentStatus: newStatus,
                });
            });

            message.success("Thanh toán thành công!");

            setPaymentVisible(false);
            fetchPaymentOrders();
            fetchPaymentHistory();
        } catch {
            message.error("Không thể thanh toán!");
        } finally {
            setProcessingPayment(false);
        }
    };

    // ================= HISTORY FILTER =================
    const filteredHistory = useMemo(() => {
        if (!selectedOrder?.invoiceId) return [];
        return paymentHistory.filter((p) => p.invoiceId === selectedOrder.invoiceId);
    }, [selectedOrder, paymentHistory]);

    // ================= SEARCH FILTER =================
    const filteredOrders = useMemo(() => {
        if (!searchValue) return orders;

        const q = searchValue.toLowerCase();
        return orders.filter((o) =>
            [o.orderCode, o.shipName, o.paymentStatus]
                .join(" ")
                .toLowerCase()
                .includes(q)
        );
    }, [orders, searchValue]);

    return (
        <div>
            <div className="flex justify-between mb-4">
                <Title level={5}>Danh sách hoá đơn</Title>
                <Input.Search
                    placeholder="Tìm theo tàu hoặc trạng thái"
                    allowClear
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    style={{ width: 300 }}
                />
            </div>

            <PaymentTable
                orders={filteredOrders}
                loading={loading}
                onPay={handlePay}
                onShowHistory={(order: PaymentRow) => {
                    setSelectedOrder(order);
                    setHistoryVisible(true);
                }}
            />

            {/* Modal xem lịch sử */}
            <PaymentHistoryModal
                visible={historyVisible}
                order={selectedOrder}
                history={filteredHistory}
                onClose={() => setHistoryVisible(false)}
            />

            {/* Modal thanh toán */}
            <PaymentModal
                visible={paymentVisible}
                order={selectedOrder}
                form={form}
                loading={processingPayment}
                onSubmit={submitPayment}
                onCancel={() => setPaymentVisible(false)}
            />
        </div>
    );
};

export default PaymentList;
