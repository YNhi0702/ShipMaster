import React, { useRef } from 'react';
import { Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface InvoiceItem {
    description: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    amount: number;
}

interface InvoiceProps {
    shipName: string;
    workshopName: string;
    workshopAddress?: string;
    workshopPhone?: string;
    workshopEmail?: string;
    createdAt: string;
    materialsCost: number;
    laborCost: number;
    totalCost: number;
    customerName?: string;
    customerAddress?: string;
    customerPhone?: string;
    items?: InvoiceItem[];
    invoiceId?: string;
}

const formatMoney = (value: number) =>
    value?.toLocaleString('vi-VN', { style: 'decimal', maximumFractionDigits: 0 });

// Hàm đọc số tiền thành chữ (cơ bản)
const readNumberToVietnamese = (number: number): string => {
    if (number === 0) return 'Không đồng';
    // Đây là hàm placeholder đơn giản. 
    // Trong thực tế nên dùng thư viện hoặc hàm đầy đủ hơn để đọc số tiền lớn.
    // Vì không được dùng thư viện ngoài nếu chưa cài, ta sẽ dùng format string đơn giản
    // hoặc bạn có thể yêu cầu cài thêm thư viện 'n2vi'.
    // Ở đây mình sẽ trả về text đơn giản kèm số để tránh sai sót logic phức tạp.
    return `${number.toLocaleString('vi-VN')} đồng`; 
};

// Hàm đọc số đầy đủ hơn (nếu cần thiết, code chay sẽ khá dài)
// Để đơn giản và chính xác, tạm thời hiển thị số + " đồng"
// Nếu user cần chính xác "Năm trăm nghìn...", ta có thể bổ sung sau.

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
    const invoiceRef = useRef<HTMLDivElement>(null);

    // Chuẩn bị dữ liệu hiển thị trong bảng
    const displayItems: InvoiceItem[] = items.length > 0 ? [...items] : [
        {
            description: 'Chi phí vật tư, phụ tùng',
            unit: 'Gói',
            quantity: 1,
            unitPrice: materialsCost,
            amount: materialsCost
        }
    ];

    // Luôn thêm dòng nhân công nếu có và chưa có trong items
    // (Giả sử items chỉ là materials)
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

    const handleDownloadPDF = async () => {
        if (!invoiceRef.current) return;

        try {
            const element = invoiceRef.current;
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true, // Hỗ trợ tải ảnh từ nguồn khác nếu có
                backgroundColor: '#ffffff', // Đảm bảo nền trắng khi xuất PDF
            });
            const imgData = canvas.toDataURL('image/png');
            
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
            const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm

            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = imgWidth / imgHeight;

            let pdfWidth = pageWidth;
            let pdfHeight = pdfWidth / ratio;

            // Nếu ảnh dài hơn trang A4, co lại cho vừa chiều cao (scale to fit)
            if (pdfHeight > pageHeight) {
                pdfHeight = pageHeight;
                pdfWidth = pdfHeight * ratio;
            }

            const x = (pageWidth - pdfWidth) / 2; // Căn giữa theo chiều ngang nếu bị co lại

            pdf.addImage(imgData, 'PNG', x, 0, pdfWidth, pdfHeight);
            pdf.save(`HoaDon_${invoiceId}.pdf`);
        } catch (error) {
            console.error('Lỗi xuất PDF:', error);
        }
    };

    // Style giống mẫu
    const borderColor = 'border-blue-600';
    const textColor = 'text-blue-900';

    return (
        <div className="space-y-4 pt-6">
            <div className="flex justify-end pr-12">
                <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    onClick={handleDownloadPDF}
                >
                    Tải hóa đơn PDF
                </Button>
            </div>

            <div ref={invoiceRef} className="bg-white p-8 pb-20 max-w-[210mm] mx-auto text-sm font-serif text-black relative">
                
                {/* Header: Logo và Tiêu đề */}
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center">
                        {/* Logo giả lập - Fix lệch chữ khi xuất PDF */}
                        <div className="w-16 h-16 bg-blue-800 text-white flex items-center justify-center rounded-full mr-3 shrink-0">
                            <span className="font-bold text-xl leading-none pt-1">SM</span>
                        </div>
                        <div>
                            <h1 className={`text-2xl font-bold ${textColor} uppercase`}>Ship Master</h1>
                            <p className="text-xs">Giải pháp quản lý và sửa chữa tàu thủy</p>
                            <p className="text-xs">Email: contact@shipmaster.vn</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <h2 className={`text-xl font-bold ${textColor} uppercase`}>Hóa đơn giá trị gia tăng</h2>
                        <h3 className={`text-lg font-bold ${textColor} uppercase mt-1`}>Dịch vụ sửa chữa tàu</h3>
                        <p className="italic mt-1">Ngày {new Date(createdAt || Date.now()).getDate()} tháng {new Date(createdAt || Date.now()).getMonth() + 1} năm {new Date(createdAt || Date.now()).getFullYear()}</p>
                    </div>
                </div>

                {/* Phần thông tin Người bán / Người mua - Khung xanh bo góc */}
                <div className={`border-2 ${borderColor} rounded-md mb-4`}>
                    
                    {/* Seller */}
                    <div className="p-2 border-b border-blue-300">
                        <div className="grid grid-cols-[160px_1fr] gap-2">
                            <span className={`font-bold ${textColor}`}>Đơn vị cung cấp dịch vụ:</span>
                            <span className="font-bold uppercase text-blue-800">Công ty TNHH Hưng Phong</span>

                            {/** Ẩn Mã số thuế nếu chưa có data thật
                            <span className={`font-bold ${textColor}`}>Mã số thuế:</span>
                            <span>0312345678 (Mẫu)</span>
                             */}

                            <span className={`font-bold ${textColor}`}>Địa chỉ:</span>
                            <span>Hải Phòng</span>

                            <span className={`font-bold ${textColor}`}>Email:</span>
                            <span>contact@shipmaster.vn</span>

                            <span className={`font-bold ${textColor}`}>Số tài khoản:</span>
                            <span className="font-bold">xxxx xxxx xxxx - Ngân hàng XXX</span>
                        </div>
                    </div>

                    {/* Buyer */}
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

                {/* Bảng chi tiết */}
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
                        
                        {/* Dòng trống để lấp đầy bảng cho đẹp giống mẫu nếu ít item */}
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
                            <td colSpan={5} className={`border ${borderColor} p-2 text-right font-bold ${textColor}`}>Cộng tiền hàng (Sub total):</td>
                            <td className={`border ${borderColor} p-2 text-right font-bold`}>{formatMoney(totalCost)}</td>
                        </tr>
                        <tr>
                            <td colSpan={5} className={`border ${borderColor} p-2 text-right font-bold ${textColor}`}>Thuế suất GTGT (VAT rate): 10%</td>
                            <td className={`border ${borderColor} p-2 text-right font-bold`}>{formatMoney(totalCost * 0.1)}</td>
                        </tr>
                        <tr>
                            <td colSpan={5} className={`border ${borderColor} p-2 text-right font-bold ${textColor}`}>Tổng cộng tiền thanh toán (Total payment):</td>
                            <td className={`border ${borderColor} p-2 text-right font-bold text-red-600 text-lg`}>{formatMoney(totalCost * 1.1)}</td>
                        </tr>
                    </tfoot>
                </table>

                {/* Bằng chữ */}
                <div className={`border-b-2 ${borderColor} pb-2 mb-6`}>
                    <span className="font-bold italic">Số tiền viết bằng chữ (Amount in words): </span>
                    <span className="italic">{readNumberToVietnamese(Math.round(totalCost * 1.1))} (đã bao gồm VAT)</span>
                </div>

                {/* Chữ ký */}
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
