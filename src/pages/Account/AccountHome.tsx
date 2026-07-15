import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Table, Typography, message, Input, Modal, Spin, Card, InputNumber } from 'antd';
import { addDoc, collection, getDocs, doc, getDoc, query, where, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const { Title } = Typography;

// Bảng giá nhân công cơ bản theo chuyên môn kỹ thuật của thợ sửa chữa tàu
const EXPERTISE_RATES: { [key: string]: number } = {
    'Thợ hàn / cơ khí vỏ tàu': 600000, 
    'Thợ máy tàu': 800000,             
    'Thợ điện tàu': 650000,            // Đơn giá ngày công cơ bản cho thợ điện
    'Thợ sơn / vệ sinh tàu': 450000,   // Đơn giá ngày công cơ bản cho thợ sơn
};

/**
 * Hàm tính toán đơn giá ngày công thực tế dựa trên chuyên môn và bậc tay nghề (Ví dụ: "Thợ máy tàu - Bậc 3")
 * @param expertise Chuỗi chuyên môn của nhân công
 * @returns Đơn giá ngày công tương ứng đã nhân hệ số bậc thợ
 */
const getExpertiseRate = (expertise: string): number => {
    if (!expertise) return 350000; // Trả về đơn giá mặc định nếu không có thông tin chuyên môn
    const normalized = expertise.trim().toLowerCase();
    
    // Tách chuỗi chuyên môn và bậc tay nghề dựa trên dấu gạch ngang " - "
    const parts = normalized.split(' - ');
    const baseExp = parts[0] ? parts[0].trim() : '';  // Tên chuyên môn (VD: thợ máy tàu)
    const levelStr = parts[1] ? parts[1].trim() : ''; // Bậc thợ (VD: bậc 1, bậc 3)

    let baseRate = 350000; // Đơn giá mặc định dự phòng
    for (const [key, rate] of Object.entries(EXPERTISE_RATES)) {
        if (key.toLowerCase() === baseExp) {
            baseRate = rate; // Tìm đơn giá khớp với chuyên môn cơ bản
            break;
        }
    }

    // Áp dụng hệ số bậc thợ
    if (levelStr === 'bậc 1') {
        return baseRate * 0.8;      // Thợ bậc 1 (mới vào nghề): hưởng 80% lương cơ bản
    } else if (levelStr === 'bậc 3') {
        return baseRate * 1.25;     // Thợ bậc 3 (lành nghề): hưởng 125% lương cơ bản
    }
    return baseRate; // Mặc định bậc 2 hưởng 100% lương cơ bản
};

// Đơn giá nhân công mặc định dự phòng
const DEFAULT_LABOR_RATE = 350000;

/**
 * Hàm chuyển đổi an toàn các giá trị tiền tệ hoặc số lượng từ kiểu dữ liệu bất kỳ sang kiểu Number
 */
const parseAmount = (value: any, fallback = 0): number => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value; // Nếu đã là số hợp lệ thì trả về luôn
    }

    if (typeof value === 'string') {
        // Loại bỏ toàn bộ ký tự không phải số, dấu phẩy, dấu chấm, dấu trừ
        const normalized = value.replace(/[^0-9,.-]/g, '').replace(/,/g, '.');
        const numeric = Number(normalized);
        if (!Number.isNaN(numeric)) {
            return numeric;
        }

        // Dự phòng lấy các chữ số nguyên
        const digitsOnly = value.replace(/[^0-9-]/g, '');
        const fallbackNumber = Number(digitsOnly);
        if (!Number.isNaN(fallbackNumber)) {
            return fallbackNumber;
        }
    }

    return fallback; // Trả về giá trị mặc định dự phòng
};

/**
 * Hàm định dạng hiển thị các giá trị chi tiết thuộc tính sang chuỗi văn bản
 */
const formatDetailValue = (value: any): string => {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'string') {
        // Nếu đã là chuỗi thì trả về chuỗi đó
        return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return value.toString();
    }
    if (value instanceof Date) {
        return isNaN(value.getTime()) ? '' : value.toLocaleString('vi-VN');
    }
    if (value?.toDate && typeof value.toDate === 'function') {
        // Chuyển đổi kiểu Timestamp của Firestore sang Date của JS
        const dateVal = value.toDate();
        return !dateVal || isNaN(dateVal.getTime()) ? '' : dateVal.toLocaleString('vi-VN');
    }
    try {
        return JSON.stringify(value, null, 2);
    } catch (error) {
        return String(value);
    }
};

