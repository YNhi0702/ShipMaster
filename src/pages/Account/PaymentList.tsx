import React, { useEffect, useMemo, useState } from "react";
import { Typography, Input, message, Form } from "antd";
import {
    collection,
    getDocs,
    doc,
    getDoc,
    serverTimestamp,
    runTransaction,
    updateDoc
} from "firebase/firestore";

import PaymentTable from "../../components/Account/PaymentTable";
import PaymentModal from "../../components/Account/PaymentModal";
import PaymentHistoryModal from "../../components/Account/PaymentHistoryModal";

import { db } from "../../firebase";

const { Title } = Typography;

// Định nghĩa Interface dòng dữ liệu hiển thị trên bảng danh sách hóa đơn thanh toán
interface PaymentRow {
    id: string;               // Mã ID của đơn hàng (RepairOrder)
    orderCode: string;        // Số đơn hàng hiển thị
    shipName: string;         // Tên tàu được sửa chữa
    totalAmount: number;      // Tổng giá trị hóa đơn sau giảm giá
    remainingAmount: number;  // Số tiền còn lại chưa thanh toán
    paymentStatus: string;    // Trạng thái thanh toán (Chưa thanh toán, đã thanh toán, thanh toán một phần)
    invoiceCreatedAt: string; // Ngày tạo hóa đơn
    invoiceId?: string;       // ID tài liệu hóa đơn tương ứng trong Firestore
}

// Định nghĩa Interface lịch sử của các lần thanh toán từng đợt
interface PaymentHistoryRow {
    id: string;            // ID chứng từ thanh toán
    amount: number;        // Số tiền đóng đợt này
    paymentDate: string;   // Ngày nộp tiền
    paymentMethod: string; // Phương thức (Tiền mặt, chuyển khoản...)
    invoiceId: string;     // Khóa ngoại liên kết tới hóa đơn
}

