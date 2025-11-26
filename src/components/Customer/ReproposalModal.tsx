import React from 'react';
import { Modal, Form, Input } from 'antd';

interface ReproposalModalProps {
    visible: boolean;
    submitting: boolean;
    onCancel: () => void;
    onSubmit: (reason: string) => void;
}

const ReproposalModal: React.FC<ReproposalModalProps> = ({
    visible,
    submitting,
    onCancel,
    onSubmit
}) => {

    const [form] = Form.useForm();

    return (
        <Modal
            title="Yêu cầu đề xuất lại"
            open={visible}
            onCancel={onCancel}
            okText="Gửi yêu cầu"
            confirmLoading={submitting}
            onOk={() => form.submit()}
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={(values) => onSubmit(values.reason)}
            >
                <Form.Item
                    name="reason"
                    label="Lý do"
                    rules={[{ required: true, message: 'Vui lòng nhập lý do yêu cầu đề xuất lại' }]}
                >
                    <Input.TextArea rows={4} placeholder="Nhập yêu cầu đề xuất lại..." />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default ReproposalModal;