// Hàm lấy số an toàn, tránh lỗi NaN
const safeNumber = (value: any, fallback = 0): number => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    return fallback;
};

/**
 * Trích xuất mã khách hàng một cách thống nhất từ tài liệu đơn sửa chữa
 */
const resolveOrderCustomerId = (orderData: Record<string, any> | null | undefined, fallback?: any): string => {
    // Thống nhất quy chuẩn đặt tên: Khách hàng được định danh bằng trường 'uid'
    const resolved = orderData?.uid || orderData?.customerId || fallback?.uid || fallback?.customerId || '';
    return typeof resolved === 'string' ? resolved.trim() : '';
};

const AccountHome: React.FC = () => {
    const [invoices, setInvoices] = useState<any[]>([]); // Danh sách các hóa đơn chờ xử lý
    const [loadingInvoices, setLoadingInvoices] = useState<boolean>(true); // Trạng thái tải danh sách hóa đơn
    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false); // Trạng thái mở/đóng Modal tạo hóa đơn
    const [modalLoading, setModalLoading] = useState(false); // Trạng thái tải dữ liệu chi tiết trong Modal
    const [selectedOrder, setSelectedOrder] = useState<any | null>(null); // Đơn sửa chữa đang được chọn để lập hóa đơn
    const [materialLines, setMaterialLines] = useState<any[]>([]); // Danh sách dòng vật tư của đơn hàng
    const [laborLines, setLaborLines] = useState<any[]>([]); // Danh sách dòng nhân công của đơn hàng
    const [savingInvoice, setSavingInvoice] = useState(false); // Trạng thái đang lưu hóa đơn lên Firestore
    const selectedOrderIdRef = useRef<string | null>(null); // Dùng Ref để kiểm soát bất đồng bộ tải dữ liệu theo ID đơn hàng

    // Hàm định dạng số tiền sang chuẩn VNĐ
    const formatCurrency = (value: number) =>
        Number.isFinite(value) ? value.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' }) : '---';

    // Hàm reset lại trạng thái ban đầu của Modal tạo hóa đơn
    const resetModalState = () => {
        selectedOrderIdRef.current = null;
        setSelectedOrder(null);
        setMaterialLines([]);
        setLaborLines([]);
    };

    /**
     * Tải danh sách chi tiết vật tư và nhân công của đơn sửa chữa tương ứng
     */
    const loadOrderDetails = async (orderId: string) => {
        setModalLoading(true);
        try {
            // Hàm con hỗ trợ tải tài liệu từ collection với danh sách trường kiểm tra đa dạng
            const loadCollection = async (collectionName: string, fieldCandidates: string[]) => {
                let docs: any[] = [];
                for (const field of fieldCandidates) {
                    try {
                        const snap = await getDocs(query(collection(db, collectionName), where(field, '==', orderId)));
                        if (!snap.empty) {
                            docs = snap.docs;
                            break;
                        }
                    } catch (error) {
                        // Bỏ qua lỗi trường không tồn tại
                    }
                }

                if (!docs.length) {
                    const snapshot = await getDocs(collection(db, collectionName));
                    docs = snapshot.docs.filter((docSnap) => {
                        const data = docSnap.data() as any;
                        return fieldCandidates.some((field) => data?.[field] === orderId);
                    });
                }

                return docs;
            };

            // 1. Tải danh sách vật tư đã dùng của đơn hàng
            const materialDocs = await loadCollection('repairordermaterial', ['RepairOrder_ID', 'repairOrderId', 'orderId', 'RepairOrderId', 'RepairOrderID', 'Order_ID']);
            const materialIdSet = new Set<string>();
            materialDocs.forEach((docSnap: any) => {
                const data = docSnap.data() as any;
                const candidates = [
                    data?.Material_ID,
                    data?.materialId,
                    data?.MaterialId,
                    data?.material_id,
                    data?.Material?.id,
                ];
                candidates.forEach((val) => {
                    if (typeof val === 'string' && val.trim()) {
                        materialIdSet.add(val.trim());
                    }
                });
            });

            // Truy vấn thông tin chi tiết tên vật tư, đơn giá từ catalog 'material'
            const materialCatalog: Record<string, any> = {};
            if (materialIdSet.size > 0) {
                const materialEntries = await Promise.all(
                    Array.from(materialIdSet).map(async (materialId) => {
                        try {
                            const snap = await getDoc(doc(db, 'material', materialId));
                            if (snap.exists()) {
                                return { id: materialId, data: snap.data() };
                            }
                        } catch (error) {
                            console.warn('Failed to fetch material catalog entry', materialId, error);
                        }
                        return null;
                    })
                );
                materialEntries.forEach((entry) => {
                    if (entry) {
                        materialCatalog[entry.id] = entry.data;
                    }
                });
            }

            // Định dạng danh sách vật tư hiển thị
            const materials = materialDocs.map((docSnap: any, index: number) => {
                const data = docSnap.data() as any;
                const quantity = parseAmount(data?.QuantityUsed ?? data?.quantity ?? data?.Quantity ?? data?.qty ?? 0);
                const materialId = [
                    data?.Material_ID,
                    data?.materialId,
                    data?.MaterialId,
                    data?.material_id,
                ].find((val) => typeof val === 'string' && val.trim()) || '';

                const catalogEntry = materialId ? materialCatalog[String(materialId)] : undefined;
                const fallbackUnitPrice = parseAmount(data?.UnitPrice ?? data?.unitPrice ?? data?.Price ?? data?.price ?? catalogEntry?.Price ?? catalogEntry?.price ?? 0);
                const totalCost = parseAmount(data?.TotalCost ?? data?.totalCost ?? data?.Amount ?? data?.amount ?? quantity * fallbackUnitPrice);
                const name = (data?.MaterialName || data?.materialName || data?.name || catalogEntry?.Name || catalogEntry?.name) || `Vật liệu ${index + 1}`;
                const unit = data?.Unit || data?.unit || catalogEntry?.Unit || catalogEntry?.unit || undefined;

                return {
                    id: docSnap.id,
                    materialId: materialId ? String(materialId) : '',
                    name,
                    unit,
                    quantity,
                    cost: totalCost,
                    unitPrice: fallbackUnitPrice,
                    rawData: data,
                };
            });

            // 2. Tải danh sách nhân công sửa chữa tham gia của đơn hàng
            const laborDocs = await loadCollection('repairorderlabor', ['RepairOrder_ID', 'repairOrderId', 'orderId', 'RepairOrderId', 'RepairOrderID', 'Order_ID']);
            const employeeIdSet = new Set<string>();
            laborDocs.forEach((docSnap: any) => {
                const data = docSnap.data() as any;
                const candidates = [
                    data?.Employee_ID,
                    data?.employeeId,
                    data?.EmployeeId,
                    data?.employee_id,
                ];
                candidates.forEach((val) => {
                    if (typeof val === 'string' && val.trim()) {
                        employeeIdSet.add(val.trim());
                    }
                });
            });

            // Truy vấn thông tin tên nhân công từ bảng 'employees' hoặc 'users'
            const employeeCatalog: Record<string, any> = {};
            if (employeeIdSet.size > 0) {
                const employeeEntries = await Promise.all(
                    Array.from(employeeIdSet).map(async (employeeId) => {
                        try {
                            const empSnap = await getDoc(doc(db, 'employees', employeeId));
                            if (empSnap.exists()) {
                                return { id: employeeId, data: empSnap.data() };
                            }
                        } catch (error) { /* Bỏ qua lỗi */ }

                        try {
                            const userSnap = await getDoc(doc(db, 'users', employeeId));
                            if (userSnap.exists()) {
                                return { id: employeeId, data: userSnap.data() };
                            }
                        } catch (error) { /* Bỏ qua lỗi */ }

                        return null;
                    })
                );
                employeeEntries.forEach((entry) => {
                    if (entry) {
                        employeeCatalog[entry.id] = entry.data;
                    }
                });
            }

            // Định dạng danh sách nhân công phục vụ bảng tính tiền
            const labors = laborDocs.map((docSnap: any, index: number) => {
                const data = docSnap.data() as any;
                const days = parseAmount(data?.NumberOfDay ?? data?.numberOfDay ?? data?.days ?? data?.Days ?? data?.Quantity ?? 0);
                const employeeId = [
                    data?.Employee_ID,
                    data?.employeeId,
                    data?.EmployeeId,
                    data?.employee_id,
                ].find((val) => typeof val === 'string' && val.trim()) || '';

                const employeeInfo = employeeId ? employeeCatalog[String(employeeId)] : undefined;
                const unitRate = parseAmount(data?.UnitPrice ?? data?.unitPrice ?? data?.Rate ?? data?.rate ?? DEFAULT_LABOR_RATE);
                const employeeName = (data?.EmployeeName || data?.employeeName || employeeInfo?.UserName || employeeInfo?.fullName) || `Nhân công ${index + 1}`;
                const jobName = (data?.JobName || data?.jobName || data?.Description || data?.description) || '';
                const expertise = (data?.Expertise || data?.expertise || '').toString().trim();

                // Tính lương dựa vào chuyên môn bậc thợ hoặc fallback lương cố định
                const expertiseBasedRate = expertise ? getExpertiseRate(expertise) : null;
                const finalUnitRate = expertiseBasedRate ?? unitRate;

                return {
                    id: docSnap.id,
                    employeeId: employeeId ? String(employeeId) : '',
                    employeeName,
                    jobName,
                    days,
                    expertise,
                    unitRate: finalUnitRate,
                    cost: days * finalUnitRate,
                    rawData: data,
                };
            });

            // Phòng tránh việc cập nhật nhầm state nếu người dùng đã chuyển sang đơn hàng khác
            if (selectedOrderIdRef.current !== orderId) {
                return;
            }

            setMaterialLines(materials);
            setLaborLines(labors);
        } catch (error) {
            console.error('Failed to load order lines', error);
            message.error('Không thể tải dữ liệu vật liệu/nhân công của đơn này.');
            setMaterialLines([]);
            setLaborLines([]);
        } finally {
            setModalLoading(false);
        }
    };

    // Hàm xử lý khi ấn nút "Tạo hóa đơn" trên bảng chính
    const handleCreateInvoice = async (record: any) => {
        setSelectedOrder(record);
        selectedOrderIdRef.current = record.id;
        setInvoiceModalOpen(true);
        setMaterialLines([]);
        setLaborLines([]);

        try {
            await loadOrderDetails(record.id);
        } catch (err) { /* Bỏ qua */ }
    };

    // Hàm đóng Modal tạo hóa đơn
    const handleCloseInvoiceModal = () => {
        setInvoiceModalOpen(false);
        resetModalState();
        setModalLoading(false);
        setSavingInvoice(false);
    };

    // Thay đổi số lượng vật tư trực tiếp trên Modal và tự động tính lại chi phí dòng tương ứng
    const handleMaterialQuantityChange = (id: string, value: number | null) => {
        const numericValue = Number(value ?? 0);
        setMaterialLines((prev) =>
            prev.map((line) => {
                if (line.id !== id) return line;
                const unitPrice = Number.isFinite(line.unitPrice)
                    ? Number(line.unitPrice)
                    : line.quantity
                        ? Number((Number(line.cost) / Math.max(Number(line.quantity), 1)).toFixed(0))
                        : 0;
                return {
                    ...line,
                    quantity: numericValue,
                    cost: Number((unitPrice * numericValue).toFixed(0)),
                    unitPrice,
                };
            })
        );
    };

    // Thay đổi số ngày công của thợ trực tiếp trên Modal và tự động tính lại chi phí tương ứng
    const handleLaborDaysChange = (id: string, value: number | null) => {
        const numericValue = Number(value ?? 0);
        setLaborLines((prev) =>
            prev.map((line) => {
                if (line.id !== id) return line;
                const unitRate = Number.isFinite(line.unitRate) ? Number(line.unitRate) : DEFAULT_LABOR_RATE;
                return {
                    ...line,
                    days: numericValue,
                    cost: Number((unitRate * numericValue).toFixed(0)),
                    unitRate,
                };
            })
        );
    };

    // Sử dụng useMemo để tối ưu hóa hiệu năng tính toán chi phí hóa đơn khi thay đổi số lượng/ngày công
    const materialTotal = useMemo(
        () => materialLines.reduce((sum, line) => sum + (Number(line.cost) || 0), 0),
        [materialLines]
    );
    const laborTotal = useMemo(
        () => laborLines.reduce((sum, line) => sum + (Number(line.cost) || 0), 0),
        [laborLines]
    );
    const grandTotal = useMemo(() => materialTotal + laborTotal, [materialTotal, laborTotal]);

    // Lưu trữ hóa đơn hoàn chỉnh lên collection 'invoice' trong Firestore
    const handleSaveInvoice = async () => {
        try {
            if (!selectedOrder) {
                message.error('Không xác định được thông tin đơn sửa chữa.');
                return;
            }
            setSavingInvoice(true);
            
            // Kiểm tra xem đơn sửa chữa này đã tồn tại hóa đơn nào chưa để tránh tạo trùng
            const existingSnap = await getDocs(
                query(collection(db, 'invoice'), where('RepairOrder_ID', '==', selectedOrder.id))
            );

            if (!existingSnap.empty) {
                message.warning('Đơn sửa chữa này đã có hóa đơn.');
                return;
            }

            const customerUidForInvoice = resolveOrderCustomerId(selectedOrder, selectedOrder) || null;
            const finalAmount = grandTotal;

            const invoicePayload = {
                Invoice_ID: Date.now(), // Tạo mã hóa đơn dựa trên timestamp
                RepairOrder_ID: selectedOrder.id, // Liên kết tới khóa ngoại đơn sửa chữa
                Customer_ID: customerUidForInvoice || selectedOrder.customerId || null,
                OrderCode: selectedOrder.orderCode || null,
                stt: 0, // Không áp dụng stt giảm giá nữa
                TotalAmount: finalAmount,
                OriginalTotalAmount: grandTotal,
                DiscountRate: 0,
                DiscountAmount: 0,
                FinalAmount: finalAmount,
                RemainingAmount: finalAmount,
                PaymentMethod: 'Chưa xác định',
                PaymentStatus: 'Chưa thanh toán',
                CreatedDate: serverTimestamp(), // Ngày tạo tự động lấy từ Server Firestore
                MaterialLines: materialLines.map((line) => ({
                    id: line.id,
                    materialId: line.materialId || null,
                    name: line.name || '',
                    unit: line.unit || null,
                    quantity: safeNumber(line.quantity, 0),
                    unitPrice: safeNumber(line.unitPrice, 0),
                    cost: safeNumber(line.cost, 0),
                    rawData: line.rawData ?? null,
                })),
                LaborLines: laborLines.map((line) => ({
                    id: line.id,
                    employeeId: line.employeeId || null,
                    employeeName: line.employeeName || '',
                    jobName: line.jobName || '',
                    days: safeNumber(line.days, 0),
                    unitRate: safeNumber(line.unitRate, DEFAULT_LABOR_RATE),
                    cost: safeNumber(line.cost, 0),
                    rawData: line.rawData ?? null,
                })),
            };

            // Thêm hóa đơn mới vào collection 'invoice'
            await addDoc(collection(db, 'invoice'), invoicePayload);

            // Cập nhật trạng thái đơn sửa chữa thành "Đã tạo hóa đơn"
            const repairOrderRef = doc(db, 'repairOrder', selectedOrder.id);
            await updateDoc(repairOrderRef, {
                Status: 'Đã tạo hóa đơn',
            });

            message.success('Đã lưu hóa đơn thành công.');
            handleCloseInvoiceModal();
            await fetchInvoices(); // Tải lại danh sách bảng hiển thị
        } catch (error) {
            console.error('Failed to save invoice', error);
            message.error('Không thể lưu hóa đơn vào lúc này.');
        } finally {
            setSavingInvoice(false);
        }
    };

    /**
     * Tải toàn bộ danh sách đơn sửa chữa có trạng thái đã "Hoàn thành" sửa chữa để kế toán xem và click "Tạo hóa đơn"
     */
    const fetchInvoices = async () => {
        try {
            setLoadingInvoices(true);
            const snapshot = await getDocs(collection(db, 'repairOrder'));

            const rows = await Promise.all(
                snapshot.docs.map(async (d) => {
                    const data = d.data() as any;
                    const rawStatus = data?.Status || '';
                    const normalizedStatus = typeof rawStatus === 'string' ? rawStatus.toLowerCase() : '';
                    
                    // Chỉ lọc hiển thị các đơn sửa chữa có chữ "hoàn thành" trong trạng thái
                    const isCompleted = normalizedStatus.includes('hoàn thành');
                    if (!isCompleted) return null;

                    let shipName = data?.shipName || '';
                    if (!shipName) {
                        try {
                            const shipId = data?.shipId;
                            if (shipId) {
                                const shipSnap = await getDoc(doc(db, 'ship', shipId));
                                if (shipSnap.exists()) {
                                    const shipData = shipSnap.data() as any;
                                    shipName = shipData?.name || '';
                                }
                            }
                        } catch (error) { /* Bỏ qua */ }
                    }

                    const rawTotal = data?.totalCost ?? 0;
                    const totalCost = typeof rawTotal === 'number' ? rawTotal : Number(rawTotal) || 0;

                    const completionSource = data?.ScheduleEndDate || data?.EndDate || null;
                    const completionDate = completionSource?.toDate
                        ? completionSource.toDate()
                        : completionSource instanceof Date
                            ? completionSource
                            : null;
                    const formattedCompletion = completionDate && !isNaN(completionDate.getTime())
                        ? completionDate.toLocaleDateString('vi-VN')
                        : '';

                    return {
                        id: d.id,
                        orderCode: data?.OrderCode || d.id,
                        shipName: shipName || '---',
                        totalCost,
                        status: rawStatus || 'Hoàn thành sửa chữa',
                        completedAt: formattedCompletion,
                        customerId: resolveOrderCustomerId(data),
                    };
                })
            );

            setInvoices(rows.filter(Boolean)); // Lọc bỏ các phần tử null
        } catch (error) {
            message.error('Lỗi khi tải dữ liệu hóa đơn!');
        } finally {
            setLoadingInvoices(false);
        }
    };

    // Tự động tải danh sách hóa đơn khi component được render lần đầu
    useEffect(() => {
        fetchInvoices();
    }, []);

    // Cấu hình các cột của bảng chính (danh sách đơn đã sửa xong chờ xuất hóa đơn)
    const columns = [
        {
            title: 'STT',
            key: 'stt',
            width: 60,
            render: (_: any, __: any, index: number) => index + 1,
        },
        { title: 'Tàu', dataIndex: 'shipName', key: 'shipName' },
        { title: 'Ngày hoàn thành', dataIndex: 'completedAt', key: 'completedAt' },
        { title: 'Trạng thái', dataIndex: 'status', key: 'status' },
        {
            title: 'Hành động',
            key: 'actions',
            render: (_: any, record: any) => (
                <Button size="small" onClick={() => handleCreateInvoice(record)}>
                    Tạo hóa đơn
                </Button>
            ),
        },
    ];

    // Cấu hình cột hiển thị vật liệu trên Modal
    const materialColumns = [
        {
            title: 'STT',
            key: 'stt',
            width: 60,
            render: (_: any, __: any, index: number) => index + 1,
        },
        { title: 'Tên vật liệu', dataIndex: 'name', key: 'name' },
        {
            title: 'Số lượng',
            dataIndex: 'quantity',
            key: 'quantity',
            render: (_: any, record: any) => (
                <InputNumber
                    min={0}
                    value={record.quantity}
                    onChange={(value) => handleMaterialQuantityChange(record.id, typeof value === 'number' ? value : Number(value))}
                    style={{ width: '100%' }}
                />
            ),
        },
        {
            title: 'Đơn giá',
            dataIndex: 'unitPrice',
            key: 'unitPrice',
            render: (value: number) => formatCurrency(value),
        },
        {
            title: 'Chi phí',
            dataIndex: 'cost',
            key: 'cost',
            render: (value: number) => formatCurrency(value),
        },
    ];

    // Cấu hình cột hiển thị nhân công trên Modal
    const laborColumns = [
        {
            title: 'STT',
            key: 'stt',
            width: 60,
            render: (_: any, __: any, index: number) => index + 1,
        },
        { title: 'Nhân viên', dataIndex: 'employeeName', key: 'employeeName' },
        { title: 'Công việc', dataIndex: 'jobName', key: 'jobName' },
        {
            title: 'Số ngày',
            dataIndex: 'days',
            key: 'days',
            render: (_: any, record: any) => (
                <InputNumber
                    min={0}
                    value={record.days}
                    onChange={(value) => handleLaborDaysChange(record.id, typeof value === 'number' ? value : Number(value))}
                    style={{ width: '100%' }}
                />
            ),
        },
        {
            title: 'Đơn giá',
            dataIndex: 'unitRate',
            key: 'unitRate',
            render: (value: number) => formatCurrency(value),
        },
        {
            title: 'Chi phí',
            dataIndex: 'cost',
            key: 'cost',
            render: (value: number) => formatCurrency(value),
        },
    ];

    const filteredInvoices = invoices;

    return (
        <div className="w-full overflow-x-auto">
            <div className="flex items-center justify-between mb-4">
                <Title level={5} className="m-0">Danh sách chờ tạo hóa đơn</Title>
            </div>
            
            <Table
                columns={columns}
                dataSource={filteredInvoices}
                rowKey="id"
                loading={loadingInvoices}
                bordered
                className="shadow-sm"
                scroll={{ x: 'max-content' }}
            />
            
            {/* Modal lớn dùng để Kế toán điều chỉnh lại số lượng/ngày công nháp và xuất hóa đơn */}
            <Modal
                open={invoiceModalOpen}
                title="Tạo hóa đơn"
                onCancel={handleCloseInvoiceModal}
                onOk={handleSaveInvoice}
                okText="Lưu hóa đơn"
                cancelText="Hủy"
                okButtonProps={{ disabled: modalLoading }}
                confirmLoading={savingInvoice}
                destroyOnClose
                width={820}
            >
                {modalLoading ? (
                    <div className="flex items-center justify-center py-10">
                        <Spin tip="Đang tải dữ liệu..." />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {selectedOrder && (
                            <Card size="small" className="shadow-sm">
                                <div className="grid gap-2 text-sm">
                                    <div className="flex justify-between"><span>Tàu:</span><span>{selectedOrder.shipName}</span></div>
                                    <div className="flex justify-between"><span>Ngày hoàn thành:</span><span>{selectedOrder.completedAt || '---'}</span></div>
                                    <div className="flex justify-between"><span>Trạng thái:</span><span>{selectedOrder.status}</span></div>
                                </div>
                            </Card>
                        )}
                        
                        {/* Bảng danh sách vật liệu được sử dụng thực tế */}
                        <Card title="Vật liệu" size="small" className="shadow-sm">
                            <Table
                                columns={materialColumns}
                                dataSource={materialLines}
                                rowKey="id"
                                pagination={false}
                                size="small"
                                locale={{ emptyText: 'Chưa có vật liệu nào' }}
                            />
                            <div className="flex justify-end font-medium mt-3">
                                Chi phí vật liệu: {formatCurrency(materialTotal)}
                            </div>
                        </Card>
                        
                        {/* Bảng danh sách nhân công thợ được gán thực tế */}
                        <Card title="Nhân công" size="small" className="shadow-sm">
                            <Table
                                columns={laborColumns}
                                dataSource={laborLines}
                                rowKey="id"
                                pagination={false}
                                size="small"
                                locale={{ emptyText: 'Chưa có nhân công nào' }}
                            />
                            <div className="flex justify-end font-medium mt-3">
                                Chi phí nhân công: {formatCurrency(laborTotal)}
                            </div>
                        </Card>
                        
                        {/* Tổng chi phí */}
                        <Card size="small" className="shadow-sm">
                            <div className="flex justify-between items-center text-base">
                                <span>Tổng chi phí cần thanh toán</span>
                                <strong>{formatCurrency(grandTotal)}</strong>
                            </div>
                        </Card>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default AccountHome;