// src/components/Customer/Invoice.tsx
// Component hiển thị giao diện Hóa đơn sửa chữa chi tiết của khách hàng.
// Hỗ trợ tính năng kết xuất (export) trang hóa đơn HTML thành file tài liệu PDF chuẩn khổ giấy A4 nhờ thư viện html2canvas và jsPDF.
import React, { useRef } from 'react';
import { Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import moment from 'moment';

// Interface mô tả cấu trúc của một dòng vật tư/dịch vụ hiển thị trong hóa đơn
interface InvoiceItem {
    description: string; // Tên vật tư hoặc dịch vụ (ví dụ: Chi phí vật tư, Phí nhân công)
    unit: string;        // Đơn vị tính (ví dụ: Gói, Công, Chiếc, v.v.)
    quantity: number;    // Số lượng
    unitPrice: number;   // Đơn giá
    amount: number;      // Thành tiền
}

// Interface định nghĩa các Props truyền vào Component hóa đơn
interface InvoiceProps {
    shipName: string;            // Tên tàu được sửa chữa
    workshopName: string;        // Tên xưởng sửa chữa
    workshopAddress?: string;    // Địa chỉ xưởng
    workshopPhone?: string;      // Số điện thoại xưởng
    workshopEmail?: string;      // Email xưởng
    createdAt: string;           // Ngày tạo hóa đơn
    materialsCost: number;       // Tổng chi phí vật tư
    laborCost: number;           // Tổng chi phí nhân công thợ
    totalCost: number;           // Tổng chi phí thanh toán sau cùng
    customerName?: string;       // Họ tên khách hàng chủ tàu
    customerAddress?: string;    // Địa chỉ khách hàng
    customerPhone?: string;      // Số điện thoại khách hàng
    items?: InvoiceItem[];       // Mảng chứa các chi tiết vật tư, dịch vụ (nếu truyền vào)
    invoiceId?: string;          // Số hóa đơn (mã hóa đơn)
}

// Hàm định dạng số tiền thành chuỗi VNĐ dễ đọc (ví dụ: 1.000.000)
const formatMoney = (value: number) =>
    value?.toLocaleString('vi-VN', { style: 'decimal', maximumFractionDigits: 0 });

/**
 * Hàm đọc số tiền dạng số thành chuỗi chữ tiếng Việt
 * @param number Số tiền cần đọc
 * @returns Chuỗi đọc tiền tiếng Việt (ví dụ: 1.000.000 -> "1.000.000 đồng")
 */
const readNumberToVietnamese = (number: number): string => {
    if (number === 0) return 'Không đồng';
    return `${number.toLocaleString('vi-VN')} đồng`; 
};

const Invoice: React.FC<InvoiceProps> = ({
    shipName,
    workshopName,
    workshopAddress = 'Chưa cập nhật',
    workshopPhone = '',
    workshopEmail = '',
    createdAt,
    materialsCost,
    laborCost,
    totalCost,
    customerName = 'Khách lẻ',
    customerAddress = '',
    customerPhone = '',
    items = [],
    invoiceId = 'HD001'
}) => {
    const invoiceRef = useRef<HTMLDivElement>(null); // Ref tham chiếu tới thẻ div bao bọc hóa đơn để chụp canvas

    // 1. Chuẩn hóa ngày tạo hóa đơn bằng thư viện moment
    const invoiceDate = React.useMemo(() => {
        if (!createdAt) return moment();
        const m = moment(createdAt, ['DD/MM/YYYY', 'YYYY-MM-DD', moment.ISO_8601]);
        return m.isValid() ? m : moment();
    }, [createdAt]);

    // 2. Gom và chuẩn bị dữ liệu các dòng vật tư và nhân công để render lên bảng hóa đơn
    const displayItems: InvoiceItem[] = items.length > 0 ? [...items] : [
        {
            description: 'Chi phí vật tư, phụ tùng',
            unit: 'Gói',
            quantity: 1,
            unitPrice: materialsCost,
            amount: materialsCost
        }
    ];

    const hasLabor = displayItems.find(i => i.description.includes('nhân công'));
    if (!hasLabor && laborCost > 0) {
        displayItems.push({
            description: 'Phí nhân công sửa chữa',
            unit: 'Công',
            quantity: 1,
            unitPrice: laborCost,
            amount: laborCost
        });
    }

    // 3. Giải thuật xuất trang hóa đơn sang file PDF chuẩn khổ giấy A4
    const handleDownloadPDF = async () => {
        if (!invoiceRef.current) return;

        try {
            const element = invoiceRef.current;
            // Tiến hành chụp màn hình (canvas) vùng div chứa hóa đơn, nâng scale lên 2 để ảnh nét hơn khi in PDF
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true, 
                backgroundColor: '#ffffff', // Ép nền trắng
                height: element.scrollHeight, 
                windowHeight: element.scrollHeight
            } as any);
            const imgData = canvas.toDataURL('image/png');
            
            // Khởi tạo đối tượng jsPDF khổ dọc (p), đơn vị mm, cỡ giấy a4 (210mm x 297mm)
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth(); 
            const pageHeight = pdf.internal.pageSize.getHeight(); 

            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = imgWidth / imgHeight; // Tỷ lệ chiều rộng / chiều cao của ảnh canvas chụp được

            let pdfWidth = pageWidth;
            let pdfHeight = pdfWidth / ratio; // Tính chiều cao ảnh tương ứng trên bản PDF

            // Nếu chiều cao ảnh vượt quá kích thước 1 trang A4, tự động co ảnh lại để hóa đơn nằm trọn trong đúng 1 trang PDF
            if (pdfHeight > pageHeight) {
                pdfHeight = pageHeight;
                pdfWidth = pdfHeight * ratio;
            }

            // Tính toán vị trí căn lề giữa (center) chiều ngang trang giấy
            const x = (pageWidth - pdfWidth) / 2; 

            // Chèn ảnh canvas vào tài liệu PDF và tiến hành tải xuống máy người dùng
            pdf.addImage(imgData, 'PNG', x, 0, pdfWidth, pdfHeight);
            pdf.save(`HoaDon_${invoiceId}.pdf`);
        } catch (error) {
            console.error('Lỗi xuất PDF:', error);
        }
    };

    const borderColor = 'border-blue-600';
    const textColor = 'text-blue-900';

    return (
        <div className="space-y-4 pt-6">
            {/* Nút bấm để tải hóa đơn dạng file PDF */}
            <div className="flex justify-end pr-12">
                <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    onClick={handleDownloadPDF}
                >
                    Tải hóa đơn PDF
                </Button>
            </div>

            {/* Vùng div chứa nội dung hóa đơn thực tế để hiển thị và xuất PDF */}
            <div ref={invoiceRef} className="bg-white p-8 pb-20 max-w-[210mm] mx-auto text-sm font-serif text-black relative">
                
                {/* Tiêu đề & Logo công ty */}
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center">
                        <div className="w-16 h-16 bg-blue-800 text-white flex items-center justify-center rounded-full mr-3 shrink-0">
                            <span className="font-bold text-xl leading-none pt-1">SM</span>
                        </div>
                        <div>
                            <h1 className={`text-2xl font-bold ${textColor} uppercase`}>Ship Master</h1>
                            <p className="text-xs">Giải pháp quản lý và sửa chữa tàu thủy</p>
                            <p className="text-xs">Email: shipmaster@gmail.com</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <h2 className={`text-xl font-bold ${textColor} uppercase`}>Hóa đơn sửa chữa tàu</h2>
                        <p className="italic mt-1">Ngày {invoiceDate.date()} tháng {invoiceDate.month() + 1} năm {invoiceDate.year()}</p>
                    </div>
                </div>

                {/* Khung chứa thông tin Chi tiết Người cung cấp và Khách hàng chủ tàu */}
                <div className={`border-2 ${borderColor} rounded-md mb-4`}>
                    
                    {/* Thông tin bên cung cấp dịch vụ */}
                    <div className="p-2 border-b border-blue-300">
                        <div className="grid grid-cols-[160px_1fr] gap-2">
                            <span className={`font-bold ${textColor}`}>Đơn vị cung cấp dịch vụ:</span>
                            <span className="font-bold uppercase text-blue-800">Công ty TNHH Hưng Phong</span>

                            <span className={`font-bold ${textColor}`}>Địa chỉ:</span>
                            <span>Hải Phòng</span>

                            <span className={`font-bold ${textColor}`}>Email:</span>
                            <span>shipmaster@gmail.com</span>

                            <span className={`font-bold ${textColor}`}>Số tài khoản:</span>
                            <span className="font-bold">xxxx xxxx xxxx - Ngân hàng XXX</span>
                        </div>
                    </div>

                    {/* Thông tin bên Khách hàng */}
                    <div className="p-2 bg-blue-50/50">
                        <div className="grid grid-cols-[160px_1fr] gap-2">
                            <span className={`font-bold ${textColor}`}>Khách hàng:</span>
                            <span className="font-bold uppercase">{customerName}</span>

                            <span className={`font-bold ${textColor}`}>Tên tàu:</span>
                            <span>{shipName}</span>
                            
                            <span className={`font-bold ${textColor}`}>Điện thoại:</span>
                            <span>{customerPhone}</span>

                            <span className={`font-bold ${textColor}`}>Hình thức TT:</span>
                            <span>Tiền mặt/Chuyển khoản</span>
                        </div>
                    </div>
                </div>

                {/* Bảng chi tiết hóa đơn */}
                <table className={`w-full border-collapse border ${borderColor} mb-4`}>
                    <thead>
                        <tr className="bg-blue-100 text-center font-bold text-blue-900">
                            <th className={`border ${borderColor} p-2 w-12`}>STT<br/><i>(No.)</i></th>
                            <th className={`border ${borderColor} p-2`}>Tên hàng hóa, dịch vụ<br/><i>(Description)</i></th>
                            <th className={`border ${borderColor} p-2 w-20`}>ĐVT<br/><i>(Unit)</i></th>
                            <th className={`border ${borderColor} p-2 w-20`}>SL<br/><i>(Qty)</i></th>
                            <th className={`border ${borderColor} p-2 w-32`}>Đơn giá<br/><i>(Price)</i></th>
                            <th className={`border ${borderColor} p-2 w-36`}>Thành tiền<br/><i>(Amount)</i></th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayItems.map((item, index) => (
                            <tr key={index}>
                                <td className={`border ${borderColor} p-2 text-center`}>{index + 1}</td>
                                <td className={`border ${borderColor} p-2`}>{item.description}</td>
                                <td className={`border ${borderColor} p-2 text-center`}>{item.unit}</td>
                                <td className={`border ${borderColor} p-2 text-center`}>{item.quantity}</td>
                                <td className={`border ${borderColor} p-2 text-right`}>{formatMoney(item.unitPrice)}</td>
                                <td className={`border ${borderColor} p-2 text-right font-medium`}>{formatMoney(item.amount)}</td>
                            </tr>
                        ))}
                        
                        {/* Tạo các dòng trống giả để lấp đầy bảng hóa đơn, giúp khung hóa đơn luôn đẹp đẽ cân đối khi in ấn */}
                        {Array.from({ length: Math.max(0, 5 - displayItems.length) }).map((_, i) => (
                            <tr key={`empty-${i}`}>
                                <td className={`border ${borderColor} p-2 h-8`}></td>
                                <td className={`border ${borderColor} p-2`}></td>
                                <td className={`border ${borderColor} p-2`}></td>
                                <td className={`border ${borderColor} p-2`}></td>
                                <td className={`border ${borderColor} p-2`}></td>
                                <td className={`border ${borderColor} p-2`}></td>
                            </tr>
                        ))}

                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={5} className={`border ${borderColor} p-2 text-right font-bold ${textColor}`}>Tổng cộng tiền thanh toán (Total payment):</td>
                            <td className={`border ${borderColor} p-2 text-right font-bold text-red-600 text-lg`}>{formatMoney(totalCost)}</td>
                        </tr>
                    </tfoot>
                </table>

                {/* Đọc tổng tiền thành chữ tiếng Việt */}
                <div className={`border-b-2 ${borderColor} pb-2 mb-6`}>
                    <span className="font-bold italic">Số tiền viết bằng chữ (Amount in words): </span>
                    <span className="italic">{readNumberToVietnamese(Math.round(totalCost))}</span>
                </div>

                {/* Khu vực ký tên xác nhận của Khách hàng và Đại diện công ty */}
                <div className="flex justify-between px-10 mb-10">
                    <div className="text-center">
                        <p className={`font-bold ${textColor} uppercase`}>Khách hàng</p>
                        <p className="italic text-xs">(Ký, ghi rõ họ tên)</p>
                        <div className="mt-16 font-bold">{customerName}</div>
                    </div>
                    <div className="text-center">
                        <p className={`font-bold ${textColor} uppercase`}>Đơn vị cung cấp dịch vụ</p>
                        <p className="italic text-xs">(Ký, đóng dấu, ghi rõ họ tên)</p>
                        <div className="mt-24 font-bold uppercase text-blue-800">Công ty TNHH Hưng Phong</div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Invoice;
