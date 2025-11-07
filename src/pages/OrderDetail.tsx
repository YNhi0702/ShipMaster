import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Layout, Typography, Descriptions, Image, Button, Spin, message, Avatar, Dropdown, Popconfirm } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { collection, query, where, getDocs, doc, getDoc, deleteDoc, updateDoc, Timestamp, addDoc, serverTimestamp } from 'firebase/firestore';
import { Modal, Form, Input, Row, Col, Card } from 'antd';
import { db } from '../firebase';
import CustomerLayout from '../components/CustomerLayout';

const { Header, Content } = Layout;
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
    const [reproposalForm] = Form.useForm();
    const [proposalModalVisible, setProposalModalVisible] = useState(false);
    const [proposalSubmitting, setProposalSubmitting] = useState(false);
    const [proposalText, setProposalText] = useState<string>('');
    const [materialsCatalog, setMaterialsCatalog] = useState<any[]>([]);
    const [materialLines, setMaterialLines] = useState<any[]>([]);

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

    // load material catalog for modal
    useEffect(() => {
        const loadCatalog = async () => {
            try {
                const mats = await getDocs(collection(db, 'material'));
                setMaterialsCatalog(mats.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
            } catch (e) { /* ignore */ }
        };
        loadCatalog();
    }, []);

    // load existing repairordermaterial for this order into materialLines
    useEffect(() => {
        const loadExisting = async () => {
            if (!orderData?.id) return;
            try {
                const q = query(collection(db, 'repairordermaterial'), where('RepairOrder_ID', '==', orderData.id));
                const snap = await getDocs(q);
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

    // load ship/workshop/inspector names for display (customer view)
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

            // Inspector / assigned employee name (optional)
            try {
                if (orderData.inspectorId) {
                    const employeeSnap = await getDoc(doc(db, 'employees', orderData.inspectorId));
                    setEmployeeName(employeeSnap.exists() ? (employeeSnap.data().fullName || employeeSnap.data().UserName || orderData.inspectorId) : orderData.inspectorId);
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

    const materialsCost = materialLines.reduce((s, x) => s + (Number(x.lineTotal) || 0), 0);
    // Use persisted costs if available on the order, otherwise fall back to computed values
    const savedMaterialsCost = Number(orderData?.materialsCost) || materialsCost;
    const savedLaborCost = Number(orderData?.laborCost) || 0;
    const savedTotalCost = Number(orderData?.totalCost) || (savedMaterialsCost + savedLaborCost);

    const handleSubmitProposalFromModal = async () => {
        if (!orderData?.id) return;
        setProposalSubmitting(true);
        try {
            await updateDoc(doc(db, 'repairOrder', orderData.id), {
                repairplan: proposalText,
                Status: 'Đã đề xuất phương án',
            });

            // replace materials
            const existingQuery = query(collection(db, 'repairordermaterial'), where('RepairOrder_ID', '==', orderData.id));
            const existingSnap = await getDocs(existingQuery);
            for (const ed of existingSnap.docs) {
                try { await deleteDoc(doc(db, 'repairordermaterial', ed.id)); } catch (e) { console.error('del failed', e); }
            }
            for (const m of materialLines) {
                if (!m.materialId) continue;
                await addDoc(collection(db, 'repairordermaterial'), {
                    RepairOrder_ID: orderData.id,
                    Material_ID: m.materialId,
                    QuantityUsed: Number(m.qty) || 0,
                    createdAt: serverTimestamp(),
                });
            }

            message.success('Đã gửi đề xuất phương án thành công!');
            setProposalModalVisible(false);
            // refresh page or navigate
            setTimeout(() => navigate('/'), 1200);
        } catch (e) {
            console.error(e);
            message.error('Lỗi khi gửi đề xuất.');
        } finally {
            setProposalSubmitting(false);
        }
    };

    if (loading || !orderData) {
        return <div className="p-6"><Spin /> Đang tải dữ liệu...</div>;
    }

    const { createdAt, Status, description, imageList = {}, repairplan } = orderData;

    // normalize helper to compare Vietnamese status strings reliably
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

    // 👉 Menu dropdown đăng xuất
    const menuItems = [
        { key: 'logout', label: 'Đăng xuất' },
    ];

    const handleMenuClick = ({ key }: { key: string }) => {
        if (key === 'logout') {
            sessionStorage.clear();
            navigate('/login');
        }
    };

    const handleAcceptRepair = async () => {
        if (!id) return;
        setAccepting(true);
        try {
            // set status to scheduling phase so workshop can arrange schedule
            await updateDoc(doc(db, 'repairOrder', id), {
                Status: 'Sắp xếp lịch sửa chữa',
            });
            message.success('Đã đồng ý — chuyển sang bước sắp xếp lịch.');
            // navigate back to home so the user returns to the main list
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
            reproposalForm.resetFields();
            // navigate back to home so the user returns to the main list
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
            // delete related repairordermaterial documents first
            try {
                const existingQuery = query(collection(db, 'repairordermaterial'), where('RepairOrder_ID', '==', id));
                const existingSnap = await getDocs(existingQuery);
                for (const ed of existingSnap.docs) {
                    try { await deleteDoc(doc(db, 'repairordermaterial', ed.id)); } catch (e) { console.warn('Failed to delete repairordermaterial', e); }
                }
            } catch (e) {
                console.warn('Failed to clean up repairordermaterial', e);
            }

            // delete the repairOrder document
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

    return (
        <CustomerLayout userName={userName} loadingUser={loadingUser}>
                <div className="flex justify-between items-center mb-4">
                    <Title level={4} className="m-0">Chi tiết đơn sửa chữa</Title>
                    <div className="flex items-center gap-3">
                        <Button onClick={() => navigate(-1)}>Quay lại</Button>
                    </div>
                </div>

                <Descriptions title="Thông tin đơn" bordered column={1}>
                    <Descriptions.Item label="Tàu">{shipName}</Descriptions.Item>
                    <Descriptions.Item label="Ngày tạo">{createdAt}</Descriptions.Item>
                    <Descriptions.Item label="Trạng thái">{Status}</Descriptions.Item>
                    <Descriptions.Item label="Cán bộ giám định">{employeeName || 'Chưa được gán'}</Descriptions.Item>
                    <Descriptions.Item label="Xưởng">{workshopName}</Descriptions.Item>
                    {description && <Descriptions.Item label="Mô tả">{description}</Descriptions.Item>}
                </Descriptions>

                {repairplan && (
                    <div className="mt-6">
                        <div className="flex justify-between items-start">
                            <Title level={4} className="m-0">Phương án sửa chữa</Title>

                            {isProposed && (
                                <div className="flex gap-3">
                                    <Button type="primary" loading={accepting} onClick={handleAcceptRepair}>Đồng ý</Button>
                                    <Button onClick={() => setReproposalModalVisible(true)}>Đề xuất lại</Button>
                                </div>
                            )}
                        </div>

                        <div className="mt-3">
                            <Input.TextArea rows={6} value={repairplan || ''} readOnly />
                        </div>

                        <Card size="small" title="Vật liệu đề xuất" className="mt-4">
                            <Row gutter={8} className="mb-2 font-medium">
                                <Col span={12}><div>Tên</div></Col>
                                <Col span={6}><div>Số lượng</div></Col>
                                <Col span={4}><div>Chi phí</div></Col>
                                <Col span={2} />
                            </Row>

                            {materialLines.map((line, idx) => (
                                <Row key={line.id || idx} gutter={8} className="mb-2">
                                    <Col span={12}>
                                        <div style={{ paddingTop: 6 }}>{line.name || line.materialId || 'Vật liệu'}</div>
                                    </Col>
                                    <Col span={6}>
                                        <div style={{ paddingTop: 6 }}>{line.qty}</div>
                                    </Col>
                                    <Col span={4}>
                                        <div style={{ paddingTop: 6 }}>{(Number(line.lineTotal) || 0).toLocaleString('vi-VN')} đ</div>
                                    </Col>
                                    <Col span={2} />
                                </Row>
                            ))}

                            <div className="text-right font-medium">Chi phí vật liệu: {savedMaterialsCost.toLocaleString('vi-VN')} đ</div>
                        </Card>

                        {/* Chi phí tổng hợp */}
                        <div className="mt-2 text-right">
                            <div className="font-medium">Chi phí nhân công: {savedLaborCost.toLocaleString('vi-VN')} đ</div>
                            <div className="font-semibold mt-1">Tổng chi phí: {savedTotalCost.toLocaleString('vi-VN')} đ</div>
                        </div>

                        {/* Cancel button moved to page bottom so it's visible regardless of repairplan */}
                    </div>
                )}

                {/* Page-level cancel button (bottom of content) */}
                {canCancel && (
                    <div className="mt-8 flex justify-end">
                        <Popconfirm
                            title="Bạn có chắc muốn xoá đơn này? Hành động này không thể hoàn tác."
                            onConfirm={handleCancelOrder}
                            okText="Xoá"
                            cancelText="Huỷ"
                        >
                            <Button danger loading={canceling}>Hủy đơn</Button>
                        </Popconfirm>
                    </div>
                )}
                <Modal
                    title="Phương án sửa chữa đơn hàng"
                    visible={proposalModalVisible}
                    onCancel={() => setProposalModalVisible(false)}
                    footer={null}
                    destroyOnClose
                >
                    <Form layout="vertical">
                        <Form.Item>
                            {}
                            <Input.TextArea rows={6} value={proposalText} readOnly />
                        </Form.Item>

                        <Form.Item>
                            <Card size="small" title="Vật liệu đề xuất" className="mb-4">
                                {/* Header row */}
                                <Row gutter={8} className="mb-2 font-medium">
                                    <Col span={12}><div>Tên</div></Col>
                                    <Col span={6}><div>Số lượng</div></Col>
                                    <Col span={4}><div>Chi phí</div></Col>
                                    <Col span={2} />
                                </Row>

                                {materialLines.map((line, idx) => (
                                    <Row key={line.id} gutter={8} className="mb-2">
                                        <Col span={12}>
                                            <div style={{ paddingTop: 6 }}>{line.name || line.materialId || 'Vật liệu'}</div>
                                        </Col>
                                        <Col span={6}>
                                            <div style={{ paddingTop: 6 }}>{line.qty}</div>
                                        </Col>
                                        <Col span={4}>
                                            <div style={{ paddingTop: 6 }}>{(Number(line.lineTotal) || 0).toLocaleString('vi-VN')} đ</div>
                                        </Col>
                                        <Col span={2} />
                                    </Row>
                                ))}

                                <div className="text-right font-medium">Chi phí vật liệu: {savedMaterialsCost.toLocaleString('vi-VN')} đ</div>
                            </Card>

                            {/* Tổng hợp chi phí trong modal */}
                            <div className="mt-2 text-right">
                                <div className="font-medium">Chi phí nhân công: {savedLaborCost.toLocaleString('vi-VN')} đ</div>
                                <div className="font-semibold mt-1">Tổng chi phí: {savedTotalCost.toLocaleString('vi-VN')} đ</div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                                <Button onClick={() => setProposalModalVisible(false)}>Đóng</Button>
                            </div>
                        </Form.Item>
                    </Form>
                </Modal>
                <Modal
                    title="Yêu cầu đề xuất lại"
                    visible={reproposalModalVisible}
                    onCancel={() => setReproposalModalVisible(false)}
                    onOk={() => reproposalForm.submit()}
                    confirmLoading={reproposalSubmitting}
                >
                    <Form form={reproposalForm} onFinish={(values) => handleRequestReproposal(values.reason)} layout="vertical">
                        <Form.Item name="reason" label="Lý do" rules={[{ required: true, message: 'Vui lòng nhập lý do yêu cầu đề xuất lại' }] }>
                            <Input.TextArea rows={4} placeholder="Nhập yêu cầu đề xuất (bắt buộc)" />
                        </Form.Item>
                    </Form>
                </Modal>
        </CustomerLayout>
    );
};

export default OrderDetail;
