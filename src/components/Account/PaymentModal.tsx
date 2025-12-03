import { Modal, Form, InputNumber, Select } from "antd";

interface PaymentRow {
    id: string;
    shipName: string;
    remainingAmount: number;
}

interface Props {
    visible: boolean;
    order: PaymentRow | null;
    form: any;
    loading: boolean;
    onSubmit: () => void;
    onCancel: () => void;
}

const PaymentModal: React.FC<Props> = ({
    visible,
    order,
    form,
    loading,
    onSubmit,
    onCancel,
}) => {
    const formatCurrency = (value: number) =>
        value.toLocaleString("vi-VN", { style: "currency", currency: "VND" });

    return (
        <Modal
            title="Thanh toán"
            open={visible}
            confirmLoading={loading}
            onOk={onSubmit}
            onCancel={onCancel}
        >
            {order && (
                <div className="mb-3 p-3 bg-gray-50 rounded">
                    <p><b>Tàu:</b> {order.shipName}</p>
                    <p><b>Còn lại:</b> {formatCurrency(order.remainingAmount)}</p>
                </div>
            )}

            <Form form={form} layout="vertical">
                <Form.Item
                    label="Số tiền thanh toán"
                    name="amount"
                    rules={[{ required: true, message: "Nhập số tiền!" }]}
                >
                    <InputNumber
                        style={{ width: "100%" }}
                        min={1}
                        max={order?.remainingAmount}
                        formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                        parser={(v) => Number(v?.replace(/,/g, "") || 0)}
                    />
                </Form.Item>

                <Form.Item
                    label="Phương thức thanh toán"
                    name="paymentMethod"
                    rules={[{ required: true, message: "Chọn phương thức!" }]}
                >
                    <Select placeholder="Chọn phương thức">
                        <Select.Option value="Tiền mặt">Tiền mặt</Select.Option>
                        <Select.Option value="Chuyển khoản">Chuyển khoản</Select.Option>
                    </Select>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default PaymentModal;
