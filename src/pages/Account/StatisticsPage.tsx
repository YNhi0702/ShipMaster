import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Typography, message, Spin } from 'antd';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import moment from 'moment';
import 'moment/locale/vi';

const { Title } = Typography;

const StatisticsPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    moment.locale('vi');

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

            // =============================
            // 1. LẤY DANH SÁCH HÓA ĐƠN VÀ PAYMENT
            // =============================
            const invoiceSnap = await getDocs(collection(db, "invoice"));
            const invoices = invoiceSnap.docs.map(doc => doc.data());

            const paymentSnap = await getDocs(collection(db, "payment"));
            const payments = paymentSnap.docs.map(doc => doc.data());

            // =============================
            // 2. TÍNH TOÁN THỐNG KÊ TỔNG QUÁT
            // =============================
            let totalCollected = 0;
            payments.forEach(p => {
                totalCollected += p.Amount || 0;
            });

            let totalDebt = 0;
            invoices.forEach(inv => {
                totalDebt += inv.RemainingAmount || 0;
            });

            let paid = 0;
            let partial = 0;
            let unpaid = 0;

            invoices.forEach(inv => {
                const status = inv.PaymentStatus;
                if (status === "Đã thanh toán") paid++;
                else if (status === "Thanh toán một phần") partial++;
                else if (status === "Chưa thanh toán") unpaid++;
            });

            setStatistics({
                totalInvoices: invoices.length,
                totalPaid: paid,
                totalPartial: partial,
                totalUnpaid: unpaid,
                totalCollected,
                totalDebt,
            });

            // =============================
            // 3. XỬ LÝ DỮ LIỆU BIỂU ĐỒ (THEO NGÀY TRONG THÁNG HIỆN TẠI)
            // =============================
            
            const currentMonth = moment();
            const startOfMonth = currentMonth.clone().startOf('month');
            const endOfMonth = currentMonth.clone().endOf('month');

            // Khởi tạo khung dữ liệu cho tất cả các ngày trong tháng (chỉ đến hiện tại)
            const dailyStats: { [key: string]: { date: string; collected: number; invoiced: number } } = {};
            // Thay vì loop đến endOfMonth, ta chỉ loop đến currentMonth (hôm nay)
            for (let d = startOfMonth.clone(); d.isSameOrBefore(currentMonth, 'day'); d.add(1, 'day')) {
                const key = d.format('YYYY-MM-DD');
                dailyStats[key] = { date: key, collected: 0, invoiced: 0 };
            }

            // Tính tiền đã thu (chỉ trong tháng hiện tại) - DOANH THU
            payments.forEach(p => {
                let pDate;
                if (p.PaymentDate?.toDate) {
                    pDate = p.PaymentDate.toDate();
                } else if (typeof p.PaymentDate === 'string') {
                    pDate = new Date(p.PaymentDate);
                } else {
                    pDate = new Date(); 
                }
                
                const mDate = moment(pDate);
                if (mDate.isSame(currentMonth, 'month') && mDate.isSame(currentMonth, 'year')) {
                    const key = mDate.format('YYYY-MM-DD');
                    if (dailyStats[key]) {
                        dailyStats[key].collected += (p.Amount || 0);
                    }
                }
            });

            // Tính tổng tiền hóa đơn phát sinh (chỉ trong tháng hiện tại) - ĐỂ TÍNH CÔNG NỢ
            invoices.forEach(inv => {
                let iDate;
                if (inv.CreatedAt?.toDate) {
                    iDate = inv.CreatedAt.toDate();
                } else if (typeof inv.CreatedAt === 'string') {
                    iDate = new Date(inv.CreatedAt);
                } else {
                    iDate = new Date();
                }
                
                const mDate = moment(iDate);
                if (mDate.isSame(currentMonth, 'month') && mDate.isSame(currentMonth, 'year')) {
                    const key = mDate.format('YYYY-MM-DD');
                     if (dailyStats[key]) {
                         // Dùng TotalAmount nếu có, nếu không thì fallback (cần đảm bảo đúng field)
                        dailyStats[key].invoiced += (inv.TotalAmount || inv.totalAmount || 0);
                    }
                }
            });

            // Convert object to array và sort theo ngày
            const chartArray = Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date));

            // Cập nhật: Tính lũy kế (Cumulative) từ đầu tháng
            // Logic: 
            // - Doanh thu lũy kế = Cộng dồn tiền đã thu (collected)
            // - Công nợ lũy kế = (Cộng dồn hóa đơn phát sinh - Cộng dồn tiền đã thu) -> hay chính là outstanding balance của tháng
            //   (Giả sử đầu tháng = 0 cho phạm vi biểu đồ này, hoặc chỉ tính phát sinh trong tháng)

            let runningCollected = 0;
            let runningInvoiced = 0;

            const cumulativeChartData = chartArray.map(item => {
                runningCollected += item.collected;
                runningInvoiced += item.invoiced;
                
                // Công nợ = Tổng hóa đơn - Tổng đã trả (trong phạm vi tháng này)
                const currentDebt = runningInvoiced - runningCollected;

                return {
                    ...item,
                    collected: runningCollected, 
                    debt: currentDebt > 0 ? currentDebt : 0, // Nếu trả dư (âm) thì hiển thị 0 hoặc để nguyên tùy logic (để 0 cho đẹp)
                };
            });

            setChartData(cumulativeChartData);

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
