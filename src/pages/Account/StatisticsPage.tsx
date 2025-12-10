import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Typography, message, Spin } from 'antd';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

const { Title } = Typography;

const StatisticsPage: React.FC = () => {
    const [loading, setLoading] = useState(true);

    const [statistics, setStatistics] = useState({
        totalInvoices: 0,
        totalPaid: 0,
        totalPartial: 0,
        totalUnpaid: 0,
        totalCollected: 0,
        totalDebt: 0,
    });

    const fetchStatistics = async () => {
        try {
            setLoading(true);

            // =============================
            // 1. LẤY DANH SÁCH HÓA ĐƠN
            // =============================
            const invoiceSnap = await getDocs(collection(db, "invoice"));
            const invoices = invoiceSnap.docs.map(doc => doc.data());

            // =============================
            // 2. LẤY DANH SÁCH PAYMENT (ĐỂ TÍNH ĐÃ THU)
            // =============================
            const paymentSnap = await getDocs(collection(db, "payment"));
            const payments = paymentSnap.docs.map(doc => doc.data());

            // =============================
            // 3. TÍNH TỔNG DOANH THU ĐÃ THU (TOTALCOLLECTED)
            // =============================
            let totalCollected = 0;
            payments.forEach(p => {
                totalCollected += p.Amount || 0;
            });

            // =============================
            // 4. TÍNH TỔNG CÔNG NỢ (TỪ REMAININGAMOUNT)
            // =============================
            let totalDebt = 0;
            invoices.forEach(inv => {
                totalDebt += inv.RemainingAmount || 0;
            });

            // =============================
            // 5. PHÂN LOẠI HÓA ĐƠN THEO PAYMENTSTATUS
            // =============================
            let paid = 0;
            let partial = 0;
            let unpaid = 0;

            invoices.forEach(inv => {
                const status = inv.PaymentStatus;

                if (status === "Đã thanh toán") {
                    paid++;
                } else if (status === "Thanh toán một phần") {
                    partial++;
                } else if (status === "Chưa thanh toán") {
                    unpaid++;
                }
            });

            setStatistics({
                totalInvoices: invoices.length,
                totalPaid: paid,
                totalPartial: partial,
                totalUnpaid: unpaid,
                totalCollected,
                totalDebt,
            });

        } catch (error) {
            console.error(error);
            message.error("Không thể tải dữ liệu thống kê.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatistics();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center py-10">
                <Spin tip="Đang tải dữ liệu..." />
            </div>
        );
    }

    return (
        <div className="p-6">
            <Title level={4}>Thống kê kế toán</Title>

            <Row gutter={16} className="mb-6">

                {/* Tổng hóa đơn */}
                <Col span={6}>
                    <Card>
                        <Statistic title="Tổng số hóa đơn" value={statistics.totalInvoices} />
                    </Card>
                </Col>

                {/* Đã thanh toán */}
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="Hóa đơn đã thanh toán"
                            value={statistics.totalPaid}
                            valueStyle={{ color: '#3f8600' }}
                        />
                    </Card>
                </Col>

                {/* Thanh toán một phần */}
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="Hóa đơn đang thanh toán"
                            value={statistics.totalPartial}
                            valueStyle={{ color: '#faad14' }}
                        />
                    </Card>
                </Col>

                {/* Chưa thanh toán */}
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="Hóa đơn chưa thanh toán"
                            value={statistics.totalUnpaid}
                            valueStyle={{ color: '#cf1322' }}
                        />
                    </Card>
                </Col>

            </Row>

            <Row gutter={16}>
                {/* ĐÃ THU */}
                <Col span={12}>
                    <Card>
                        <Statistic
                            title="Tổng doanh thu (ĐÃ THU)"
                            value={statistics.totalCollected}
                            suffix="VND"
                            valueStyle={{ color: '#3f8600' }}
                        />
                    </Card>
                </Col>

                {/* CÔNG NỢ */}
                <Col span={12}>
                    <Card>
                        <Statistic
                            title="Tổng công nợ (CÒN LẠI)"
                            value={statistics.totalDebt}
                            suffix="VND"
                            valueStyle={{ color: '#cf1322' }}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default StatisticsPage;
