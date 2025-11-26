// src/pages/Customer/OrderDetail.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    Layout,
    Typography,
    Descriptions,
    Button,
    Spin,
    message,
    Row,
    Col,
    Card,
    Popconfirm,
    Input,
} from 'antd';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    deleteDoc,
    updateDoc,
    Timestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import CustomerLayout from '../../components/Customer/CustomerLayout';
import RepairPlanModal from '../../components/Customer/RepairPlanModal';
import ReproposalModal from '../../components/Customer/ReproposalModal';

const { Title } = Typography;

const OrderDetail: React.FC = () => {
    const { state } = useLocation();
    const { id } = useParams();
    const navigate = useNavigate();

    const [orderData, setOrderData] = useState<any>(state || null);
    const [loading, setLoading] = useState(!state);
    const [shipName, setShipName] = useState('');
    const [workshopName, setWorkshopName] = useState('');
    const [employeeName, setEmployeeName] = useState('');
    const [userName, setUserName] = useState('');
    const [loadingUser, setLoadingUser] = useState(true);
    const [canceling, setCanceling] = useState(false);
    const [accepting, setAccepting] = useState(false);

    const [reproposalModalVisible, setReproposalModalVisible] = useState(false);
    const [reproposalSubmitting, setReproposalSubmitting] = useState(false);

    const [proposalModalVisible, setProposalModalVisible] = useState(false);

    const [materialsCatalog, setMaterialsCatalog] = useState<any[]>([]);
    const [materialLines, setMaterialLines] = useState<any[]>([]);

    const [invoiceData, setInvoiceData] = useState<any | null>(null);
    const [invoiceLoading, setInvoiceLoading] = useState<boolean>(false);

    // ─────────────────────────────────────────────
    // Load đơn + thông tin khách hàng
    // ─────────────────────────────────────────────
    useEffect(() => {
        const fetchOrder = async () => {
            const uid = sessionStorage.getItem('uid');
            if (!uid) {
                navigate('/login');
                return;
            }

            try {
                // Lấy tên khách hàng cho header
                const customersRef = collection(db, 'customers');
                const customerQuery = query(customersRef, where('uid', '==', uid));
                const customerSnapshot = await getDocs(customerQuery);
                if (!customerSnapshot.empty) {
                    setUserName(customerSnapshot.docs[0].data().fullName || 'Khách hàng');
                }
            } catch {
                // ignore
            } finally {
                setLoadingUser(false);
            }

            // Nếu không truyền state, load từ Firestore
            if (!state && id) {
                try {
                    setLoading(true);
                    const orderRef = doc(db, 'repairOrder', id);
                    const orderSnap = await getDoc(orderRef);
                    if (orderSnap.exists()) {
                        const data = orderSnap.data();
                        setOrderData({
                            id,
                            ...data,
                            createdAt: data?.StartDate?.toDate().toLocaleDateString('vi-VN'),
                        });
                    } else {
                        message.error('Không tìm thấy đơn hàng.');
                        navigate('/');
                    }
                } catch {
                    message.error('Lỗi tải đơn hàng.');
                } finally {
                    setLoading(false);
                }
            }
        };

        fetchOrder();
    }, [state, id, navigate]);

    // ─────────────────────────────────────────────
    // Load catalog vật liệu
    // ─────────────────────────────────────────────
    useEffect(() => {
        const loadCatalog = async () => {
            try {
                const mats = await getDocs(collection(db, 'material'));
                setMaterialsCatalog(mats.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
            } catch {
                // ignore
            }
        };
        loadCatalog();
    }, []);

    // ─────────────────────────────────────────────
    // Load vật liệu đã lưu của đơn
    // ─────────────────────────────────────────────
    useEffect(() => {
        const loadExisting = async () => {
            if (!orderData?.id) return;
            try {
                const qRef = query(
                    collection(db, 'repairordermaterial'),
                    where('RepairOrder_ID', '==', orderData.id)
                );
                const snap = await getDocs(qRef);
                if (!snap.empty) {
                    const lines = snap.docs.map(d => {
                        const data = d.data() as any;
                        const mid = data.Material_ID || data.materialId || null;
                        const qty = Number(data.QuantityUsed || data.quanityused || 0);
                        const mCatalog = materialsCatalog.find(m => m.id === mid) || {};
                        const unitPrice = mCatalog.Price || mCatalog.price || 0;
                        return {
                            docId: d.id,
                            id: Date.now() + Math.floor(Math.random() * 1000),
                            materialId: mid,
                            name: mCatalog.Name || mCatalog.name || '',
                            unit: mCatalog.Unit || mCatalog.unit || '',
                            unitPrice,
                            qty,
                            lineTotal: qty * unitPrice,
                        };
                    });
                    setMaterialLines(lines);
                }
            } catch (e) {
                console.error('Failed to load existing repairordermaterial', e);
            }
        };
        loadExisting();
    }, [orderData, materialsCatalog]);

    // ─────────────────────────────────────────────
    // Load tên tàu / xưởng / giám định viên
    // ─────────────────────────────────────────────
    useEffect(() => {
        const fetchNames = async () => {
            if (!orderData) return;

            // Ship name
            try {
                if (orderData.shipId) {
                    const shipSnap = await getDoc(doc(db, 'ship', orderData.shipId));
                    setShipName(shipSnap.exists() ? shipSnap.data().name : 'Không xác định');
                } else if (orderData.shipName) {
                    setShipName(orderData.shipName);
                } else {
                    setShipName('Không xác định');
                }
            } catch {
                setShipName('Không xác định');
            }

            // Workshop name
            try {
                if (orderData.workshopId) {
                    const wsSnap = await getDoc(doc(db, 'workShop', orderData.workshopId));
                    setWorkshopName(wsSnap.exists() ? wsSnap.data().name : 'Không xác định');
                } else if (orderData.workshopName) {
                    setWorkshopName(orderData.workshopName);
                } else {
                    setWorkshopName('');
                }
            } catch {
                setWorkshopName('');
            }

            // Inspector / assigned employee name
            try {
                if (orderData.inspectorId) {
                    const employeeSnap = await getDoc(doc(db, 'employees', orderData.inspectorId));
                    setEmployeeName(
                        employeeSnap.exists()
                            ? (employeeSnap.data().fullName ||
                                employeeSnap.data().UserName ||
                                orderData.inspectorId)
                            : orderData.inspectorId
                    );
                } else if (orderData.assignedInspector) {
                    setEmployeeName(orderData.assignedInspector);
                } else {
                    setEmployeeName('');
                }
            } catch {
                setEmployeeName(orderData.inspectorId || orderData.assignedInspector || '');
            }
        };
        fetchNames();
    }, [orderData]);

    // ─────────────────────────────────────────────
    // Chi phí vật liệu / nhân công (từ order)
    // ─────────────────────────────────────────────
    const materialsCost = materialLines.reduce(
        (s, x) => s + (Number(x.lineTotal) || 0),
        0
    );

    const savedMaterialsCost = Number(orderData?.materialsCost) || materialsCost;
    const savedLaborCost = Number(orderData?.laborCost) || 0;
    const savedTotalCost =
        Number(orderData?.totalCost) || (savedMaterialsCost + savedLaborCost);

    // ─────────────────────────────────────────────
    // Hóa đơn
    // ─────────────────────────────────────────────
    const fetchInvoice = async (orderId: string) => {
        setInvoiceLoading(true);
        try {
            const invoiceQuery = query(
                collection(db, 'invoice'),
                where('RepairOrder_ID', '==', orderId)
            );
            const invoiceSnap = await getDocs(invoiceQuery);
            if (!invoiceSnap.empty) {
                const firstDoc = invoiceSnap.docs[0];
                setInvoiceData({ id: firstDoc.id, ...firstDoc.data() });
            } else {
                setInvoiceData(null);
            }
        } catch (error) {
            console.error('Failed to load invoice for order', error);
            message.error('Không thể tải thông tin hóa đơn.');
        } finally {
            setInvoiceLoading(false);
        }
    };

    useEffect(() => {
        if (!orderData?.id) return;
        fetchInvoice(orderData.id);
    }, [orderData?.id]);

    const formatCurrency = (value: any) => {
        const numeric = typeof value === 'number' ? value : Number(value);
        if (Number.isFinite(numeric)) {
            return numeric.toLocaleString('vi-VN', {
                style: 'currency',
                currency: 'VND',
            });
        }
        return '---';
    };

    const toDisplayDateTime = (value: any) => {
        if (!value) return '';
        if (value instanceof Date) {
            return isNaN(value.getTime()) ? '' : value.toLocaleString('vi-VN');
        }
        if (value?.toDate && typeof value.toDate === 'function') {
            const dateVal = value.toDate();
            return !dateVal || isNaN(dateVal.getTime())
                ? ''
                : dateVal.toLocaleString('vi-VN');
        }
        if (typeof value === 'string') {
            const parsed = new Date(value);
            return isNaN(parsed.getTime()) ? value : parsed.toLocaleString('vi-VN');
        }
        if (value?.seconds) {
            const converted = new Date(value.seconds * 1000);
            return isNaN(converted.getTime())
                ? ''
                : converted.toLocaleString('vi-VN');
        }
        return '';
    };

    const invoiceMaterialTotal = useMemo(() => {
        if (!invoiceData?.MaterialLines) return 0;
        return invoiceData.MaterialLines.reduce(
            (sum: number, line: any) => sum + (Number(line.cost) || 0),
            0
        );
    }, [invoiceData]);

    const invoiceLaborTotal = useMemo(() => {
        if (!invoiceData?.LaborLines) return 0;
        return invoiceData.LaborLines.reduce(
            (sum: number, line: any) => sum + (Number(line.cost) || 0),
            0
        );
    }, [invoiceData]);

    const invoiceGrandTotal = useMemo(() => {
        const explicitTotal = Number(invoiceData?.TotalAmount);
        if (Number.isFinite(explicitTotal) && explicitTotal > 0) {
            return explicitTotal;
        }
        return invoiceMaterialTotal + invoiceLaborTotal;
    }, [invoiceData, invoiceLaborTotal, invoiceMaterialTotal]);

    const invoiceCreatedAtDisplay = useMemo(
        () =>
            toDisplayDateTime(invoiceData?.CreatedDate) ||
            toDisplayDateTime(invoiceData?.createdAt),
        [invoiceData]
    );

    // ─────────────────────────────────────────────
    // Loading guard
    // ─────────────────────────────────────────────
    if (loading || !orderData) {
        return (
            <div className="p-6">
                <Spin /> Đang tải dữ liệu...
            </div>
        );
    }



    // ─────────────────────────────────────────────
    // Destructure từ orderData
    // ─────────────────────────────────────────────
    const { createdAt, Status, description, repairplan } = orderData;

    // ⭐ Quan trọng: Lấy text phương án đề xuất (giám định viên)
    // Ưu tiên `repairplan`, fallback các field khác nếu có
    const proposal: string =
        orderData?.repairplan ||
        orderData?.proposal ||
        orderData?.repairPlan ||
        orderData?.RepairPlan ||
        '';

    // normalize helper
    const normalize = (str: any) =>
        String(str || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();

    const statusNorm = normalize(Status);
    const isProposed = statusNorm === normalize('đã đề xuất phương án');
    const showCancelFor = new Set([
        normalize('chờ giám định'),
        normalize('đang giám định'),
        normalize('đã đề xuất phương án'),
        normalize('yêu cầu đề xuất lại'),
    ]);
    const canCancel = showCancelFor.has(statusNorm);

    // ─────────────────────────────────────────────
    // Actions
    // ─────────────────────────────────────────────
    const handleAcceptRepair = async () => {
        if (!id) return;
        setAccepting(true);
        try {
            await updateDoc(doc(db, 'repairOrder', id), {
                Status: 'Sắp xếp lịch sửa chữa',
            });
            message.success('Đã đồng ý — chuyển sang bước sắp xếp lịch.');
            navigate('/');
        } catch (error) {
            message.error('Lỗi khi đồng ý sửa chữa.');
        } finally {
            setAccepting(false);
        }
    };

    const handleRequestReproposal = async (text: string) => {
        if (!id) return;
        try {
            setReproposalSubmitting(true);
            const payload: any = {
                Status: 'Yêu cầu đề xuất lại',
                CustomerAdjustmentRequest: {
                    text,
                    createdAt: Timestamp.now(),
                    createdByUid: sessionStorage.getItem('uid') || null,
                    createdByName: userName || null,
                },
            };
            await updateDoc(doc(db, 'repairOrder', id), payload);
            message.success('Đã gửi yêu cầu đề xuất lại.');
            setReproposalModalVisible(false);
            navigate('/');
        } catch (e) {
            message.error('Lỗi khi gửi yêu cầu.');
        } finally {
            setReproposalSubmitting(false);
        }
    };

    const handleCancelOrder = async () => {
        if (!id) return;
        setCanceling(true);
        try {
            // Xoá vật liệu liên quan
            try {
                const existingQuery = query(
                    collection(db, 'repairordermaterial'),
                    where('RepairOrder_ID', '==', id)
                );
                const existingSnap = await getDocs(existingQuery);
                for (const ed of existingSnap.docs) {
                    try {
                        await deleteDoc(doc(db, 'repairordermaterial', ed.id));
                    } catch (e) {
                        console.warn('Failed to delete repairordermaterial', e);
                    }
                }
            } catch (e) {
                console.warn('Failed to clean up repairordermaterial', e);
            }

            // Xoá repairOrder
            await deleteDoc(doc(db, 'repairOrder', id));
            message.success('Đã xóa đơn hàng.');
            navigate('/');
        } catch (e) {
            console.error('Cancel failed', e);
            message.error('Lỗi khi huỷ đơn.');
        } finally {
            setCanceling(false);
        }
    };

    // ─────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────
    return (
        <CustomerLayout userName={userName} loadingUser={loadingUser}>
            <div className="flex justify-between items-center mb-4">
                <Title level={4} className="m-0">
                    Chi tiết đơn sửa chữa
                </Title>
                <div className="flex items-center gap-3">
                    <Button onClick={() => navigate(-1)}>Quay lại</Button>
                </div>
            </div>

            <Descriptions title="Thông tin đơn" bordered column={1}>
                <Descriptions.Item label="Tàu">{shipName}</Descriptions.Item>
                <Descriptions.Item label="Ngày tạo">{createdAt}</Descriptions.Item>
                <Descriptions.Item label="Trạng thái">{Status}</Descriptions.Item>
                <Descriptions.Item label="Cán bộ giám định">
                    {employeeName || 'Chưa được gán'}
                </Descriptions.Item>
                <Descriptions.Item label="Xưởng">{workshopName}</Descriptions.Item>
                {description && (
                    <Descriptions.Item label="Mô tả">
                        {description}
                    </Descriptions.Item>
                )}
            </Descriptions>

            {/* Phần phương án đã đề xuất (trên page) */}
            {repairplan && (
                <div className="mt-6">
                    <div className="flex justify-between items-start">
                        <Title level={4} className="m-0">
                            Phương án sửa chữa
                        </Title>

                        {isProposed && (
                            <div className="flex gap-3">
                                <Button
                                    type="primary"
                                    loading={accepting}
                                    onClick={handleAcceptRepair}
                                >
                                    Đồng ý
                                </Button>
                                <Button
                                    onClick={() => setReproposalModalVisible(true)}
                                >
                                    Đề xuất lại
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="mt-3">
                        <Input.TextArea
                            rows={6}
                            value={repairplan || ''}
                            readOnly
                        />
                    </div>

                    <Card size="small" title="Vật liệu đề xuất" className="mt-4">
                        <Row gutter={8} className="mb-2 font-medium">
                            <Col span={12}>
                                <div>Tên</div>
                            </Col>
                            <Col span={6}>
                                <div>Số lượng</div>
                            </Col>
                            <Col span={4}>
                                <div>Chi phí</div>
                            </Col>
                            <Col span={2} />
                        </Row>

                        {materialLines.map((line, idx) => (
                            <Row
                                key={line.id || idx}
                                gutter={8}
                                className="mb-2"
                            >
                                <Col span={12}>
                                    <div style={{ paddingTop: 6 }}>
                                        {line.name ||
                                            line.materialId ||
                                            'Vật liệu'}
                                    </div>
                                </Col>
                                <Col span={6}>
                                    <div style={{ paddingTop: 6 }}>
                                        {line.qty}
                                    </div>
                                </Col>
                                <Col span={4}>
                                    <div style={{ paddingTop: 6 }}>
                                        {(Number(line.lineTotal) || 0).toLocaleString(
                                            'vi-VN'
                                        )}{' '}
                                        đ
                                    </div>
                                </Col>
                                <Col span={2} />
                            </Row>
                        ))}

                        <div className="text-right font-medium">
                            Chi phí vật liệu:{' '}
                            {savedMaterialsCost.toLocaleString('vi-VN')} đ
                        </div>
                    </Card>

                    {/* Chi phí tổng hợp */}
                    <div className="mt-2 text-right">
                        <div className="font-medium">
                            Chi phí nhân công:{' '}
                            {savedLaborCost.toLocaleString('vi-VN')} đ
                        </div>
                        <div className="font-semibold mt-1">
                            Tổng chi phí:{' '}
                            {savedTotalCost.toLocaleString('vi-VN')} đ
                        </div>
                    </div>
                </div>
            )}

            {/* Hóa đơn */}
            {invoiceLoading ? (
                <Card size="small" className="mt-6">
                    <div className="flex items-center gap-2">
                        <Spin size="small" />{' '}
                        <span>Đang tải hóa đơn...</span>
                    </div>
                </Card>
            ) : invoiceData ? (
                <Card size="small" className="mt-6" title="Hóa đơn sửa chữa">
                    <div className="grid gap-2 text-sm mb-4">
                        <div className="flex justify-between">
                            <span>Mã hóa đơn:</span>
                            <span>
                                {invoiceData.Invoice_ID ||
                                    invoiceData.id ||
                                    '---'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Tàu:</span>
                            <span>
                                {shipName ||
                                    orderData?.shipName ||
                                    '---'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Xưởng:</span>
                            <span>
                                {workshopName ||
                                    orderData?.workshopName ||
                                    '---'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Ngày tạo:</span>
                            <span>{invoiceCreatedAtDisplay || '---'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Trạng thái thanh toán:</span>
                            <span>
                                {invoiceData.PaymentStatus ||
                                    'Chưa thanh toán'}
                            </span>
                        </div>
                    </div>

                    {Array.isArray(invoiceData.MaterialLines) &&
                        invoiceData.MaterialLines.length > 0 && (
                            <div className="mb-4">
                                <Title level={5} className="mb-2">
                                    Vật liệu
                                </Title>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm border border-gray-200">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="p-2 text-left">
                                                    STT
                                                </th>
                                                <th className="p-2 text-left">
                                                    Tên vật liệu
                                                </th>
                                                <th className="p-2 text-right">
                                                    Số lượng
                                                </th>
                                                <th className="p-2 text-right">
                                                    Đơn giá
                                                </th>
                                                <th className="p-2 text-right">
                                                    Thành tiền
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {invoiceData.MaterialLines.map(
                                                (line: any, index: number) => (
                                                    <tr
                                                        key={
                                                            line.id ||
                                                            index
                                                        }
                                                        className="border-t border-gray-200"
                                                    >
                                                        <td className="p-2">
                                                            {index + 1}
                                                        </td>
                                                        <td className="p-2">
                                                            {line.name ||
                                                                line.materialId ||
                                                                '---'}
                                                        </td>
                                                        <td className="p-2 text-right">
                                                            {line.quantity ??
                                                                0}
                                                        </td>
                                                        <td className="p-2 text-right">
                                                            {formatCurrency(
                                                                line.unitPrice
                                                            )}
                                                        </td>
                                                        <td className="p-2 text-right">
                                                            {formatCurrency(
                                                                line.cost
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="text-right font-medium mt-2">
                                    Tổng vật liệu:{' '}
                                    {formatCurrency(invoiceMaterialTotal)}
                                </div>
                            </div>
                        )}

                    {Array.isArray(invoiceData.LaborLines) &&
                        invoiceData.LaborLines.length > 0 && (
                            <div className="mb-4">
                                <Title level={5} className="mb-2">
                                    Nhân công
                                </Title>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm border border-gray-200">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="p-2 text-left">
                                                    STT
                                                </th>
                                                <th className="p-2 text-left">
                                                    Nhân viên
                                                </th>
                                                <th className="p-2 text-left">
                                                    Công việc
                                                </th>
                                                <th className="p-2 text-right">
                                                    Số ngày
                                                </th>
                                                <th className="p-2 text-right">
                                                    Đơn giá
                                                </th>
                                                <th className="p-2 text-right">
                                                    Thành tiền
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {invoiceData.LaborLines.map(
                                                (line: any, index: number) => (
                                                    <tr
                                                        key={
                                                            line.id ||
                                                            index
                                                        }
                                                        className="border-t border-gray-200"
                                                    >
                                                        <td className="p-2">
                                                            {index + 1}
                                                        </td>
                                                        <td className="p-2">
                                                            {line.employeeName ||
                                                                line.employeeId ||
                                                                '---'}
                                                        </td>
                                                        <td className="p-2">
                                                            {line.jobName ||
                                                                '---'}
                                                        </td>
                                                        <td className="p-2 text-right">
                                                            {line.days ??
                                                                0}
                                                        </td>
                                                        <td className="p-2 text-right">
                                                            {formatCurrency(
                                                                line.unitRate
                                                            )}
                                                        </td>
                                                        <td className="p-2 text-right">
                                                            {formatCurrency(
                                                                line.cost
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="text-right font-medium mt-2">
                                    Tổng nhân công:{' '}
                                    {formatCurrency(invoiceLaborTotal)}
                                </div>
                            </div>
                        )}

                    <div className="text-right font-semibold text-base">
                        Tổng cộng: {formatCurrency(invoiceGrandTotal)}
                    </div>
                </Card>
            ) : null}

            {/* Nút hủy + Nút mở modal Phương án sửa chữa */}
            {canCancel && (
                <div className="mt-8 flex justify-end gap-3">
                    {isProposed && (
                        <Button
                            type="primary"
                            onClick={() => setProposalModalVisible(true)}
                        >
                            Phương án sửa chữa
                        </Button>
                    )}

                    <Popconfirm
                        title="Bạn có chắc muốn xoá đơn này? Hành động này không thể hoàn tác."
                        onConfirm={handleCancelOrder}
                        okText="Xoá"
                        cancelText="Huỷ"
                    >
                        <Button danger loading={canceling}>
                            Hủy đơn
                        </Button>
                    </Popconfirm>
                </div>
            )}

            {/* 🔹 Modal phương án sửa chữa (hiển thị repairplan + vật liệu) */}
            <RepairPlanModal
                visible={proposalModalVisible}
                onClose={() => setProposalModalVisible(false)}
                onReproposal={() => {
                    setProposalModalVisible(false);
                    setReproposalModalVisible(true);
                }}
                onAcceptRepair={handleAcceptRepair}
                proposalText={proposal}           // ✅ luôn dùng text phương án từ giám định viên
                materialLines={materialLines}
                savedMaterialsCost={savedMaterialsCost}
                savedLaborCost={savedLaborCost}
                savedTotalCost={savedTotalCost}
            />

            {/* 🔹 Modal yêu cầu đề xuất lại */}
            <ReproposalModal
                visible={reproposalModalVisible}
                submitting={reproposalSubmitting}
                onCancel={() => setReproposalModalVisible(false)}
                onSubmit={handleRequestReproposal}
            />
        </CustomerLayout>
    );
};

export default OrderDetail;
