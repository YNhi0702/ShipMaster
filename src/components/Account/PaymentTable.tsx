import { Table, Tag, Button } from "antd";

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

interface Props {
    orders: PaymentRow[];
    loading: boolean;
    onPay: (record: PaymentRow) => void;
    onShowHistory: (record: PaymentRow) => void;
}

const PaymentTable: React.FC<Props> = ({ orders, loading, onPay, onShowHistory }) => {
    const formatCurrency = (value: number) =>
        value.toLocaleString("vi-VN", { style: "currency", currency: "VND" });

    const columns = [
        { title: "STT", width: 50, render: (_: any, __: any, idx: number) => idx + 1 },
        { title: "Tàu", dataIndex: "shipName" },
        { title: "Tổng tiền", dataIndex: "totalAmount", render: (v: number) => formatCurrency(v) },
        { title: "Còn lại", dataIndex: "remainingAmount", render: (v: number) => formatCurrency(v) },
        {
            title: "Trạng thái",
            dataIndex: "paymentStatus",
            render: (v: string) => {
                const l = v.toLowerCase();
                let color = "gold";
                if (l.includes("đã thanh toán")) color = "green";
                if (l.includes("một phần")) color = "orange";
                return <Tag color={color}>{v}</Tag>;
            },
        },
        { title: "Ngày tạo", dataIndex: "invoiceCreatedAt" },
        {
            title: "Hành động",
            render: (_: any, record: PaymentRow) => (
                <div className="flex gap-2">
                    <Button
                        size="small"
                        type="primary"
                        disabled={record.remainingAmount <= 0}
                        onClick={() => onPay(record)}
                    >
                        Thanh toán
                    </Button>

                    <Button size="small" onClick={() => onShowHistory(record)}>
                        Lịch sử
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <Table
            loading={loading}
            columns={columns}
            dataSource={orders}
            rowKey="id"
            bordered
        />
    );
};

export default PaymentTable;
