import React from 'react';
import { Card, Typography, Row, Col } from 'antd';

const { Text } = Typography;

interface InvoiceProps {
    shipName: string;
    workshopName: string;
    createdAt: string;
    materialsCost: number;
    laborCost: number;
    totalCost: number;
}

const formatMoney = (value: number) =>
    value?.toLocaleString('vi-VN') + ' đ';

const moneyStyle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 500, // giống cỡ chữ thông tin tàu
};

const Invoice: React.FC<InvoiceProps> = ({
    shipName,
    workshopName,
    createdAt,
    materialsCost,
    laborCost,
    totalCost,
}) => {
    return (
        <div className="space-y-4">

            {/* --- Thông tin đơn --- */}
            <Card bordered className="shadow-sm">
                <Row gutter={[16, 8]}>
                    <Col span={12}><Text strong>Tên tàu:</Text></Col>
                    <Col span={12}><Text>{shipName}</Text></Col>

                    <Col span={12}><Text strong>Xưởng sửa chữa:</Text></Col>
                    <Col span={12}><Text>{workshopName}</Text></Col>

                    <Col span={12}><Text strong>Ngày tạo:</Text></Col>
                    <Col span={12}><Text>{createdAt}</Text></Col>
                </Row>
            </Card>

            {/* --- Chi phí vật liệu --- */}
            <Card size="small" className="shadow-sm">
                <div className="flex justify-between items-center">
                    <span>Chi phí vật liệu</span>
                    <span >{formatMoney(materialsCost)}</span>
                </div>
            </Card>

            {/* --- Chi phí nhân công --- */}
            <Card size="small" className="shadow-sm">
                <div className="flex justify-between items-center">
                    <span>Chi phí nhân công</span>
                    <span >{formatMoney(laborCost)}</span>
                </div>
            </Card>

            {/* --- Tổng chi phí --- */}
            <Card size="small" className="shadow-sm">
                <div className="flex justify-between items-center">
                    <strong style={{ fontSize: 14 }}>Tổng chi phí</strong>
                    <strong >{formatMoney(totalCost)}</strong>
                </div>
            </Card>

        </div>
    );
};

export default Invoice;
