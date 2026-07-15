// src/services/invoiceService.ts
// Service này quản lý các tác vụ kế toán, thống kê doanh thu và dữ liệu biểu đồ từ hóa đơn (invoice) và thanh toán (payment)
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import moment from 'moment';

// Interface đại diện cho dữ liệu thống kê kế toán tổng quan
export interface AccountingStatistics {
    totalInvoices: number;   // Tổng số lượng hóa đơn trong hệ thống
    totalPaid: number;       // Số lượng hóa đơn đã thanh toán đầy đủ
    totalPartial: number;    // Số lượng hóa đơn mới thanh toán một phần
    totalUnpaid: number;     // Số lượng hóa đơn chưa thanh toán đồng nào
    totalCollected: number;  // Tổng số tiền thực tế đã thu (tổng các khoản thanh toán)
    totalDebt: number;       // Tổng số tiền nợ còn lại (RemainingAmount của các hóa đơn)
}

// Interface đại diện cho cấu trúc điểm dữ liệu biểu đồ doanh thu theo ngày
export interface DailyChartData {
    date: string;            // Ngày định dạng YYYY-MM-DD
    collected: number;       // Tổng số tiền lũy kế thu được tính đến ngày này
}

export const invoiceService = {
    /**
     * Hàm lấy và tính toán số liệu thống kê kế toán tổng hợp từ Firestore (Tối ưu hóa vòng lặp O(N))
     * @returns Đối tượng chứa các chỉ số thống kê AccountingStatistics
     */
    getAccountingStatistics: async (): Promise<AccountingStatistics> => {
        // Tải đồng thời tất cả tài liệu trong collection 'invoice' và 'payment' để tối ưu hóa thời gian chờ mạng
        const [invoiceSnap, paymentSnap] = await Promise.all([
            getDocs(collection(db, "invoice")),
            getDocs(collection(db, "payment"))
        ]);

        const invoices = invoiceSnap.docs.map(doc => doc.data());
        const payments = paymentSnap.docs.map(doc => doc.data());

        // 1. Tính tổng số tiền thực tế đã thu bằng cách cộng dồn tất cả các khoản thanh toán thực tế
        let totalCollected = 0;
        payments.forEach(p => {
            totalCollected += p.Amount || 0;
        });

        let totalDebt = 0;
        let paid = 0;
        let partial = 0;
        let unpaid = 0;

        // 2. Lặp qua danh sách hóa đơn để đếm trạng thái và cộng dồn số nợ còn lại
        invoices.forEach(inv => {
            totalDebt += inv.RemainingAmount || 0; // Cộng dồn số tiền nợ còn lại của khách hàng
            const status = inv.PaymentStatus;
            if (status === "Đã thanh toán") paid++;
            else if (status === "Thanh toán một phần") partial++;
            else if (status === "Chưa thanh toán") unpaid++;
        });

        return {
            totalInvoices: invoices.length,
            totalPaid: paid,
            totalPartial: partial,
            totalUnpaid: unpaid,
            totalCollected,
            totalDebt
        };
    },

    /**
     * Hàm lấy các giao dịch thanh toán và tính toán biểu đồ doanh thu cộng dồn cho tháng hiện tại (từ ngày 1 đến hôm nay)
     * @returns Mảng chứa dữ liệu DailyChartData để vẽ biểu đồ đường hoặc cột lũy kế
     */
    getMonthlyChartData: async (): Promise<DailyChartData[]> => {
        // Lấy tất cả các giao dịch thanh toán từ Firestore
        const paymentSnap = await getDocs(collection(db, "payment"));
        const payments = paymentSnap.docs.map(doc => doc.data());

        const currentMonth = moment();
        const startOfMonth = currentMonth.clone().startOf('month');

        // 1. Khởi tạo cấu trúc lưu trữ dữ liệu rỗng cho từng ngày của tháng hiện tại tính tới ngày hôm nay
        const dailyStats: { [key: string]: { date: string; collected: number } } = {};
        for (let d = startOfMonth.clone(); d.isSameOrBefore(currentMonth, 'day'); d.add(1, 'day')) {
            const key = d.format('YYYY-MM-DD');
            dailyStats[key] = { date: key, collected: 0 };
        }

        // 2. Lọc các giao dịch thanh toán thuộc tháng hiện tại và cộng dồn vào ngày tương ứng
        payments.forEach(p => {
            let pDate;
            if (p.PaymentDate?.toDate) {
                pDate = p.PaymentDate.toDate(); // Chuyển đổi từ Firebase Timestamp
            } else if (typeof p.PaymentDate === 'string') {
                pDate = new Date(p.PaymentDate);
            } else {
                pDate = new Date();
            }
            
            const mDate = moment(pDate);
            // Kiểm tra xem giao dịch có nằm trong tháng và năm hiện hành hay không
            if (mDate.isSame(currentMonth, 'month') && mDate.isSame(currentMonth, 'year')) {
                const key = mDate.format('YYYY-MM-DD');
                if (dailyStats[key]) {
                    dailyStats[key].collected += (p.Amount || 0);
                }
            }
        });

        // 3. Chuyển đổi đối tượng sang mảng và sắp xếp tăng dần theo thời gian
        const chartArray = Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date));

        // 4. Tính toán doanh thu lũy kế (Running Total) - Tiền ngày hôm sau bằng tổng ngày hôm đó cộng ngày hôm trước
        let runningCollected = 0;
        return chartArray.map(item => {
            runningCollected += item.collected;
            return {
                date: item.date,
                collected: runningCollected
            };
        });
    }
};