const PaymentList: React.FC = () => {
    const [orders, setOrders] = useState<PaymentRow[]>([]); // Danh sách hóa đơn để theo dõi công nợ
    const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryRow[]>([]); // Toàn bộ lịch sử các lần đóng tiền
    const [loading, setLoading] = useState<boolean>(true); // Trạng thái tải dữ liệu

    const [searchValue, setSearchValue] = useState(""); // Ô tìm kiếm
    const [selectedOrder, setSelectedOrder] = useState<PaymentRow | null>(null); // Hóa đơn đang chọn để đóng tiền
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null); // Bản ghi hóa đơn Firestore đầy đủ được chọn

    // Trạng thái đóng/mở các Modal
    const [historyVisible, setHistoryVisible] = useState(false); // Modal xem các đợt đã thanh toán của hóa đơn này
    const [paymentVisible, setPaymentVisible] = useState(false); // Modal thực hiện nộp tiền mặt/chuyển khoản đợt mới
    const [processingPayment, setProcessingPayment] = useState(false); // Trạng thái spinner khi submit giao dịch đóng tiền

    const [form] = Form.useForm(); // Quản lý dữ liệu Form nhập tiền đóng

    // Hàm định dạng hiển thị tiền tệ
    const formatCurrency = (value: number) =>
        value.toLocaleString("vi-VN", { style: "currency", currency: "VND" });

    /**
     * Tải danh sách đơn sửa chữa và kết nối với hóa đơn tương ứng
     */
    const fetchPaymentOrders = async () => {
        try {
            setLoading(true);
            // Lấy song song dữ liệu của 2 collection 'repairOrder' và 'invoice' để tối ưu thời gian chờ
            const [orderSnapshot, invoiceSnapshot] = await Promise.all([
                getDocs(collection(db, 'repairOrder')),
                getDocs(collection(db, 'invoice')),
            ]);

            // Tạo Map lưu nhanh các hóa đơn theo khóa ngoại 'RepairOrder_ID' để tra cứu nhanh O(1)
            const invoiceMap = new Map<string, any>();
            invoiceSnapshot.docs.forEach((invoiceDoc) => {
                const invoiceData = invoiceDoc.data() as Record<string, any>;
                const repairOrderId = invoiceData?.RepairOrder_ID;
                if (repairOrderId) {
                    invoiceMap.set(String(repairOrderId), { id: invoiceDoc.id, ...invoiceData });
                }
            });

            // Duyệt danh sách đơn để hiển thị thông tin công nợ thanh toán
            const rows = await Promise.all(
                orderSnapshot.docs.map(async (orderDoc) => {
                    const orderData = orderDoc.data() as Record<string, any>;
                    const rawStatus = orderData?.Status || orderData?.status;
                    const lowerStatus = (rawStatus || '').toLowerCase();

                    // Chỉ hiển thị các đơn sửa chữa đã được kế toán xuất hóa đơn
                    if (!lowerStatus.includes('đã tạo hóa đơn') && !lowerStatus.includes('thanh toán')) return null;

                    let shipName = orderData?.ShipName || orderData?.shipName || '';

                    // Nếu đơn sửa chữa chưa lưu trực tiếp tên tàu, truy vấn thông tin từ collection 'ship' qua 'shipId'
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

                    // Đối chiếu hóa đơn từ map
                    const invoiceData = invoiceMap.get(orderDoc.id) || null;

                    const totalAmount = Number(
                        invoiceData?.TotalAmount ?? orderData?.totalCost ?? 0
                    );

                    const remainingAmount = Number(
                        invoiceData?.RemainingAmount ?? totalAmount
                    );

                    // Phân loại trạng thái thanh toán dựa trên số dư nợ còn lại
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

            // Bỏ các giá trị null và cập nhật vào State
            setOrders(rows.filter(Boolean) as PaymentRow[]);
        } catch (error) {
            message.error('Lỗi tải dữ liệu!');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Tải toàn bộ danh sách các chứng từ thanh toán đợt từ collection 'payment'
     */
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

    // Tự động tải dữ liệu ban đầu
    useEffect(() => {
        fetchPaymentOrders();
        fetchPaymentHistory();
    }, []);

    // Nhấp chuột vào nút "Thanh toán" để mở form nộp tiền mặt/chuyển khoản
    const handlePay = async (record: PaymentRow) => {
        setSelectedOrder(record);

        if (record.invoiceId) {
            const snap = await getDoc(doc(db, "invoice", record.invoiceId));
            if (snap.exists()) setSelectedInvoice({ id: snap.id, ...snap.data() });
        }

        form.resetFields();
        setPaymentVisible(true);
    };

    /**
     * Giao dịch đóng tiền từng phần / toàn phần (sử dụng Firestore Transaction để đảm bảo tính nhất quán dữ liệu)
     * Tránh lỗi ghi dữ liệu không đồng bộ khi hai kế toán cùng xử lý nộp tiền cho 1 hóa đơn
     */
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

            // Lấy công nợ còn lại hiện tại từ DB
            const currentRemaining = Number(invoiceData?.RemainingAmount ?? selectedOrder.totalAmount);

            // Không cho phép nộp số tiền lớn hơn số nợ còn lại
            if (paymentAmount > currentRemaining) {
                message.error("Số tiền vượt quá số còn lại!");
                return;
            }

            const newRemain = currentRemaining - paymentAmount;
            let newStatus = "Chưa thanh toán";
            if (newRemain === 0) newStatus = "Đã thanh toán";
            else if (newRemain < selectedOrder.totalAmount) newStatus = "Thanh toán một phần";

            // Khởi chạy Firestore Transaction
            await runTransaction(db, async (transaction) => {
                const paymentRef = doc(collection(db, "payment"));
                // 1. Thêm một chứng từ đóng tiền mới
                transaction.set(paymentRef, {
                    Amount: paymentAmount,
                    Invoice_ID: selectedInvoice.id,
                    PaymentDate: serverTimestamp(),
                    PaymentMethod: values.paymentMethod,
                });

                // 2. Cập nhật lại số tiền còn nợ và trạng thái nợ mới trên hóa đơn
                transaction.update(invoiceRef, {
                    RemainingAmount: newRemain,
                    PaymentStatus: newStatus,
                });
            });

            // Nếu nợ đã trả hết về 0, cập nhật trạng thái đơn sửa chữa tương ứng
            if (newRemain === 0) {
                try {
                    await updateDoc(doc(db, 'repairOrder', selectedOrder.id), {
                        Status: 'Đã hoàn thành thanh toán',
                    });
                } catch (e) {
                    console.warn('Failed to update repairOrder status', e);
                }
            } else {
                try {
                    await updateDoc(doc(db, 'repairOrder', selectedOrder.id), {
                        Status: 'Thanh toán một phần',
                    });
                } catch (e) {
                    console.warn('Failed to update repairOrder status', e);
                }
            }

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

    // Lọc lịch sử đóng tiền theo hóa đơn được chọn
    const filteredHistory = useMemo(() => {
        if (!selectedOrder?.invoiceId) return [];
        return paymentHistory.filter((p) => p.invoiceId === selectedOrder.invoiceId);
    }, [selectedOrder, paymentHistory]);

    // Tìm kiếm hóa đơn theo từ khóa trên ô Search
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

            {/* Bảng hiển thị hóa đơn kế toán và công nợ */}
            <PaymentTable
                orders={filteredOrders}
                loading={loading}
                onPay={handlePay}
                onShowHistory={(order) => {
                    setSelectedOrder(order);
                    setHistoryVisible(true);
                }}
            />

            {/* Modal hiển thị lịch sử các đợt đóng tiền cũ */}
            <PaymentHistoryModal
                visible={historyVisible}
                order={selectedOrder}
                history={filteredHistory}
                onClose={() => setHistoryVisible(false)}
            />

            {/* Modal tạo phiếu thu/đóng tiền đợt mới */}
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
