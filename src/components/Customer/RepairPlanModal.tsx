import React from 'react';
import { Modal, Form, Input, Row, Col, Card, Button } from 'antd';

interface RepairPlanModalProps {
    visible: boolean;
    onClose: () => void;
    onReproposal: () => void;
    onAcceptRepair: () => void;
    proposalText: string;
    materialLines: any[];
    savedMaterialsCost: number;
    savedLaborCost: number;
    savedTotalCost: number;
}

const RepairPlanModal: React.FC<RepairPlanModalProps> = ({
    visible,
    onClose,
    onReproposal,
    onAcceptRepair,
    proposalText,
    materialLines,
    savedMaterialsCost,
    savedLaborCost,
    savedTotalCost,
}) => {
    return (
        <Modal
            title="Phương án sửa chữa đơn hàng"
            open={visible}
            onCancel={onClose}
            footer={null}
        >
            <Form layout="vertical">

                {/* Nội dung phương án */}
                <Form.Item label="Phương án sửa chữa">
                    <Input.TextArea rows={6} value={proposalText} readOnly />
                </Form.Item>

                {/* Vật liệu đề xuất */}
                <Form.Item>
                    <Card size="small" title="Vật liệu đề xuất" className="mb-4">
                        <Row gutter={8} className="mb-2 font-medium">
                            <Col span={12}>Tên</Col>
                            <Col span={6}>Số lượng</Col>
                            <Col span={4}>Chi phí</Col>
                            <Col span={2}></Col>
                        </Row>

                        {materialLines.map((line, idx) => (
                            <Row key={line.id || idx} gutter={8} className="mb-2">
                                <Col span={12}>{line.name}</Col>
                                <Col span={6}>{line.qty}</Col>
                                <Col span={4}>
                                    {(Number(line.lineTotal) || 0).toLocaleString('vi-VN')} đ
                                </Col>
                            </Row>
                        ))}

                        <div className="text-right font-medium">
                            Chi phí vật liệu: {savedMaterialsCost.toLocaleString('vi-VN')} đ
                        </div>
                    </Card>

                    <div className="mt-2 text-right">
                        <div>Chi phí nhân công: {savedLaborCost.toLocaleString('vi-VN')} đ</div>
                        <div className="font-semibold">
                            Tổng chi phí: {savedTotalCost.toLocaleString('vi-VN')} đ
                        </div>
                    </div>

                    {/* Footer buttons */}
                    <div className="text-right mt-3 flex justify-end gap-2">

                        <Button onClick={onReproposal}>Đề xuất lại</Button>

                        <Button type="primary" onClick={onAcceptRepair}>
                            Đồng ý
                        </Button>
                    </div>
                </Form.Item>

            </Form>
        </Modal>
    );
};

export default RepairPlanModal;
