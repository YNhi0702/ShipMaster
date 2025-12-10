import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Table, Typography, message, Input, Modal, Spin, Card, InputNumber } from 'antd';
import { addDoc, collection, getDocs, doc, getDoc, query, where, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const { Title } = Typography;
const DEFAULT_LABOR_RATE = 350000;

const parseAmount = (value: any, fallback = 0): number => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string') {
        const normalized = value.replace(/[^0-9,.-]/g, '').replace(/,/g, '.');
        const numeric = Number(normalized);
        if (!Number.isNaN(numeric)) {
            return numeric;
        }

        const digitsOnly = value.replace(/[^0-9-]/g, '');
        const fallbackNumber = Number(digitsOnly);
        if (!Number.isNaN(fallbackNumber)) {
            return fallbackNumber;
        }
    }

    return fallback;
};

const formatDetailValue = (value: any): string => {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return value.toString();
    }
    if (value instanceof Date) {
        return isNaN(value.getTime()) ? '' : value.toLocaleString('vi-VN');
    }
    if (value?.toDate && typeof value.toDate === 'function') {
        const dateVal = value.toDate();
        return !dateVal || isNaN(dateVal.getTime()) ? '' : dateVal.toLocaleString('vi-VN');
    }
    try {
        return JSON.stringify(value, null, 2);
    } catch (error) {
        return String(value);
    }
};

const safeNumber = (value: any, fallback = 0): number => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    return fallback;
};

