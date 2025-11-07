import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Descriptions, Spin, Button, Typography, message, Row, Col, Card, Input } from 'antd';
import moment from 'moment';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import WorkshopLayout from '../components/WorkshopLayout';

const { Title } = Typography;
const LABOR_DAY_RATE = 350000; // đơn giá ngày công cố định

const OrderInfo: React.FC = () => {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState<any | null>(null);
    const [ship, setShip] = useState<any | null>(null);
    const [customer, setCustomer] = useState<any | null>(null);
    const [workshopName, setWorkshopName] = useState<string | null>(null);
    const [headerName, setHeaderName] = useState<string>('');
    const [materialsCatalog, setMaterialsCatalog] = useState<any[]>([]);
    const [materialLines, setMaterialLines] = useState<any[]>([]);
    const [laborLines, setLaborLines] = useState<any[]>([]);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                // If parent passed state, prefer it (faster UI), but still try to fetch fresh
                let orderData = (location.state as any) || null;
                if (!orderData && id) {
                    const oSnap = await getDoc(doc(db, 'repairOrder', id));
                    if (oSnap.exists()) orderData = oSnap.data();
                }
                if (!orderData) {
                    message.error('Không tìm thấy dữ liệu đơn.');
                    setLoading(false);
                    return;
                }
                setOrder({ id, ...orderData });

                // load ship if present
                try {
                    const shipId = orderData?.shipId;
                    if (shipId) {
                        const sSnap = await getDoc(doc(db, 'ship', shipId));
                        if (sSnap.exists()) setShip(sSnap.data());
                    }
                } catch (e) {
                    // ignore
                }

                // load customer / creator: try several collections (users, customers) and fallback to email lookup
                try {
                    const candidateIds = [
                        orderData?.createdBy,
                        orderData?.userId,
                        orderData?.customerId,
                        orderData?.uid,
                        orderData?.creatorId,
                        orderData?.owner,
                    ];
                    let cust: any = null;
                    for (const cid of candidateIds) {
                        if (!cid) continue;
                        // try users collection
                        try {
                            const uSnap = await getDoc(doc(db, 'users', cid));
                            if (uSnap.exists()) {
                                cust = uSnap.data();
                                break;
                            }
                        } catch (e) {
                            // ignore
                        }
                        // try customers collection (some projects store customers separately)
                        try {
                            const cSnap = await getDoc(doc(db, 'customers', cid));
                            if (cSnap.exists()) {
                                cust = cSnap.data();
                                break;
                            }
                        } catch (e) {
                            // ignore
                        }
                    }

                    // fallback: try to find by email in customers collection
                    if (!cust && orderData?.email) {
                        try {
                            const q = query(collection(db, 'customers'), where('email', '==', orderData.email));
                            const snaps = await getDocs(q);
                            if (!snaps.empty) {
                                cust = snaps.docs[0].data();
                            }
                        } catch (e) {
                            // ignore
                        }
                    }

                    // final fallback: try users collection by email
                    if (!cust && orderData?.email) {
                        try {
                            const q2 = query(collection(db, 'users'), where('Email', '==', orderData.email));
                            const snaps2 = await getDocs(q2);
                            if (!snaps2.empty) cust = snaps2.docs[0].data();
                        } catch (e) {
                            // ignore
                        }
                    }

                    setCustomer(cust);
                    // set headerName from the order's creator (customer) if available
                    let creatorName = cust?.fullName || cust?.UserName || cust?.name || orderData?.createdByName || orderData?.createdBy || '';

                    // If header is still empty, resolve current signed-in workshop user's name (like WorkshopHome)
                    if (!creatorName) {
                        try {
                            const uid = auth?.currentUser?.uid;
                            let resolvedName: string | null = null;

                            if (uid) {
                                // users collection
                                try {
                                    const userSnap = await getDoc(doc(db, 'users', uid));
                                    if (userSnap.exists()) {
                                        const u = userSnap.data();
                                        resolvedName = (u as any)?.UserName || (u as any)?.fullName || (u as any)?.name || (u as any)?.displayName || null;
                                    }
                                } catch {}
                            }

                            // fallback by email from employees
                            if (!resolvedName) {
                                const email = auth?.currentUser?.email;
                                if (email) {
                                    try {
                                        const empQ = query(collection(db, 'employees'), where('Email', '==', email));
                                        const empSnap = await getDocs(empQ);
                                        if (!empSnap.empty) {
                                            const emp = empSnap.docs[0].data() as any;
                                            resolvedName = emp?.UserName || emp?.fullName || emp?.name || null;
                                        }
                                    } catch {}
                                }
                            }

                            // try workShop doc id == uid
                            if (!resolvedName && auth?.currentUser?.uid) {
                                try {
                                    const wsDoc = await getDoc(doc(db, 'workShop', auth.currentUser.uid));
                                    if (wsDoc.exists()) resolvedName = (wsDoc.data() as any).name || null;
                                } catch {}
                            }

                            if (!resolvedName) resolvedName = auth?.currentUser?.displayName || 'Chủ xưởng';
                            creatorName = resolvedName || '';
                        } catch {}
                    }

                    setHeaderName(creatorName || '');
                } catch (e) {
                    // ignore
                }

                // load workshop name if embedded or referenced
                try {
                    if (orderData?.workshopId) {
                        const wSnap = await getDoc(doc(db, 'workShop', orderData.workshopId));
                        if (wSnap.exists()) setWorkshopName(wSnap.data().name || null);
                    } else if (orderData?.workshop) {
                        // if workshop stored as string id or object
                        const w = orderData.workshop;
                        if (typeof w === 'string') {
                            const wSnap = await getDoc(doc(db, 'workShop', w));
                            if (wSnap.exists()) setWorkshopName(wSnap.data().name || null);
                        } else if (typeof w === 'object' && w !== null) {
                            setWorkshopName(w.name || w.title || null);
                        }
                    }
                } catch (e) {
                    // ignore
                }

                // load material catalog (for price/name lookup) and then repairordermaterial
                try {
                    const matsSnap = await getDocs(collection(db, 'material'));
                    const mats = matsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
                    setMaterialsCatalog(mats);

                    if (orderData?.id) {
                        const q = query(collection(db, 'repairordermaterial'), where('RepairOrder_ID', '==', orderData.id));
                        const snap = await getDocs(q);
                        if (!snap.empty) {
                            const lines = snap.docs.map(d => {
                                const data = d.data() as any;
                                const mid = data.Material_ID || data.materialId || null;
                                const qty = Number(data.QuantityUsed || data.quanityused || 0);
                                const mCatalog = (Array.isArray(mats) ? mats.find(m => m.id === mid) : undefined) || {};
                                const unitPrice = mCatalog.Price || mCatalog.price || 0;
                                return {
                                    docId: d.id,
                                    id: Date.now() + Math.floor(Math.random() * 1000) + Math.floor(Math.random() * 1000),
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
                        // load labor lines as well
                        try {
                            const lq = query(collection(db, 'repairorderlabor'), where('RepairOrder_ID', '==', orderData.id));
                            const lsnap = await getDocs(lq);
                            if (!lsnap.empty) {
                                const ll = lsnap.docs.map(d => {
                                    const data = d.data() as any;
                                    const days = Math.max(1, Number(data.Days ?? data.Quantity ?? data.qty ?? 0) || 1);
                                    const unitPrice = Number(data.UnitPrice || LABOR_DAY_RATE);
                                    return {
                                        id: d.id,
                                        employeeId: data.Employee_ID || data.employeeId || '',
                                        employeeName: data.EmployeeName || data.employeeName || '',
                                        description: data.Description || data.description || '',
                                        days,
                                        unitPrice,
                                        lineTotal: days * unitPrice,
                                    };
                                });
                                setLaborLines(ll);
                            }
                        } catch (e2) { /* ignore */ }
                    }
                } catch (e) {
                    // ignore
                }
            } catch (err) {
                console.error(err);
                message.error('Lỗi khi tải thông tin đơn');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, location.state]);

    if (loading) return <Spin />;

    // Costs: prefer saved on repairOrder, else compute from lines
    const computedMaterials = materialLines.reduce((s, x) => s + (Number(x.lineTotal) || 0), 0);
    const computedLabor = laborLines.reduce((s, x) => s + (Number(x.lineTotal) || 0), 0);
    const materialsCost = (order?.materialsCost !== undefined && order?.materialsCost !== null) ? Number(order.materialsCost) : computedMaterials;
    const laborCost = (order?.laborCost !== undefined && order?.laborCost !== null) ? Number(order.laborCost) : computedLabor;
    const totalCost = (order?.totalCost !== undefined && order?.totalCost !== null) ? Number(order.totalCost) : (materialsCost + laborCost);

    return (
        <WorkshopLayout selectedKey="orders" onSelect={(k) => { if (k === 'schedule') navigate('/workshop?tab=schedule'); else navigate('/workshop'); }} userName={headerName} loadingUser={false}>
            {/* keep default margins so content has comfortable left/right spacing */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <Title level={4} className="m-0">Thông tin chi tiết đơn sửa chữa</Title>
                    <Button onClick={() => navigate(-1)}>Quay lại</Button>
                </div>

                <Descriptions title="Thông tin đơn" bordered column={1}>
                    <Descriptions.Item label="Trạng thái">{order?.Status || order?.status || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Ngày tạo">
                        {(() => {
                            const fmt = (v: any) => {
                                if (!v) return undefined;
                                try {
                                    if (typeof v === 'string') {
                                        const m = moment(v);
                                        return m.isValid() ? m.format('DD/MM/YYYY HH:mm') : undefined;
                                    }
                                    if (typeof v === 'number') {
                                        const m = moment(v);
                                        return m.isValid() ? m.format('DD/MM/YYYY HH:mm') : undefined;
                                    }
                                    if (v?.toDate) {
                                        const m = moment(v.toDate());
                                        return m.isValid() ? m.format('DD/MM/YYYY HH:mm') : undefined;
                                    }
                                    if (typeof v === 'object' && v?.seconds) {
                                        const m = moment(v.seconds * 1000);
                                        return m.isValid() ? m.format('DD/MM/YYYY HH:mm') : undefined;
                                    }
                                    const m = moment(v);
                                    return m.isValid() ? m.format('DD/MM/YYYY HH:mm') : undefined;
                                } catch {
                                    return undefined;
                                }
                            };

                            const candidates = [
                                order?.StartDate,
                                order?.startDate,
                                order?.CreatedAt,
                                order?.createdAt,
                                order?.CreateDate,
                                order?.createDate,
                                order?.DateCreated,
                                order?.dateCreated,
                                order?.created_on,
                                order?.createdOn,
                            ];
                            for (const c of candidates) {
                                const out = fmt(c);
                                if (out) return out;
                            }
                            return '—';
                        })()}
                    </Descriptions.Item>
                    <Descriptions.Item label="Tóm tắt hỏng hóc">
                        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{order?.Description || order?.description || order?.RepairContent || '—'}</div>
                    </Descriptions.Item>
                </Descriptions>

                <div style={{ height: 16 }} />

                <Descriptions title="Thông tin tàu" bordered column={1}>
                    <Descriptions.Item label="Tên tàu">{ship?.name || '—'}</Descriptions.Item>
                    {ship?.registration_number && (
                        <Descriptions.Item label="Số đăng ký">{ship.registration_number}</Descriptions.Item>
                    )}
                    {ship?.registered_port && (
                        <Descriptions.Item label="Cảng đăng ký">{ship.registered_port}</Descriptions.Item>
                    )}
                    {ship?.type && (
                        <Descriptions.Item label="Loại tàu">{ship.type}</Descriptions.Item>
                    )}
                    {ship?.year_built && (
                        <Descriptions.Item label="Năm đóng tàu">{ship.year_built}</Descriptions.Item>
                    )}
                    {ship?.hull_material && (
                        <Descriptions.Item label="Vật liệu vỏ">{ship.hull_material}</Descriptions.Item>
                    )}
                    {ship?.length_overall !== undefined && (
                        <Descriptions.Item label="Chiều dài (m)">{ship.length_overall}</Descriptions.Item>
                    )}
                    {ship?.width !== undefined && (
                        <Descriptions.Item label="Chiều rộng (m)">{ship.width}</Descriptions.Item>
                    )}
                    {ship?.daft !== undefined && (
                        <Descriptions.Item label="Mớn nước (m)">{ship.daft}</Descriptions.Item>
                    )}
                    {ship?.main_engine_count !== undefined && (
                        <Descriptions.Item label="Số động cơ chính">{ship.main_engine_count}</Descriptions.Item>
                    )}
                    {ship?.auxiliary_engines_count !== undefined && (
                        <Descriptions.Item label="Số động cơ phụ">{ship.auxiliary_engines_count}</Descriptions.Item>
                    )}
                </Descriptions>

                <div style={{ height: 16 }} />

                {/* Customer info removed by request */}

                <Descriptions title="Thông tin xưởng" bordered column={1}>
                    <Descriptions.Item label="Xưởng">{workshopName || '—'}</Descriptions.Item>
                </Descriptions>

                {((order as any)?.repairplan || materialLines.length > 0) && (
                    <div className="mt-6 w-full">
                        {(order as any)?.repairplan && (
                            <div>
                                <div className="flex justify-between items-start">
                                    <Title level={4} className="m-0">Phương án sửa chữa</Title>
                                </div>

                                <div className="mt-3 w-full">
                                    <Card size="small" bodyStyle={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                        {(order as any).repairplan || ''}
                                    </Card>
                                </div>
                            </div>
                        )}

                        {materialLines.length > 0 && (
                            <Card size="small" title="Vật liệu đề xuất" className="mt-4" style={{ width: '100%' }}>
                                <Row gutter={8} className="mb-2 font-medium">
                                    <Col span={10}><div>Tên</div></Col>
                                    <Col span={4}><div>Đơn vị</div></Col>
                                    <Col span={4}><div>Số lượng</div></Col>
                                    <Col span={4}><div>Đơn giá</div></Col>
                                    <Col span={2}><div>Tổng</div></Col>
                                </Row>

                                {materialLines.map((line, idx) => (
                                    <Row key={line.id || idx} gutter={8} className="mb-2">
                                        <Col span={10}>
                                            <div style={{ paddingTop: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{line.name || line.materialId || 'Vật liệu'}</div>
                                        </Col>
                                        <Col span={4}>
                                            <div style={{ paddingTop: 6 }}>{line.unit || '-'}</div>
                                        </Col>
                                        <Col span={4}>
                                            <div style={{ paddingTop: 6 }}>{line.qty}</div>
                                        </Col>
                                        <Col span={4}>
                                            <div style={{ paddingTop: 6 }}>{(Number(line.unitPrice) || 0).toLocaleString('vi-VN')} đ</div>
                                        </Col>
                                        <Col span={2}>
                                            <div style={{ paddingTop: 6 }}>{(Number(line.lineTotal) || 0).toLocaleString('vi-VN')} đ</div>
                                        </Col>
                                    </Row>
                                ))}

                                <div className="text-right font-medium">Chi phí vật liệu: {materialLines.reduce((s, x) => s + (Number(x.lineTotal) || 0), 0).toLocaleString('vi-VN')} đ</div>
                            </Card>
                        )}

                        {laborLines.length > 0 && (
                            <Card size="small" title="Nhân công đề xuất" className="mt-4" style={{ width: '100%' }}>
                                <Row gutter={8} className="mb-2 font-medium">
                                    <Col span={12}><div>Nhân viên</div></Col>
                                    <Col span={8}><div>Công việc</div></Col>
                                    <Col span={4}><div>Số ngày</div></Col>
                                </Row>

                                {laborLines.map((line, idx) => (
                                    <Row key={line.id || idx} gutter={8} className="mb-2">
                                        <Col span={12}>
                                            <div style={{ paddingTop: 6 }}>{line.employeeName || line.employeeId || '-'}</div>
                                        </Col>
                                        <Col span={8}>
                                            <div style={{ paddingTop: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{line.description || '-'}</div>
                                        </Col>
                                        <Col span={4}>
                                            <div style={{ paddingTop: 6 }}>{line.days}</div>
                                        </Col>
                                    </Row>
                                ))}

                                <div className="text-right font-medium">Chi phí nhân công: {laborLines.reduce((s, x) => s + (Number(x.lineTotal) || 0), 0).toLocaleString('vi-VN')} đ</div>
                            </Card>
                        )}
                        {(materialLines.length > 0 || laborLines.length > 0) && (
                            <div className="text-right font-semibold mt-2">Tổng chi phí: {(materialLines.reduce((s, x) => s + (Number(x.lineTotal) || 0), 0) + laborLines.reduce((s, x) => s + (Number(x.lineTotal) || 0), 0)).toLocaleString('vi-VN')} đ</div>
                        )}
                    </div>
                )}
            </div>
        </WorkshopLayout>
    );
};

export default OrderInfo;
