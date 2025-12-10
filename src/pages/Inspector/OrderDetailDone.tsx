import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Typography, Descriptions, Image, Button, Spin, message, Card, Row, Col } from 'antd';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import InspectorSidebar from '../../components/Inspector/InspectorSidebar';
import InspectorLayout from '../../components/Inspector/InspectorLayout';

const LABOR_DAY_RATE = 350000; // đơn giá theo ngày công

const { Title } = Typography;

const OrderDetailDone: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [orderData, setOrderData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [shipName, setShipName] = useState('');
    const [shipInfo, setShipInfo] = useState<any | null>(null);
    const [workshopName, setWorkshopName] = useState('');
    const [employeeName, setEmployeeName] = useState('');
    const [materialsCatalog, setMaterialsCatalog] = useState<any[]>([]);
    const [materialLines, setMaterialLines] = useState<any[]>([]);
    const [userName, setUserName] = useState('');
    const [loadingUser, setLoadingUser] = useState(true);
    const [laborLines, setLaborLines] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            const uid = sessionStorage.getItem('uid');
            if (!uid) {
                navigate('/login');
                return;
            }

            try {
                const employeesRef = collection(db, 'employees');
                const empQuery = query(employeesRef, where('__name__', '==', uid));
                const empSnapshot = await getDocs(empQuery);
                if (!empSnapshot.empty) {
                    setUserName(empSnapshot.docs[0].data().UserName || 'Giám định viên');
                }
                setLoadingUser(false);

                if (id) {
                    setLoading(true);
                    const orderRef = doc(db, 'repairOrder', id);
                    const orderSnap = await getDoc(orderRef);
                    if (orderSnap.exists()) {
                        const data = orderSnap.data();
                        setOrderData({ id, ...data, createdAt: data?.StartDate?.toDate().toLocaleDateString('vi-VN') });
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

    useEffect(() => {
        const fetchNames = async () => {
            if (!orderData) return;
            try {
                if (orderData.shipId) {
                    const shipSnap = await getDoc(doc(db, 'ship', orderData.shipId));
                    if (shipSnap.exists()) {
                        const s = shipSnap.data();
                        setShipName(s.name || 'Không xác định');
                        setShipInfo(s);
                    } else {
                        setShipName('Không xác định');
                        setShipInfo(null);
                    }
                } else {
                    setShipName('Không xác định');
                    setShipInfo(null);
                }
            } catch {
                setShipName('Không xác định');
                setShipInfo(null);
            }

            try {
                if (orderData.workshopId) {
                    const workshopSnap = await getDoc(doc(db, 'workShop', orderData.workshopId));
                    setWorkshopName(workshopSnap.exists() ? workshopSnap.data().name : 'Không xác định');
                } else {
                    setWorkshopName('Không xác định');
                }
            } catch {
                setWorkshopName('Không xác định');
            }

            try {
                if (orderData.inspectorId) {
                    const employeeSnap = await getDoc(doc(db, 'employees', orderData.inspectorId));
                    setEmployeeName(employeeSnap.exists() ? (employeeSnap.data().fullName || employeeSnap.data().UserName || orderData.inspectorId) : orderData.inspectorId);
                } else {
                    setEmployeeName('');
                }
            } catch {
                setEmployeeName(orderData.inspectorId || '');
            }
        };
        fetchNames();
    }, [orderData]);

    // load material catalog and repair order materials for display
    useEffect(() => {
        const loadMaterials = async () => {
            if (!orderData?.id) return;
            try {
                const matsSnap = await getDocs(collection(db, 'material'));
                const catalog = matsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
                setMaterialsCatalog(catalog);

                const q = query(collection(db, 'repairordermaterial'), where('RepairOrder_ID', '==', orderData.id));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const lines = snap.docs.map(d => {
                        const data = d.data() as any;
                        const mid = data.Material_ID || data.materialId || null;
                        const qty = Number(data.QuantityUsed || data.quanityused || 0);
                        const m = catalog.find(c => c.id === mid) || {};
                        const unitPrice = Number(m.Price || m.price || 0);
                        return {
                            id: d.id,
                            materialId: mid,
                            name: m.Name || m.name || mid || 'Vật liệu',
                            unit: m.Unit || m.unit || '',
                            qty,
                            unitPrice,
                            lineTotal: qty * unitPrice,
                        };
                    });
                    setMaterialLines(lines);
                } else {
                    setMaterialLines([]);
                }
            } catch (e) {
                console.error('Failed to load materials for order', e);
            }
        };
        loadMaterials();
    }, [orderData]);

    // load repair order labor lines for display
    useEffect(() => {
        const loadLabor = async () => {
            if (!orderData?.id) return;
            try {
                const labQ = query(collection(db, 'repairorderlabor'), where('RepairOrder_ID', '==', orderData.id));
                const snap = await getDocs(labQ);
                if (!snap.empty) {
                    const lines = snap.docs.map(d => {
                        const data = d.data() as any;
                        const days = Math.max(1, Number(data.Days ?? data.Quantity ?? 0) || 1);
                        return {
                            id: d.id,
                            employeeId: data.Employee_ID || data.employeeId || '',
                            employeeName: data.EmployeeName || data.employeeName || '',
                            description: data.Description || data.description || '',
                            days,
                        };
                    });
                    setLaborLines(lines);
                } else {
                    setLaborLines([]);
                }
            } catch (e) {
                console.error('Failed to load labor for order', e);
            }
        };
        loadLabor();
    }, [orderData]);

    const materialsCost = materialLines.reduce((s, x) => s + (Number(x.lineTotal) || 0), 0);
    const laborCost = laborLines.reduce((s, x) => s + (Number(x.days) || 0) * LABOR_DAY_RATE, 0);

    if (loading || !orderData) return <div className="p-6"><Spin /> Đang tải dữ liệu...</div>;

    const { createdAt, Status, description, imageList = {}, repairplan, proposal } = orderData;

    return (
        <InspectorLayout
            // make this page inherit the inspector layout and highlight the "Đã giám định" tab
            selectedKey="inspected"
            onSelect={(key) => {
                if (key === 'orders') navigate('/inspector');
                else if (key === 'proposal') navigate('/inspector?tab=proposal');
                else if (key === 'inspected') navigate('/inspector?tab=inspected');
            }}
            userName={userName}
            loadingUser={loadingUser}
        >
            <div className="flex justify-between items-center mb-6">
                <Title level={4} className="m-0">Chi tiết đơn sửa chữa</Title>
                <Button onClick={() => navigate(-1)}>Quay lại</Button>
            </div>

            <Descriptions title="Thông tin đơn" bordered column={1}>
                <Descriptions.Item label="Ngày tạo">{createdAt}</Descriptions.Item>
                <Descriptions.Item label="Trạng thái">{Status}</Descriptions.Item>
                <Descriptions.Item label="Tàu">{shipName}</Descriptions.Item>
                <Descriptions.Item label="Xưởng">{workshopName}</Descriptions.Item>
                {orderData.description && <Descriptions.Item label="Mô tả">{orderData.description}</Descriptions.Item>}

                {/* Ship detailed info (if available) */}
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

            {(repairplan || proposal) && (
                <div className="mt-8 max-w-xl">
                    <Title level={4}>Phương án đã đề xuất</Title>
                    <div className="bg-gray-50 p-4 rounded border border-gray-200 whitespace-pre-line">{repairplan || proposal}</div>

                    {/* Materials breakdown (if any) */}
                    {materialLines.length > 0 && (
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

                            <div className="text-right font-medium">Chi phí vật liệu: {materialsCost.toLocaleString('vi-VN')} đ</div>
                        </Card>
                    )}

                    {/* Labor breakdown (if any) */}
                    {laborLines.length > 0 && (
                        <Card size="small" title="Nhân công đề xuất" className="mt-4">
                            <Row gutter={8} className="mb-2 font-medium">
                                <Col span={8}><div>Nhân viên</div></Col>
                                <Col span={8}><div>Công việc</div></Col>
                                <Col span={4}><div>Số ngày</div></Col>
                                <Col span={4}><div>Chi phí</div></Col>
                            </Row>
                            {laborLines.map((line, idx) => (
                                <Row key={line.id || idx} gutter={8} className="mb-2">
                                    <Col span={8}><div style={{ paddingTop: 6 }}>{line.employeeName || line.employeeId || '-'}</div></Col>
                                    <Col span={8}><div style={{ paddingTop: 6 }}>{line.description || '-'}</div></Col>
                                    <Col span={4}><div style={{ paddingTop: 6 }}>{line.days}</div></Col>
                                    <Col span={4}><div style={{ paddingTop: 6 }}>{((Number(line.days)||0)*LABOR_DAY_RATE).toLocaleString('vi-VN')} đ</div></Col>
                                </Row>
                            ))}
                            <div className="text-right font-medium">Chi phí nhân công: {laborCost.toLocaleString('vi-VN')} đ</div>
                        </Card>
                    )}

                    {(materialLines.length > 0 || laborLines.length > 0) && (
                        <div className="text-right font-semibold mt-2">Tổng chi phí: {(materialsCost + laborCost).toLocaleString('vi-VN')} đ</div>
                    )}
                </div>
            )}

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
        </InspectorLayout>
    );
};

export default OrderDetailDone;
