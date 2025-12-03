// src/pages/Customer/OrderDetail.tsx
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
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
    Modal,
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
import Invoice from '../../components/Customer/Invoice';

const { Title } = Typography;

const OrderDetail: React.FC = () => {
    const { state } = useLocation();
    const { id } = useParams();
    const navigate = useNavigate();

    const [orderData, setOrderData] = useState<any>(state || null);
    const [loading, setLoading] = useState(!state);

    const [shipName, setShipName] = useState('');
    const [workshopName, setWorkshopName] = useState('');
    const [userName, setUserName] = useState('');
    const [loadingUser, setLoadingUser] = useState(true);

    const [canceling, setCanceling] = useState(false);
    const [accepting, setAccepting] = useState(false);

    const [reproposalModalVisible, setReproposalModalVisible] = useState(false);
    const [reproposalSubmitting, setReproposalSubmitting] = useState(false);
    const [proposalModalVisible, setProposalModalVisible] = useState(false);

    const [materialsCatalog, setMaterialsCatalog] = useState<any[]>([]);
    const [materialLines, setMaterialLines] = useState<any[]>([]);

    // --- STATE MODAL HÓA ĐƠN ---
    const [isInvoiceVisible, setIsInvoiceVisible] = useState(false);

    const formatMoney = (v: number) =>
        v.toLocaleString('vi-VN') + ' đ';

    const normalize = (s: any) =>
        String(s || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();

    const showInvoice = () => setIsInvoiceVisible(true);
    const hideInvoice = () => setIsInvoiceVisible(false);

    // Load user + order
    useEffect(() => {
        const fetchOrder = async () => {
            const uid = sessionStorage.getItem('uid');
            if (!uid) {
                navigate('/login');
                return;
            }

            try {
                const q1 = query(collection(db, 'customers'), where('uid', '==', uid));
                const snap = await getDocs(q1);
                if (!snap.empty) {
                    setUserName(snap.docs[0].data().fullName || 'Khách hàng');
                }
            } catch {}
            setLoadingUser(false);

            if (!state && id) {
                try {
                    setLoading(true);
                    const ref = doc(db, 'repairOrder', id);
                    const snap2 = await getDoc(ref);
                    if (snap2.exists()) {
                        const d = snap2.data() as any;
                        setOrderData({
                            id,
                            ...d,
                            createdAt: d?.StartDate?.toDate().toLocaleDateString('vi-VN'),
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

    // Load vật liệu mẫu
    useEffect(() => {
        const loadCatalog = async () => {
            try {
                const mats = await getDocs(collection(db, 'material'));
                setMaterialsCatalog(mats.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
            } catch {}
        };
        loadCatalog();
    }, []);

    // Load vật liệu đơn
    useEffect(() => {
        const load = async () => {
            if (!orderData?.id) return;

            const q2 = query(
                collection(db, 'repairordermaterial'),
                where('RepairOrder_ID', '==', orderData.id)
            );

            const snap = await getDocs(q2);
            const lines = snap.docs.map(d => {
                const data = d.data() as any;
                const mid = data.Material_ID || data.materialId;
                const qty = Number(data.QuantityUsed || data.quanityused || 0);
                const mc = materialsCatalog.find(m => m.id === mid) || {};
                const price = mc.Price || mc.price || 0;

                return {
                    id: d.id,
                    name: mc.Name || mc.name || '',
                    qty,
                    unitPrice: price,
                    lineTotal: qty * price,
                };
            });

            setMaterialLines(lines);
        };

        load();
    }, [orderData, materialsCatalog]);

    // Load tên tàu + xưởng
    useEffect(() => {
        const fetchNames = async () => {
            if (!orderData) return;

            try {
                if (orderData.shipId) {
                    const s = await getDoc(doc(db, 'ship', orderData.shipId));
                    setShipName(s.exists() ? s.data().name : 'Không xác định');
                } else setShipName(orderData.shipName || 'Không xác định');
            } catch {
                setShipName('Không xác định');
            }

            try {
                if (orderData.workshopId) {
                    const w = await getDoc(doc(db, 'workShop', orderData.workshopId));
                    setWorkshopName(w.exists() ? w.data().name : 'Không xác định');
                } else setWorkshopName(orderData.workshopName || 'Không xác định');
            } catch {
                setWorkshopName('Không xác định');
            }
        };
        fetchNames();
    }, [orderData]);

    // Tính chi phí
    const materialsCost = materialLines.reduce((s, x) => s + (x.lineTotal || 0), 0);
    const savedMaterialsCost = Number(orderData?.materialsCost) || materialsCost;
    const savedLaborCost = Number(orderData?.laborCost) || 0;
    const savedTotalCost = Number(orderData?.totalCost) || (savedLaborCost + savedMaterialsCost);

    if (loading || !orderData) {
        return (
            <div className="p-6">
                <Spin /> Đang tải dữ liệu...
            </div>
        );
    }

    const { createdAt, Status, description } = orderData;

    const proposalText =
        orderData?.repairplan ||
        orderData?.proposal ||
        orderData?.repairPlan ||
        orderData?.RepairPlan ||
        '';

    const statusNorm = normalize(Status);
    const isProposed = statusNorm === normalize('đã đề xuất phương án');

    const showCancelFor = new Set([
        normalize('chờ giám định'),
        normalize('đang giám định'),
        normalize('đã đề xuất phương án'),
        normalize('yêu cầu đề xuất lại'),
    ]);
    const canCancel = showCancelFor.has(statusNorm);

    // --- CHECK TRẠNG THÁI ĐỂ HIỆN NÚT HÓA ĐƠN ---
    const isInvoiced =
        statusNorm === normalize('đã tạo hóa đơn') ||
        statusNorm === normalize('đã tạo hoá đơn');

    // Accept repair
    const handleAcceptRepair = async () => {
        if (!id) return;
        setAccepting(true);
        try {
            await updateDoc(doc(db, 'repairOrder', id), {
                Status: 'Sắp xếp lịch sửa chữa',
            });
            message.success('Đã đồng ý — chuyển sang bước sắp xếp lịch.');
            navigate('/');
        } catch {
            message.error('Lỗi khi đồng ý sửa chữa.');
        } finally {
            setAccepting(false);
        }
    };

    // Reproposal
    const handleRequestReproposal = async (text: string) => {
        if (!id) return;
        setReproposalSubmitting(true);
        try {
            await updateDoc(doc(db, 'repairOrder', id), {
                Status: 'Yêu cầu đề xuất lại',
                CustomerAdjustmentRequest: {
                    text,
                    createdAt: Timestamp.now(),
                    createdByUid: sessionStorage.getItem('uid'),
                    createdByName: userName,
                },
            });
            message.success('Đã gửi yêu cầu.');
            setReproposalModalVisible(false);
            navigate('/');
        } catch {
            message.error('Lỗi khi gửi yêu cầu.');
        } finally {
            setReproposalSubmitting(false);
        }
    };

    // Cancel order
    const handleCancelOrder = async () => {
        if (!id) return;
        setCanceling(true);
        try {
            const q3 = query(collection(db, 'repairordermaterial'), where('RepairOrder_ID', '==', id));
            const snap = await getDocs(q3);

            for (const d of snap.docs) {
                await deleteDoc(doc(db, 'repairordermaterial', d.id));
            }

            await deleteDoc(doc(db, 'repairOrder', id));
            message.success('Đã xóa đơn.');
            navigate('/');
        } catch {
            message.error('Lỗi khi huỷ đơn.');
        } finally {
            setCanceling(false);
        }
    };

    // ---------------------------------------------------------------
    // ---------------------------- RENDER ----------------------------
    // ---------------------------------------------------------------
    return (
        <CustomerLayout userName={userName} loadingUser={loadingUser}>
            <div className="flex justify-between items-center mb-4">
                <Title level={4} className="m-0">
                    Chi tiết đơn sửa chữa
                </Title>
                <Button onClick={() => navigate(-1)}>Quay lại</Button>
            </div>

            <Descriptions bordered column={1} title="Thông tin đơn">
                <Descriptions.Item label="Tàu">{shipName}</Descriptions.Item>
                <Descriptions.Item label="Ngày tạo">{createdAt}</Descriptions.Item>
                <Descriptions.Item label="Trạng thái">{Status}</Descriptions.Item>
                <Descriptions.Item label="Xưởng">{workshopName}</Descriptions.Item>
                {description && (
                    <Descriptions.Item label="Mô tả">{description}</Descriptions.Item>
                )}
            </Descriptions>

            {proposalText && (
                <div className="mt-6">
                    <div className="flex justify-between items-start">
                        <Title level={4} className="m-0">Phương án sửa chữa</Title>

                        {isProposed && (
                            <div className="flex gap-3">
                                <Button type="primary" loading={accepting} onClick={handleAcceptRepair}>
                                    Đồng ý
                                </Button>
                                <Button onClick={() => setReproposalModalVisible(true)}>
                                    Đề xuất lại
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="mt-3">
                        <Input.TextArea rows={6} value={proposalText} readOnly />
                    </div>

                    <Card size="small" title="Vật liệu đề xuất" className="mt-4">
                        <Row gutter={8} className="mb-2 font-medium">
                            <Col span={12}>Tên</Col>
                            <Col span={6}>Số lượng</Col>
                            <Col span={4}>Chi phí</Col>
                        </Row>

                        {materialLines.map((line, idx) => (
                            <Row key={idx} gutter={8} className="mb-2">
                                <Col span={12}>{line.name}</Col>
                                <Col span={6}>{line.qty}</Col>
                                <Col span={4}>{formatMoney(line.lineTotal)}</Col>
                            </Row>
                        ))}

                        <div className="text-right font-medium mt-3">
                            Chi phí vật liệu: {formatMoney(savedMaterialsCost)}
                        </div>
                    </Card>

                    <div className="text-right mt-2">
                        <div>Chi phí nhân công: {formatMoney(savedLaborCost)}</div>
                        <div className="font-semibold">
                            Tổng chi phí: {formatMoney(savedTotalCost)}
                        </div>
                    </div>

                    {/* HIỆN NÚT HÓA ĐƠN CHỈ KHI ĐÃ TẠO */}
                    {isInvoiced && (
                        <div className="mt-4 text-right">
                            <Button type="primary" onClick={showInvoice}>Hóa đơn</Button>
                        </div>
                    )}

                    {/* MODAL HÓA ĐƠN */}
                    <Modal
                        title="Hóa đơn chi tiết"
                        open={isInvoiceVisible}
                        onCancel={hideInvoice}
                        footer={null}
                    >
                        <Invoice
                            shipName={shipName}
                            workshopName={workshopName}
                            createdAt={createdAt}
                            materialsCost={savedMaterialsCost}
                            laborCost={savedLaborCost}
                            totalCost={savedTotalCost}
                        />
                    </Modal>
                </div>
            )}

            {canCancel && (
                <div className="mt-8 flex justify-end gap-3">
                    {isProposed && (
                        <Button type="primary" onClick={() => setProposalModalVisible(true)}>
                            Phương án sửa chữa
                        </Button>
                    )}

                    <Popconfirm
                        title="Bạn có chắc muốn xoá đơn này?"
                        okText="Xoá"
                        cancelText="Huỷ"
                        onConfirm={handleCancelOrder}
                    >
                        <Button danger loading={canceling}>Hủy đơn</Button>
                    </Popconfirm>
                </div>
            )}

            <RepairPlanModal
                visible={proposalModalVisible}
                onClose={() => setProposalModalVisible(false)}
                onReproposal={() => {
                    setProposalModalVisible(false);
                    setReproposalModalVisible(true);
                }}
                onAcceptRepair={handleAcceptRepair}
                proposalText={proposalText}
                materialLines={materialLines}
                savedMaterialsCost={savedMaterialsCost}
                savedLaborCost={savedLaborCost}
                savedTotalCost={savedTotalCost}
            />

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