const AccountHome: React.FC = () => {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loadingInvoices, setLoadingInvoices] = useState<boolean>(true);
    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
    const [materialLines, setMaterialLines] = useState<any[]>([]);
    const [laborLines, setLaborLines] = useState<any[]>([]);
    const [savingInvoice, setSavingInvoice] = useState(false);
    const selectedOrderIdRef = useRef<string | null>(null);

    const formatCurrency = (value: number) =>
        Number.isFinite(value) ? value.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' }) : '---';

    const resetModalState = () => {
        selectedOrderIdRef.current = null;
        setSelectedOrder(null);
        setMaterialLines([]);
        setLaborLines([]);
    };

    const loadOrderDetails = async (orderId: string) => {
        setModalLoading(true);
        try {
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
                        // ignore invalid field errors
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
                    (typeof data?.Material === 'string' ? data.Material : null),
                ];
                candidates.forEach((val) => {
                    if (typeof val === 'string' && val.trim()) {
                        materialIdSet.add(val.trim());
                    }
                });
            });

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

            const materials = materialDocs.map((docSnap: any, index: number) => {
                const data = docSnap.data() as any;
                const quantity = parseAmount(
                    data?.QuantityUsed ??
                    data?.quantity ??
                    data?.Quantity ??
                    data?.qty ??
                    data?.QuantityUsed ??
                    0
                );

                const materialId = [
                    data?.Material_ID,
                    data?.materialId,
                    data?.MaterialId,
                    data?.material_id,
                    data?.Material?.id,
                    (typeof data?.Material === 'string' ? data.Material : null),
                ].find((val) => typeof val === 'string' && val.trim()) || '';

                const catalogEntry = materialId ? materialCatalog[String(materialId)] : undefined;
                const fallbackUnitPrice = parseAmount(
                    data?.UnitPrice ??
                    data?.unitPrice ??
                    data?.Price ??
                    data?.price ??
                    data?.UnitCost ??
                    data?.unitCost ??
                    catalogEntry?.Price ??
                    catalogEntry?.price ??
                    0
                );

                const totalCost = parseAmount(
                    data?.TotalCost ??
                    data?.totalCost ??
                    data?.Amount ??
                    data?.amount ??
                    data?.Cost ??
                    data?.cost ??
                    data?.Total ??
                    data?.total ??
                    quantity * fallbackUnitPrice
                );

                const name = (data?.MaterialName || data?.materialName || data?.name || catalogEntry?.Name || catalogEntry?.name || data?.ItemName) || `Vật liệu ${index + 1}`;
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

            const laborDocs = await loadCollection('repairorderlabor', ['RepairOrder_ID', 'repairOrderId', 'orderId', 'RepairOrderId', 'RepairOrderID', 'Order_ID']);
            const employeeIdSet = new Set<string>();
            laborDocs.forEach((docSnap: any) => {
                const data = docSnap.data() as any;
                const candidates = [
                    data?.Employee_ID,
                    data?.employeeId,
                    data?.EmployeeId,
                    data?.employee_id,
                    data?.LaborerId,
                ];
                candidates.forEach((val) => {
                    if (typeof val === 'string' && val.trim()) {
                        employeeIdSet.add(val.trim());
                    }
                });
            });

            const employeeCatalog: Record<string, any> = {};
            if (employeeIdSet.size > 0) {
                const employeeEntries = await Promise.all(
                    Array.from(employeeIdSet).map(async (employeeId) => {
                        try {
                            const empSnap = await getDoc(doc(db, 'employees', employeeId));
                            if (empSnap.exists()) {
                                return { id: employeeId, data: empSnap.data() };
                            }
                        } catch (error) {
                            // ignore employee lookup errors
                        }

                        try {
                            const userSnap = await getDoc(doc(db, 'users', employeeId));
                            if (userSnap.exists()) {
                                return { id: employeeId, data: userSnap.data() };
                            }
                        } catch (error) {
                            // ignore user lookup errors
                        }

                        return null;
                    })
                );
                employeeEntries.forEach((entry) => {
                    if (entry) {
                        employeeCatalog[entry.id] = entry.data;
                    }
                });
            }

            const labors = laborDocs.map((docSnap: any, index: number) => {
                const data = docSnap.data() as any;
                const days = parseAmount(
                    data?.NumberOfDay ??
                    data?.numberOfDay ??
                    data?.NumberOfDays ??
                    data?.numberOfDays ??
                    data?.days ??
                    data?.Days ??
                    data?.SoNgay ??
                    data?.SoNgayCong ??
                    data?.Day ??
                    data?.soNgay ??
                    data?.workingDays ??
                    0
                );

                const employeeId = [
                    data?.Employee_ID,
                    data?.employeeId,
                    data?.EmployeeId,
                    data?.employee_id,
                    data?.LaborerId,
                ].find((val) => typeof val === 'string' && val.trim()) || '';

                const employeeInfo = employeeId ? employeeCatalog[String(employeeId)] : undefined;

                const unitRate = parseAmount(
                    data?.UnitPrice ??
                    data?.unitPrice ??
                    data?.Rate ??
                    data?.rate ??
                    data?.CostPerDay ??
                    data?.costPerDay ??
                    data?.UnitCost ??
                    data?.unitCost ??
                    DEFAULT_LABOR_RATE
                );

                const totalCost = parseAmount(
                    data?.TotalCost ??
                    data?.totalCost ??
                    data?.Amount ??
                    data?.amount ??
                    data?.Cost ??
                    data?.cost ??
                    days * unitRate
                );

                const employeeName = (data?.EmployeeName || data?.employeeName || data?.Employee || data?.employee || data?.WorkerName || employeeInfo?.UserName || employeeInfo?.fullName || employeeInfo?.name) || `Nhân công ${index + 1}`;
                const jobName = (data?.JobName || data?.jobName || data?.Task || data?.task || data?.Work || data?.work || data?.WorkDescription || data?.Description || data?.description) || '';

                return {
                    id: docSnap.id,
                    employeeId: employeeId ? String(employeeId) : '',
                    employeeName,
                    jobName,
                    days,
                    unitRate,
                    cost: totalCost,
                    rawData: data,
                };
            });

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

    const handleCreateInvoice = (record: any) => {
        setSelectedOrder(record);
        selectedOrderIdRef.current = record.id;
        setInvoiceModalOpen(true);
        setMaterialLines([]);
        setLaborLines([]);
        loadOrderDetails(record.id);
    };

    const handleCloseInvoiceModal = () => {
        setInvoiceModalOpen(false);
        resetModalState();
        setModalLoading(false);
        setSavingInvoice(false);
    };

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

    const materialTotal = useMemo(
        () => materialLines.reduce((sum, line) => sum + (Number(line.cost) || 0), 0),
        [materialLines]
    );
    const laborTotal = useMemo(
        () => laborLines.reduce((sum, line) => sum + (Number(line.cost) || 0), 0),
        [laborLines]
    );
    const grandTotal = useMemo(() => materialTotal + laborTotal, [materialTotal, laborTotal]);

    const handleSaveInvoice = async () => {
        try {
            if (!selectedOrder) {
                message.error('Không xác định được thông tin đơn sửa chữa.');
                return;
            }
            setSavingInvoice(true);
            const existingSnap = await getDocs(
                query(collection(db, 'invoice'), where('RepairOrder_ID', '==', selectedOrder.id))
            );

            if (!existingSnap.empty) {
                message.warning('Đơn sửa chữa này đã có hóa đơn.');
                return;
            }

            const invoicePayload = {
                Invoice_ID: Date.now(),
                RepairOrder_ID: selectedOrder.id,
                Customer_ID: selectedOrder.customerId || null,
                OrderCode: selectedOrder.orderCode || null,
                TotalAmount: grandTotal,
                RemainingAmount:grandTotal,
                PaymentMethod: 'Chưa xác định',
                PaymentStatus: 'Chưa thanh toán',
                CreatedDate: serverTimestamp(),
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

            await addDoc(collection(db, 'invoice'), invoicePayload);

            const repairOrderRef = doc(db, 'repairOrder', selectedOrder.id);
            await updateDoc(repairOrderRef, {
                Status: 'Đã tạo hóa đơn',
                status: 'Đã tạo hóa đơn',
                currentStatus: 'Đã tạo hóa đơn',
            });

            message.success('Đã lưu hóa đơn thành công.');
            handleCloseInvoiceModal();
            await fetchInvoices();
        } catch (error) {
            console.error('Failed to save invoice', error);
            message.error('Không thể lưu hóa đơn vào lúc này.');
        } finally {
            setSavingInvoice(false);
        }
    };

    const fetchInvoices = async () => {
        try {
            setLoadingInvoices(true);
            const snapshot = await getDocs(collection(db, 'repairOrder'));

            const rows = await Promise.all(
                snapshot.docs.map(async (d) => {
                    const data = d.data() as any;
                    const rawStatus = data?.Status || data?.status || data?.currentStatus || '';
                    const normalizedStatus = typeof rawStatus === 'string' ? rawStatus.toLowerCase() : '';
                    const isCompleted = normalizedStatus.includes('hoàn thành');
                    if (!isCompleted) return null;

                    let shipName = data?.shipName || data?.ShipName || '';
                    if (!shipName) {
                        try {
                            const shipId = data?.shipId || data?.ShipId || data?.shipID;
                            if (shipId) {
                                const shipSnap = await getDoc(doc(db, 'ship', shipId));
                                if (shipSnap.exists()) {
                                    const shipData = shipSnap.data() as any;
                                    shipName = shipData?.name || shipData?.Name || shipData?.shipName || '';
                                }
                            }
                        } catch (error) {
                            // ignore ship fetch failures
                        }
                    }


                    const rawTotal = data?.totalCost ?? data?.TotalCost ?? data?.totalPrice ?? data?.TotalPrice ?? data?.amount ?? null;
                    const totalCost = typeof rawTotal === 'number' ? rawTotal : Number(rawTotal) || 0;

                    const completionSource = data?.CompletedDate || data?.completedAt || data?.ScheduleEndDate || data?.EndDate || data?.endDate;
                    const completionDate = completionSource?.toDate
                        ? completionSource.toDate()
                        : completionSource instanceof Date
                            ? completionSource
                            : typeof completionSource === 'string'
                                ? new Date(completionSource)
                                : null;
                    const formattedCompletion = completionDate && !isNaN(completionDate.getTime())
                        ? completionDate.toLocaleDateString('vi-VN')
                        : '';

                    const readableStatus = typeof rawStatus === 'string' && rawStatus.trim().length > 0
                        ? rawStatus
                        : 'Hoàn thành sửa chữa';

                    return {
                        id: d.id,
                        orderCode: data?.OrderCode || data?.orderCode || data?.code || data?.orderId || d.id,
                        shipName: shipName || '---',
                        totalCost,
                        status: readableStatus,
                        completedAt: formattedCompletion,
                        customerId:
                            data?.Customer_ID ||
                            data?.customerId ||
                            data?.CustomerId ||
                            data?.customer_id ||
                            data?.Customer?.id ||
                            data?.customer?.id ||
                            null,
                    };
                })
            );

            setInvoices(rows.filter(Boolean));
        } catch (error) {
            message.error('Lỗi khi tải dữ liệu hóa đơn!');
        } finally {
            setLoadingInvoices(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, []);

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
                        <Card size="small" className="shadow-sm">
                            <div className="flex justify-between items-center text-base">
                                <span>Tổng chi phí</span>
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