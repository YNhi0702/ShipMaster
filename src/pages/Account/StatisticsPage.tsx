import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Typography, message, Spin } from 'antd';
import { invoiceService } from '../../services/invoiceService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import moment from 'moment';

const { Title } = Typography;

const StatisticsPage: React.FC = () => {
    const [loading, setLoading] = useState(true); // Trạng thái tải dữ liệu

    // State lưu giữ các chỉ số thống kê kế toán
    const [statistics, setStatistics] = useState({
        totalInvoices: 0,   // Tổng số hóa đơn đã xuất
        totalPaid: 0,       // Số lượng hóa đơn đã trả hết tiền
        totalPartial: 0,    // Số lượng hóa đơn trả một phần (còn nợ)
        totalUnpaid: 0,     // Số lượng hóa đơn chưa trả đồng nào
        totalCollected: 0,  // Tổng số tiền mặt/chuyển khoản đã thực thu
        totalDebt: 0,       // Tổng số tiền còn nợ (công nợ khách hàng)
    });

    const [chartData, setChartData] = useState<any[]>([]); // Dữ liệu cho biểu đồ doanh thu theo ngày

    /**
     * Tải dữ liệu thống kê kế toán từ service `invoiceService`
     */
    const fetchStatistics = async () => {
        try {
            setLoading(true);
            // Gọi song song hai hàm lấy tổng hợp số liệu thống kê và dữ liệu vẽ biểu đồ tháng hiện tại
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

    // Tự động fetch dữ liệu khi trang web được tải
    useEffect(() => {
        fetchStatistics();
    }, []);

    // Hiển thị vòng xoay spinner khi dữ liệu đang được tải từ Firestore
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

            {/* Khối các ô thống kê dạng thẻ Card (Statistic widgets) */}
            <Row gutter={16} className="mb-6">

                {/* 1. Tổng số hóa đơn */}
                <Col span={6}>
                    <Card>
                        <Statistic title="Tổng số hóa đơn" value={statistics.totalInvoices} />
                    </Card>
                </Col>

                {/* 2. Số lượng hóa đơn Đã thanh toán */}
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="Hóa đơn đã thanh toán"
                            value={statistics.totalPaid}
                            valueStyle={{ color: '#3f8600' }} // Màu xanh lá biểu trưng cho sự hoàn thành tốt
                        />
                    </Card>
                </Col>

                {/* 3. Số lượng hóa đơn Đang thanh toán (một phần) */}
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="Hóa đơn đang thanh toán"
                            value={statistics.totalPartial}
                            valueStyle={{ color: '#faad14' }} // Màu vàng cảnh báo
                        />
                    </Card>
                </Col>

                {/* 4. Số lượng hóa đơn Chưa thanh toán */}
                <Col span={6}>
                    <Card>
                        <Statistic
                            title="Hóa đơn chưa thanh toán"
                            value={statistics.totalUnpaid}
                            valueStyle={{ color: '#cf1322' }} // Màu đỏ báo động
                        />
                    </Card>
                </Col>

            </Row>

            {/* Khối thống kê tổng số tiền doanh thu và tổng số tiền nợ */}
            <Row gutter={16}>
                {/* Doanh thu thực tế đã thu được */}
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

                {/* Tổng nợ còn treo của khách hàng */}
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

            {/* Vẽ biểu đồ cột doanh thu (sử dụng thư viện Recharts) */}
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
                            {/* Lưới tọa độ biểu đồ */}
                            <CartesianGrid strokeDasharray="3 3" />
                            
                            {/* Trục hoành: hiển thị các ngày trong tháng (1 đến 31) */}
                            <XAxis
                                dataKey="date"
                                tickFormatter={(tick) => moment(tick, 'YYYY-MM-DD').format('DD')}
                                label={{ value: 'Ngày', position: 'insideBottomRight', offset: -5 }}
                            />
                            
                            {/* Trục tung: hiển thị tiền doanh thu viết rút gọn (ví dụ: 1M thay vì 1.000.000) */}
                            <YAxis
                                tickFormatter={(value) => new Intl.NumberFormat('vi-VN', { notation: "compact", compactDisplay: "short" }).format(value)}
                            />
                            
                            {/* Công cụ xem Tooltip khi di chuột qua cột */}
                            <Tooltip
                                formatter={(value: any) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)}
                                labelFormatter={(label) => `Ngày ${moment(label, 'YYYY-MM-DD').format('DD/MM/YYYY')}`}
                            />
                            
                            {/* Chú thích chú giải */}
                            <Legend />
                            
                            {/* Cột dữ liệu Doanh thu (Màu xanh lá `#3f8600`) */}
                            <Bar dataKey="collected" name="Doanh thu" fill="#3f8600" />
                        </BarChart> 
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default StatisticsPage;
