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
    Modal, // Import Modal từ Ant Design
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

    const [isInvoiceVisible, setIsInvoiceVisible] = useState(false); // State để quản lý hiển thị hóa đơn

    const formatMoney = (value: number) =>
        value.toLocaleString('vi-VN') + ' đ';

    const normalize = (str: any) =>
        String(str || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();

    // Hàm để mở và đóng modal hóa đơn
    const showInvoice = () => setIsInvoiceVisible(true);
    const hideInvoice = () => setIsInvoiceVisible(false);

    // 1. Load user + order
    useEffect(() => {
        const fetchOrder = async () => {
            const uid = sessionStorage.getItem('uid');
            if (!uid) {
                navigate('/login');
                return;
            }

            try {
                const customersRef = collection(db, 'customers');
                const customerQuery = query(customersRef, where('uid', '==', uid));
                const customerSnapshot = await getDocs(customerQuery);
                if (!customerSnapshot.empty) {
                    setUserName(customerSnapshot.docs[0].data().fullName || 'Khách hàng');
                }
            } catch {}

            setLoadingUser(false);

            if (!state && id) {
                try {
                    setLoading(true);
                    const orderRef = doc(db, 'repairOrder', id);
                    const orderSnap = await getDoc(orderRef);
                    if (orderSnap.exists()) {
                        const data = orderSnap.data() as any;
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

    // 2. Load catalog vật liệu
    useEffect(() => {
        const loadCatalog = async () => {
            try {
                const mats = await getDocs(collection(db, 'material'));
                setMaterialsCatalog(mats.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
            } catch {}
        };
        loadCatalog();
    }, []);

    // 3. Load vật liệu đơn
    useEffect(() => {
        const loadExisting = async () => {
            if (!orderData?.id) return;
            try {
                const qRef = query(
                    collection(db, 'repairordermaterial'),
                    where('RepairOrder_ID', '==', orderData.id)
                );
                const snap = await getDocs(qRef);

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
            } catch (e) {
                console.error('Failed to load materials', e);
            }
        };
        loadExisting();
    }, [orderData, materialsCatalog]);

    // 4. Load ship + workshop
    useEffect(() => {
        const fetchNames = async () => {
            if (!orderData) return;

            try {
                if (orderData.shipId) {
                    const shipSnap = await getDoc(doc(db, 'ship', orderData.shipId));
                    setShipName(shipSnap.exists() ? shipSnap.data().name : 'Không xác định');
                } else {
                    setShipName(orderData.shipName || 'Không xác định');
                }
            } catch {
                setShipName('Không xác định');
            }

            try {
                if (orderData.workshopId) {
                    const wsSnap = await getDoc(doc(db, 'workShop', orderData.workshopId));
                    setWorkshopName(wsSnap.exists() ? wsSnap.data().name : 'Không xác định');
                } else {
                    setWorkshopName(orderData.workshopName || 'Không xác định');
                }
            } catch {
                setWorkshopName('Không xác định');
            }
        };

        fetchNames();
    }, [orderData]);

    // 5. Tính chi phí
    const materialsCost = materialLines.reduce(
        (s, x) => s + (Number(x.lineTotal) || 0),
        0
    );

    const savedMaterialsCost =
        Number(orderData?.materialsCost) || materialsCost;

    const savedLaborCost =
        Number(orderData?.laborCost) || 0;

    const savedTotalCost =
        Number(orderData?.totalCost) || (savedMaterialsCost + savedLaborCost);

    // 6. Loading guard
    if (loading || !orderData) {
        return (
            <div className="p-6">
                <Spin /> Đang tải dữ liệu...
            </div>
        );
    }

    const { createdAt, Status, description } = orderData;

    const proposalText: string =
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

    // 7. Actions
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

    const handleRequestReproposal = async (text: string) => {
        if (!id) return;
        try {
            setReproposalSubmitting(true);
            await updateDoc(doc(db, 'repairOrder', id), {
                Status: 'Yêu cầu đề xuất lại',
                CustomerAdjustmentRequest: {
                    text,
                    createdAt: Timestamp.now(),
                    createdByUid: sessionStorage.getItem('uid') || null,
                    createdByName: userName || null,
                },
            });
            message.success('Đã gửi yêu cầu đề xuất lại.');
            setReproposalModalVisible(false);
            navigate('/');
        } catch {
            message.error('Lỗi khi gửi yêu cầu.');
        } finally {
            setReproposalSubmitting(false);
        }
    };

    const handleCancelOrder = async () => {
        if (!id) return;
        setCanceling(true);
        try {
            const existingQuery = query(
                collection(db, 'repairordermaterial'),
                where('RepairOrder_ID', '==', id)
            );
            const existingSnap = await getDocs(existingQuery);

            for (const ed of existingSnap.docs) {
                try {
                    await deleteDoc(doc(db, 'repairordermaterial', ed.id));
                } catch (e) {}
            }

            await deleteDoc(doc(db, 'repairOrder', id));
            message.success('Đã xóa đơn hàng.');
            navigate('/');
        } catch {
            message.error('Lỗi khi huỷ đơn.');
        } finally {
            setCanceling(false);
        }
    };

    // 8. Render
    return (
        <CustomerLayout userName={userName} loadingUser={loadingUser}>
            <div className="flex justify-between items-center mb-4">
                <Title level={4} className="m-0">
                    Chi tiết đơn sửa chữa
                </Title>
                <Button onClick={() => navigate(-1)}>Quay lại</Button>
            </div>

            <Descriptions title="Thông tin đơn" bordered column={1}>
                <Descriptions.Item label="Tàu">{shipName}</Descriptions.Item>
                <Descriptions.Item label="Ngày tạo">{createdAt}</Descriptions.Item>
                <Descriptions.Item label="Trạng thái">{Status}</Descriptions.Item>
                <Descriptions.Item label="Xưởng">
                    {workshopName || 'Chưa xác định'}
                </Descriptions.Item>
                {description && (
                    <Descriptions.Item label="Mô tả">
                        {description}
                    </Descriptions.Item>
                )}
            </Descriptions>

            {/* Nút hiển thị hóa đơn */}
            {normalize(Status) === normalize('đã tạo hóa đơn') && (
                <div className="mt-4 text-right">
                    <Button type="primary" onClick={showInvoice}>
                        Xem hóa đơn
                    </Button>
                </div>
            )}

            {/* Modal hiển thị hóa đơn */}
            <Modal
                title="Hóa đơn"
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
