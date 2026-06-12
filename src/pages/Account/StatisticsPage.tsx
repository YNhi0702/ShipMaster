import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Typography, message, Spin } from 'antd';
import { invoiceService } from '../../services/invoiceService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import moment from 'moment';

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

    const [chartData, setChartData] = useState<any[]>([]);

    const fetchStatistics = async () => {
        try {
            setLoading(true);
            const [stats, chart] = await Promise.all([
                invoiceService.getAccountingStatistics(),
                invoiceService.getMonthlyChartData()
            ]);

            setStatistics(stats);
            setChartData(chart);

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

            <div style={{ marginTop: '30px' }}>
                <Title level={4}>Biểu đồ doanh thu tháng {moment().format('MM/YYYY')}</Title>
                <div style={{ width: '100%', height: 400, background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chartData}
                            margin={{
                                top: 20,
                                right: 30,
                                left: 20,
                                bottom: 5,
                            }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="date"
                                tickFormatter={(tick) => moment(tick, 'YYYY-MM-DD').format('DD')}
                                label={{ value: 'Ngày', position: 'insideBottomRight', offset: -5 }}
                            />
                            <YAxis
                                tickFormatter={(value) => new Intl.NumberFormat('vi-VN', { notation: "compact", compactDisplay: "short" }).format(value)}
                            />
                            <Tooltip
                                formatter={(value: any) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)}
                                labelFormatter={(label) => `Ngày ${moment(label, 'YYYY-MM-DD').format('DD/MM/YYYY')}`}
                            />
                            <Legend />
                            <Bar dataKey="collected" name="Doanh thu" fill="#3f8600" />
                        </BarChart> 
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default StatisticsPage;
