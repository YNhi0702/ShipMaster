import { Modal, Table } from "antd";

interface PaymentRow {
    id: string;
    shipName: string;
    invoiceId?: string;
}

interface PaymentHistoryRow {
    id: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    invoiceId: string;
}

interface Props {
    visible: boolean;
    order: PaymentRow | null;
    history: PaymentHistoryRow[];
    onClose: () => void;
}

const PaymentHistoryModal: React.FC<Props> = ({ visible, order, history, onClose }) => {
    const formatCurrency = (value: number) =>
        value.toLocaleString("vi-VN", { style: "currency", currency: "VND" });

    const columns = [
        { title: "STT", width: 60, render: (_: any, __: any, idx: number) => idx + 1 },
        { title: "Số tiền", dataIndex: "amount", render: (v: number) => formatCurrency(v) },
        { title: "Ngày thanh toán", dataIndex: "paymentDate" },
        { title: "Phương thức", dataIndex: "paymentMethod" },
    ];

    return (
        <Modal
            title={`Lịch sử thanh toán - ${order?.shipName || ""}`}
            open={visible}
            onCancel={onClose}
            footer={null}
            width={650}
        >
            <Table
                columns={columns}
                dataSource={history}
                rowKey="id"
                bordered
                pagination={false}
            />
        </Modal>
    );
};

export default PaymentHistoryModal;
