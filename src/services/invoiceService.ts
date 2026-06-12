// src/services/invoiceService.ts
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import moment from 'moment';

export interface AccountingStatistics {
    totalInvoices: number;
    totalPaid: number;
    totalPartial: number;
    totalUnpaid: number;
    totalCollected: number;
    totalDebt: number;
}

export interface DailyChartData {
    date: string;
    collected: number;
}

export const invoiceService = {
    /**
     * Fetches invoice and payment data and computes aggregate statistics (Optimized O(N) iteration)
     */
    getAccountingStatistics: async (): Promise<AccountingStatistics> => {
        const [invoiceSnap, paymentSnap] = await Promise.all([
            getDocs(collection(db, "invoice")),
            getDocs(collection(db, "payment"))
        ]);

        const invoices = invoiceSnap.docs.map(doc => doc.data());
        const payments = paymentSnap.docs.map(doc => doc.data());

        let totalCollected = 0;
        payments.forEach(p => {
            totalCollected += p.Amount || 0;
        });

        let totalDebt = 0;
        let paid = 0;
        let partial = 0;
        let unpaid = 0;

        invoices.forEach(inv => {
            totalDebt += inv.RemainingAmount || 0;
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
     * Fetches payments and computes cumulative chart data for the current month up to today
     */
    getMonthlyChartData: async (): Promise<DailyChartData[]> => {
        const paymentSnap = await getDocs(collection(db, "payment"));
        const payments = paymentSnap.docs.map(doc => doc.data());

        const currentMonth = moment();
        const startOfMonth = currentMonth.clone().startOf('month');

        // Initialize empty statistics container for each day of current month up to today
        const dailyStats: { [key: string]: { date: string; collected: number } } = {};
        for (let d = startOfMonth.clone(); d.isSameOrBefore(currentMonth, 'day'); d.add(1, 'day')) {
            const key = d.format('YYYY-MM-DD');
            dailyStats[key] = { date: key, collected: 0 };
        }

        // Sum payment amounts for the current month
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

        // Convert object to sorted array
        const chartArray = Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date));

        // Compute cumulative (running) total
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
