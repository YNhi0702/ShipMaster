import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout, Typography, Descriptions, Image, Button, Spin, message, Form, Input, Modal, Select, InputNumber, Row, Col, Divider, Card } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import InspectorLayout from '../../components/Inspector/InspectorLayout';

const { Header, Content } = Layout;
const { Title } = Typography;
const { TextArea } = Input;
const LABOR_DAY_RATE = 350000; // đơn giá ngày công cố định


const ProposalInspector: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [orderData, setOrderData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [shipName, setShipName] = useState('');
    const [workshopName, setWorkshopName] = useState('');
    const [shipInfo, setShipInfo] = useState<any | null>(null);
    const [employeeName, setEmployeeName] = useState('');
    const [proposalLoading, setProposalLoading] = useState(false);
    const [form] = Form.useForm();
    const [proposal, setProposal] = useState<string>('');
    const [existingProposal, setExistingProposal] = useState<string>('');
    const [proposalChanged, setProposalChanged] = useState<boolean>(false);
    const [customerRequest, setCustomerRequest] = useState<string>('');
    const [userName, setUserName] = useState('');
    const [loadingUser, setLoadingUser] = useState(true);
    const [materialsCatalog, setMaterialsCatalog] = useState<any[]>([]);
    // Saved (đã tải từ Firestore)
    const [savedMaterialLines, setSavedMaterialLines] = useState<any[]>([]);
    const [savedLaborLines, setSavedLaborLines] = useState<any[]>([]);
    // Draft (đang chỉnh trong modal, chưa lưu Firestore)
    const [materialLines, setMaterialLines] = useState<any[]>([]); // { id, materialId, name, unit, unitPrice, qty, lineTotal }
    const [modalVisible, setModalVisible] = useState<boolean>(false);
    const [laborLines, setLaborLines] = useState<any[]>([]); // { id, employeeId?, employeeName?, description, days }
    const [workshopEmployees, setWorkshopEmployees] = useState<Array<{ id: string; UserName?: string; Expertise?: string }>>([]);
    const [loadingEmployees, setLoadingEmployees] = useState<boolean>(false);
    const [submitAttempted, setSubmitAttempted] = useState<boolean>(false);

    const normalize = (str: any) =>
        String(str || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();

    useEffect(() => {
        const fetchData = async () => {
            const uid = sessionStorage.getItem('uid');
            if (!uid) {
                navigate('/login');
                return;
            }

            try {
                // Lấy thông tin giám định viên
                const userSnap = await getDoc(doc(db, "users", uid));
                if (userSnap.exists()) {
                    setUserName(userSnap.data().fullName || userSnap.data().username || "Giám định viên");
                }

                setLoadingUser(false);

                // Lấy thông tin đơn hàng
                if (id) {
                    setLoading(true);
                    const orderRef = doc(db, 'repairOrder', id);
                    const orderSnap = await getDoc(orderRef);
                    if (orderSnap.exists()) {
                        const data = orderSnap.data();
                        const existing = data?.repairplan || data?.proposal || '';
                        setOrderData({
                            id,
                            ...data,
                            createdAt: data?.StartDate?.toDate().toLocaleDateString('vi-VN'),
                        });
                        setExistingProposal(existing);
                        setProposal(existing);
                        // ensure the Antd form field is also populated so the textarea shows the existing proposal
                        try {
                            form.setFieldsValue({ proposal: existing });
                        } catch (e) {
                            // ignore if form not ready
                        }
                        // load materials catalog for material selector
                        try {
                            const mats = await getDocs(collection(db, 'material'));
                            setMaterialsCatalog(mats.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
                        } catch (e) { /* ignore */ }
                    } else {
                        message.error('Không tìm thấy đơn hàng.');
                        navigate('/inspector');
                    }
                }
            } catch (error) {
                message.error('Lỗi tải dữ liệu.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, navigate]);

    // Load existing repairordermaterial docs for this order and populate savedMaterialLines
    useEffect(() => {
        const loadExistingMaterials = async () => {
            if (!orderData?.id) return;
            try {
                const matQuery = query(collection(db, 'repairordermaterial'), where('RepairOrder_ID', '==', orderData.id));
                const snap = await getDocs(matQuery);
                if (!snap.empty) {
                    const lines = snap.docs.map(d => {
                        const data = d.data() as any;
                        const mid = data.Material_ID || data.materialId || null;
                        const qty = Math.max(1, Number(data.QuantityUsed || data.quanityused || 0) || 1);
                        const mCatalog = materialsCatalog.find(m => m.id === mid) || {};
                        const unitPrice = mCatalog.Price || mCatalog.price || 0;
                        return {
                            // keep firestore doc id so we can delete/update later
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
                    setSavedMaterialLines(lines);
                }
            } catch (e) {
                // ignore load errors but keep UI usable
                console.error('Failed to load existing repairordermaterial', e);
            }
        };
        loadExistingMaterials();
        // run when orderData or materialsCatalog changes (so names/prices can be resolved)
    }, [orderData, materialsCatalog]);

    // Load existing repairorderlabor docs for this order into savedLaborLines
    useEffect(() => {
        const loadExistingLabor = async () => {
            if (!orderData?.id) return;
            try {
                const labQuery = query(collection(db, 'repairorderlabor'), where('RepairOrder_ID', '==', orderData.id));
                const snap = await getDocs(labQuery);
                if (!snap.empty) {
                    const lines = snap.docs.map(d => {
                        const data = d.data() as any;
                        const days = Math.max(1, Number(data.Days ?? data.Quantity ?? data.qty ?? 0) || 1);
                        const description = data.Description || data.description || '';
                        const employeeId = data.Employee_ID || data.employeeId || '';
                        const employeeName = data.EmployeeName || data.employeeName || '';
                        const expertise = (data.Expertise || data.expertise || '').toString().trim();
                        return {
                            docId: d.id,
                            id: Date.now() + Math.floor(Math.random() * 1000),
                            employeeId,
                            employeeName,
                            description,
                            days,
                            expertise,
                        };
                    });
                    setSavedLaborLines(lines);
                }
            } catch (e) {
                console.error('Failed to load existing repairorderlabor', e);
            }
        };
        loadExistingLabor();
    }, [orderData]);

    // Load workshop employees with Role_ID = 5 for selection
    useEffect(() => {
        const loadEmployees = async () => {
            if (!orderData?.workshopId) { setWorkshopEmployees([]); return; }
            try {
                setLoadingEmployees(true);
                const employeesRef = collection(db, 'employees');
                const q = query(employeesRef, where('workShopID', '==', orderData.workshopId), where('Role_ID', '==', 5));
                const snap = await getDocs(q);
                const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
                setWorkshopEmployees(list);
            } catch (e) {
                setWorkshopEmployees([]);
            } finally {
                setLoadingEmployees(false);
            }
        };
        loadEmployees();
    }, [orderData?.workshopId]);

    useEffect(() => {
        if (!workshopEmployees.length) return;
        setSavedLaborLines(prev => {
            let changed = false;
            const next = prev.map(line => {
                if (line?.expertise) return line;
                const matched = workshopEmployees.find(e => e.id === line.employeeId);
                const expertise = (matched?.Expertise || '').toString().trim();
                if (!expertise) return line;
                changed = true;
                return { ...line, expertise };
            });
            return changed ? next : prev;
        });
    }, [workshopEmployees]);

    useEffect(() => {
        const fetchNames = async () => {
            if (!orderData) return;
            try {
                const [shipSnap, workshopSnap, employeeSnap] = await Promise.all([
                    getDoc(doc(db, 'ship', orderData.shipId)),
                    getDoc(doc(db, 'workShop', orderData.workshopId)),
                    getDoc(doc(db, 'users', orderData.inspectorId)),
                ]);
                if (shipSnap.exists()) {
                    const s = shipSnap.data();
                    setShipName(s.name || 'Không xác định');
                    setShipInfo(s);
                } else {
                    setShipName('Không xác định');
                    setShipInfo(null);
                }
                setWorkshopName(workshopSnap.exists() ? workshopSnap.data().name : 'Không xác định');
                setEmployeeName(employeeSnap.exists() ? employeeSnap.data().fullName : orderData.inspectorId);
            } catch (error) {
                // ignore
            }
        };
        fetchNames();
    }, [orderData]);

    const handleSubmitProposal = async (values: any) => {
        if (!orderData) return;

        const incomingPlan = (values.proposal || "").toString().trim();
        if (!incomingPlan) {
            message.error("Vui lòng nhập phương án đề xuất!");
            return;
        }

        setProposalLoading(true);
        try {
            await updateDoc(doc(db, 'repairOrder', orderData.id), {
                repairplan: incomingPlan,
                Status: 'Đã đề xuất phương án',
            });
            // Replace existing material docs for this order with the current materialLines.
            try {
                // Delete existing docs for this order first
                const existingQuery = query(collection(db, 'repairordermaterial'), where('RepairOrder_ID', '==', orderData.id));
                const existingSnap = await getDocs(existingQuery);
                for (const ed of existingSnap.docs) {
                    try {
                        await deleteDoc(doc(db, 'repairordermaterial', ed.id));
                    } catch (innerE) {
                        console.error('Failed to delete existing repairordermaterial doc', ed.id, innerE);
                    }
                }

                // Add current lines
                for (const m of materialLines) {
                    if (!m.materialId) continue;
                    await addDoc(collection(db, 'repairordermaterial'), {
                        RepairOrder_ID: orderData.id,
                        Material_ID: m.materialId,
                        QuantityUsed: Number(m.qty) || 0,
                        createdAt: serverTimestamp(),
                    });
                }
            } catch (e) {
                console.error('Failed to save repairordermaterial', e);
                // don't block the main proposal submission — show a warning
                message.warning('Đề xuất văn bản thành công nhưng lưu vật liệu gặp lỗi (xem console).');
            }

            // Replace existing labor docs with the current laborLines
            try {
                const existingLabQuery = query(collection(db, 'repairorderlabor'), where('RepairOrder_ID', '==', orderData.id));
                const existingLabSnap = await getDocs(existingLabQuery);
                for (const ed of existingLabSnap.docs) {
                    try { await deleteDoc(doc(db, 'repairorderlabor', ed.id)); } catch (innerE) { console.error('Failed to delete repairorderlabor doc', innerE); }
                }
                for (const l of laborLines) {
                    if (!l) continue;
                    await addDoc(collection(db, 'repairorderlabor'), {
                        RepairOrder_ID: orderData.id,
                        Employee_ID: l.employeeId || null,
                        EmployeeName: l.employeeName || '',
                        Expertise: l.expertise || '',
                        Description: l.description || '',
                        Days: Number(l.days) || 0,
                        Quantity: Number(l.days) || 0, // giữ tương thích dữ liệu cũ
                        UnitPrice: LABOR_DAY_RATE,
                        createdAt: serverTimestamp(),
                    });
                }
            } catch (e) {
                console.error('Failed to save repairorderlabor', e);
                message.warning('Lưu nhân công gặp lỗi (xem console).');
            }

            // update total/labor/material cost on the repairOrder so workshop can see computed values
            try {
                await updateDoc(doc(db, 'repairOrder', orderData.id), {
                    totalCost: Number(materialsCost + laborCost) || 0,
                    laborCost: Number(laborCost) || 0,
                    materialsCost: Number(materialsCost) || 0,
                });
            } catch (e) {
                console.error('Failed to update repairOrder.totalCost', e);
            }

            // close modal and inform user
            setModalVisible(false);
            setExistingProposal(proposal);
            // Sau khi lưu thành công, cập nhật bản đã lưu = bản nháp
            setSavedMaterialLines(materialLines.map(l => ({ ...l })));
            setSavedLaborLines(laborLines.map(l => ({
                ...l,
                expertise: (l?.expertise || '').toString().trim(),
            })));
            message.success('Đã gửi đề xuất phương án thành công!');
            // Navigate to inspector home and open the 'proposal' tab
            navigate('/inspector?tab=proposal', { replace: true });
        } catch (e) {
            message.error('Lỗi khi gửi đề xuất.');
        } finally {
            setProposalLoading(false);
        }
    };

    // Material modal helpers
    const addMaterialLine = () => setMaterialLines(prev => [...prev, { id: Date.now(), materialId: null, name: '', unit: '', unitPrice: 0, qty: 1, lineTotal: 0 }]);
    const updateMaterialLine = (idx: number, patch: any) => setMaterialLines(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], ...patch };
        next[idx].lineTotal = (Number(next[idx].qty) || 0) * (Number(next[idx].unitPrice) || 0);
        return next;
    });
    const removeMaterialLine = (idx: number) => setMaterialLines(prev => prev.filter((_, i) => i !== idx));

    // Labor helpers
    const addLaborLine = () => setLaborLines(prev => [...prev, { id: Date.now(), employeeId: '', employeeName: '', description: '', days: 1, expertise: '' }]);
    const updateLaborLine = (idx: number, patch: any) => setLaborLines(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], ...patch };
        return next;
    });
    const removeLaborLine = (idx: number) => setLaborLines(prev => prev.filter((_, i) => i !== idx));

    // Costs for draft (modal)
    const materialsCost = materialLines.reduce((s, x) => s + (Number(x.lineTotal) || 0), 0);
    const laborCost = laborLines.reduce((s, x) => s + (Number(x.days) || 0) * LABOR_DAY_RATE, 0);
    // Costs for saved (read-only)
    const savedMaterialsCost = savedMaterialLines.reduce((s, x) => s + (Number(x.lineTotal) || 0), 0);
    const savedLaborCost = savedLaborLines.reduce((s, x) => s + (Number(x.days) || 0) * LABOR_DAY_RATE, 0);

    // handle saving materials will be part of handleSubmitProposal to combine actions


    if (loading || !orderData) {
        return <div className="p-6"><Spin /> Đang tải dữ liệu...</div>;
    }

    const {
        createdAt,
        Status,
        invoiceId,
        totalCostId,
        imageList = {},
    } = orderData;

    return (
        <InspectorLayout
            selectedKey="proposal"
            onSelect={(key) => {
                if (key === 'orders') navigate('/inspector');
                else if (key === 'proposal') navigate('/inspector?tab=proposal');
                else if (key === 'inspected') navigate('/inspector?tab=inspected');
            }}
            userName={userName}
            loadingUser={loadingUser}
        >
            <div className="flex justify-between items-center mb-6">
                <Title level={3} className="m-0">Đề xuất phương án sửa chữa</Title>
                <Button onClick={() => navigate(-1)}>Quay lại</Button>
            </div>
            <Descriptions title="Thông tin đơn" bordered column={1}>
                <Descriptions.Item label="Tàu">{shipName}</Descriptions.Item>
                <Descriptions.Item label="Ngày tạo">{createdAt}</Descriptions.Item>
                <Descriptions.Item label="Trạng thái">{Status}</Descriptions.Item>
                <Descriptions.Item label="Xưởng">{workshopName}</Descriptions.Item>
                {orderData.description && (
                    <Descriptions.Item label="Mô tả">{orderData.description}</Descriptions.Item>
                )}

                {/* Thông tin tàu gộp chung trong bảng */}
                {shipInfo?.registration_number && (
                    <Descriptions.Item label="Số đăng ký">{shipInfo.registration_number}</Descriptions.Item>
                )}
                {shipInfo?.registered_port && (
                    <Descriptions.Item label="Cảng đăng ký">{shipInfo.registered_port}</Descriptions.Item>
                )}
                {shipInfo?.type && (
                    <Descriptions.Item label="Loại tàu">{shipInfo.type}</Descriptions.Item>
                )}
                {shipInfo?.year_built && (
                    <Descriptions.Item label="Năm đóng tàu">{shipInfo.year_built}</Descriptions.Item>
                )}
                {shipInfo?.hull_material && (
                    <Descriptions.Item label="Vật liệu vỏ">{shipInfo.hull_material}</Descriptions.Item>
                )}
                {shipInfo?.length_overall !== undefined && (
                    <Descriptions.Item label="Chiều dài (m)">{shipInfo.length_overall}</Descriptions.Item>
                )}
                {shipInfo?.width !== undefined && (
                    <Descriptions.Item label="Chiều rộng (m)">{shipInfo.width}</Descriptions.Item>
                )}
                {shipInfo?.daft !== undefined && (
                    <Descriptions.Item label="Mớn nước (m)">{shipInfo.daft}</Descriptions.Item>
                )}
                {shipInfo?.main_engine_count !== undefined && (
                    <Descriptions.Item label="Số động cơ chính">{shipInfo.main_engine_count}</Descriptions.Item>
                )}
                {shipInfo?.auxiliary_engines_count !== undefined && (
                    <Descriptions.Item label="Số động cơ phụ">{shipInfo.auxiliary_engines_count}</Descriptions.Item>
                )}
            </Descriptions>

            {/* Only show images section when there are images */}
            {Object.values(imageList as { [key: string]: string }).filter(Boolean).length > 0 && (
                <div className="mt-6">
                    <Title level={4}>Hình ảnh</Title>
                    <div className="flex gap-4 flex-wrap">
                        {Object.values(imageList as { [key: string]: string }).filter(Boolean).map((url, index) => (
                            <Image key={index} width={200} src={url} alt={`img-${index}`} />
                        ))}
                    </div>
                </div>
            )}


            <div className="mt-8">
                {/* If order already has a submitted proposal, show it (read-only) */}
                {orderData.Status === 'Đã đề xuất phương án' && (
                    <div className="mb-6">
                        <Title level={5}>Phương án đã đề xuất</Title>
                        <div className="mt-3">
                            <Input.TextArea rows={6} value={existingProposal || ''} readOnly />
                        </div>

                        <Card size="small" title="Vật liệu đề xuất" className="mt-4">
                            <Row gutter={8} className="mb-2 font-medium">
                                <Col span={12}><div>Tên</div></Col>
                                <Col span={6}><div>Số lượng</div></Col>
                                <Col span={4}><div>Chi phí</div></Col>
                                <Col span={2} />
                            </Row>

                            {savedMaterialLines.map((line, idx) => (
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
                        <Card size="small" title="Nhân công đề xuất" className="mt-4">
                            <Row gutter={8} className="mb-2 font-medium">
                                <Col span={7}><div>Nhân viên</div></Col>
                                <Col span={6}><div>Chuyên môn</div></Col>
                                <Col span={6}><div>Công việc</div></Col>
                                <Col span={2}><div>Số ngày</div></Col>
                                <Col span={3}><div>Chi phí</div></Col>
                            </Row>
                            {savedLaborLines.map((line, idx) => (
                                <Row key={line.id || idx} gutter={8} className="mb-2">
                                    <Col span={7}><div style={{ paddingTop: 6 }}>{line.employeeName || line.employeeId || '-'}</div></Col>
                                    <Col span={6}><div style={{ paddingTop: 6 }}>{line.expertise || '-'}</div></Col>
                                    <Col span={6}><div style={{ paddingTop: 6 }}>{line.description || '-'}</div></Col>
                                    <Col span={2}><div style={{ paddingTop: 6 }}>{line.days}</div></Col>
                                    <Col span={3}><div style={{ paddingTop: 6 }}>{((Number(line.days) || 0) * LABOR_DAY_RATE).toLocaleString('vi-VN')} đ</div></Col>
                                </Row>
                            ))}
                            <div className="text-right font-medium">Chi phí nhân công: {savedLaborCost.toLocaleString('vi-VN')} đ</div>
                        </Card>
                        <div className="text-right font-semibold mt-2">Tổng chi phí: {(savedMaterialsCost + savedLaborCost).toLocaleString('vi-VN')} đ</div>
                    </div>
                )}

                {/* Customer adjustment request is now loaded into the proposal textarea inside the modal (if present) */}

                {/* Show a button that opens the modal containing the full proposal + materials form */}
                {orderData.Status !== 'Đã đề xuất phương án' && (
                    <div className="mb-4">
                        <Button
                            type="primary"
                            size="large"
                            onClick={() => {
                                // If customer requested a re-proposal, show their request above the textarea (read-only)
                                if (orderData.Status === 'Yêu cầu đề xuất lại' && orderData.CustomerAdjustmentRequest && orderData.CustomerAdjustmentRequest.text) {
                                    const reqText = orderData.CustomerAdjustmentRequest.text;
                                    // keep customer's request separate from the editable proposal so the inspector edits the proposal itself
                                    setCustomerRequest(reqText);
                                    try { form.setFieldsValue({ proposal }); } catch (e) { /* ignore */ }
                                } else {
                                    setCustomerRequest('');
                                    try { form.setFieldsValue({ proposal }); } catch (e) { /* ignore */ }
                                }
                                // Khởi tạo bản nháp từ dữ liệu đã lưu để đảm bảo đóng modal không làm thay đổi bản lưu
                                try {
                                    setMaterialLines(savedMaterialLines.map(l => ({ ...l })));
                                    setLaborLines(savedLaborLines.map(l => ({
                                        ...l,
                                        expertise: (l?.expertise || '').toString().trim(),
                                    })));
                                } catch { }
                                setSubmitAttempted(false);
                                setModalVisible(true);
                            }}
                        >
                            Đề xuất
                        </Button>
                    </div>
                )}

                <Modal
                    title="Gửi đề xuất phương án sửa chữa"
                    visible={modalVisible}
                    onCancel={() => setModalVisible(false)}
                    footer={null}
                    destroyOnClose
                    width={1100}
                    bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
                >
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={async (vals) => {
                            await handleSubmitProposal(vals);
                        }}

                    >
                        {/* If customer requested a re-proposal, show their request here (read-only, non-editable) */}
                        {customerRequest && (
                            // Show the card header and display the customer's request inside the card body (read-only)
                            <Card size="small" title="Yêu cầu đề xuất của khách hàng" className="mb-4">
                                <div style={{ whiteSpace: 'pre-wrap', color: 'rgba(0,0,0,0.85)' }}>{customerRequest}</div>
                            </Card>
                        )}

                        <Form.Item
                            label="Phương án đề xuất"
                            name="proposal"
                            rules={[{ required: true, message: 'Vui lòng nhập phương án đề xuất!' }]}
                        >
                            <Input.TextArea
                                rows={6}
                                placeholder="Mô tả phương án sửa chữa cụ thể: thay thế, hàn, gia công, làm mới, vật tư cần thiết, thời gian dự kiến..."
                            />
                        </Form.Item>

                        <Form.Item>
                            <Card size="small" title="Vật liệu đề xuất" className="mb-4">
                                <div className="mb-2">
                                    <Button type="dashed" onClick={addMaterialLine}>+ Thêm vật liệu</Button>
                                </div>
                                {materialLines.map((line, idx) => (
                                    <Row key={line.id} gutter={8} className="mb-2">
                                        <Col span={12}>
                                            <Select
                                                showSearch
                                                placeholder="Chọn vật liệu"
                                                value={line.materialId}
                                                onChange={(val) => {
                                                    const m = materialsCatalog.find(x => x.id === val) || { Name: '', Unit: '', Price: 0 };
                                                    updateMaterialLine(idx, { materialId: val, name: m.Name || m.name || '', unit: m.Unit || m.unit || '', unitPrice: m.Price || m.price || 0 });
                                                }}
                                                options={materialsCatalog.map(m => ({ label: m.Name || m.name, value: m.id }))}
                                            />
                                        </Col>
                                        <Col span={6}>
                                            <InputNumber min={1} style={{ width: '100%' }} value={line.qty} onChange={(v) => updateMaterialLine(idx, { qty: Math.max(1, Number(v) || 1) })} />
                                        </Col>
                                        <Col span={4}>
                                            <div style={{ paddingTop: 6 }}>{(Number(line.lineTotal) || 0).toLocaleString('vi-VN')} đ</div>
                                        </Col>
                                        <Col span={2}>
                                            <Button danger size="small" onClick={() => removeMaterialLine(idx)}>Xóa</Button>
                                        </Col>
                                    </Row>
                                ))}
                                <div className="text-right font-medium">Chi phí vật liệu: {materialsCost.toLocaleString('vi-VN')} đ</div>
                            </Card>

                            <Card size="small" title="Nhân công đề xuất" className="mb-4">
                                <div className="mb-2">
                                    <Button type="dashed" onClick={addLaborLine}>+ Thêm nhân công</Button>
                                </div>
                                <Row gutter={8} className="mb-2 font-medium">
                                    <Col span={7}><div>Nhân viên</div></Col>
                                    <Col span={6}><div>Chuyên môn</div></Col>
                                    <Col span={6}><div>Công việc</div></Col>
                                    <Col span={2}><div>Số ngày</div></Col>
                                    <Col span={2}><div>Chi phí</div></Col>
                                    <Col span={1}></Col>
                                </Row>
                                {laborLines.map((line, idx) => (
                                    <Row key={line.id} gutter={8} className="mb-2">
                                        <Col span={7}>
                                            <Select
                                                showSearch
                                                placeholder={loadingEmployees ? 'Đang tải...' : 'Chọn nhân viên'}
                                                value={line.employeeId || undefined}
                                                onChange={(val, opt: any) => {
                                                    const expertise = ((opt?.expertise as string) || '').toString().trim();
                                                    updateLaborLine(idx, {
                                                        employeeId: val,
                                                        employeeName: (opt?.label as string) || '',
                                                        expertise,
                                                    });
                                                }}
                                                options={(function () {
                                                    const selected = new Set(laborLines.map(l => l.employeeId).filter(Boolean));
                                                    return workshopEmployees.map(e => ({
                                                        label: e.UserName || e.id,
                                                        value: e.id,
                                                        disabled: selected.has(e.id) && e.id !== line.employeeId,
                                                        expertise: (e.Expertise || '').toString().trim(),
                                                    }));
                                                })()}
                                                filterOption={(input, option) => {
                                                    const label = (option?.label as string) || '';
                                                    const expertise = (option as any)?.expertise || '';
                                                    const haystack = `${label} ${expertise}`.toLowerCase();
                                                    return haystack.includes(input.toLowerCase());
                                                }}
                                                loading={loadingEmployees}
                                            />
                                        </Col>
                                        <Col span={6}>
                                            <Input
                                                placeholder="Chuyên môn"
                                                value={line.expertise || ''}
                                                disabled
                                            />
                                        </Col>
                                        <Col span={6}>
                                            <Form.Item
                                                style={{ marginBottom: 0 }}
                                                validateStatus={submitAttempted && !String(line.description || '').trim() ? 'error' : ''}
                                                help={submitAttempted && !String(line.description || '').trim() ? 'Bắt buộc nhập công việc' : undefined}
                                            >
                                                <Input
                                                    placeholder="Công việc (VD: sơn, hàn...)"
                                                    value={line.description}
                                                    onChange={(e) => updateLaborLine(idx, { description: e.target.value })}
                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col span={2}>
                                            <InputNumber min={1} style={{ width: '100%' }} value={line.days} onChange={(v) => updateLaborLine(idx, { days: Math.max(1, Number(v) || 1) })} />
                                        </Col>
                                        <Col span={2}>
                                            <div style={{ paddingTop: 6 }}>{((Number(line.days) || 0) * LABOR_DAY_RATE).toLocaleString('vi-VN')} đ</div>
                                        </Col>
                                        <Col span={1}>
                                            <Button danger size="small" onClick={() => removeLaborLine(idx)}>Xóa</Button>
                                        </Col>
                                    </Row>
                                ))}
                                <div className="text-right font-medium">Chi phí nhân công: {laborCost.toLocaleString('vi-VN')} đ</div>
                            </Card>
                            <div className="text-right font-semibold mt-3">Tổng chi phí: {(materialsCost + laborCost).toLocaleString('vi-VN')} đ</div>

                            <div style={{ textAlign: 'right', marginTop: 20 }}>
                                <Button style={{ marginRight: 8 }} onClick={() => { setSubmitAttempted(false); setModalVisible(false); }}>Hủy</Button>
                                <Button type="primary" onClick={() => { setSubmitAttempted(true); form.submit(); }} loading={proposalLoading}>Gửi đề xuất phương án</Button>
                            </div>
                        </Form.Item>
                    </Form>
                </Modal>
            </div>
        </InspectorLayout>
    );
};

export default ProposalInspector;
