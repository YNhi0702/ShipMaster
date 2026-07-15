import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Descriptions, Spin, Button, Typography, message, Row, Col, Card, Input } from 'antd';
import moment from 'moment';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import WorkshopLayout from '../../components/Workshop/WorkshopLayout';

const { Title } = Typography;

// Bảng giá nhân công cơ bản theo chuyên môn
const EXPERTISE_RATES: { [key: string]: number } = {
    'Thợ hàn / cơ khí vỏ tàu': 600000,
    'Thợ máy tàu': 800000,
    'Thợ điện tàu': 650000,
    'Thợ sơn / vệ sinh tàu': 450000,
};

/**
 * Hàm tính toán đơn giá nhân công dựa vào tay nghề chuyên môn của thợ
 */
const getExpertiseRate = (expertise: string): number => {
    if (!expertise) return 350000;
    const normalized = expertise.trim().toLowerCase();
    
    // Tách chuỗi chuyên môn và bậc tay nghề (VD: "Thợ điện tàu - Bậc 3")
    const parts = normalized.split(' - ');
    const baseExp = parts[0] ? parts[0].trim() : '';
    const levelStr = parts[1] ? parts[1].trim() : '';

    let baseRate = 350000;
    for (const [key, rate] of Object.entries(EXPERTISE_RATES)) {
        if (key.toLowerCase() === baseExp) {
            baseRate = rate;
            break;
        }
    }

    if (levelStr === 'bậc 1') {
        return baseRate * 0.8;
    } else if (levelStr === 'bậc 3') {
        return baseRate * 1.25;
    }
    return baseRate;
};

const OrderInfo: React.FC = () => {
    const { id } = useParams(); // Lấy ID của đơn sửa chữa trên URL
    const location = useLocation();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true); // Trạng thái tải dữ liệu
    const [order, setOrder] = useState<any | null>(null); // Lưu thông tin đơn sửa chữa
    const [ship, setShip] = useState<any | null>(null); // Lưu thông tin tàu của đơn
    const [customer, setCustomer] = useState<any | null>(null); // Lưu thông tin khách hàng sở hữu đơn
    const [workshopName, setWorkshopName] = useState<string | null>(null); // Lưu tên xưởng sửa chữa tiếp nhận
    const [headerName, setHeaderName] = useState<string>(''); // Tên chủ xưởng hiển thị ở Header
    const [materialsCatalog, setMaterialsCatalog] = useState<any[]>([]); // Danh mục mẫu vật tư
    const [materialLines, setMaterialLines] = useState<any[]>([]); // Dòng vật tư đã gán
    const [laborLines, setLaborLines] = useState<any[]>([]); // Dòng nhân công đã gán

    // Hàm tải dữ liệu chi tiết tổng hợp
    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                // Ưu tiên nạp dữ liệu truyền nhanh từ Router State để tăng tốc độ phản hồi UI
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

                // 1. Tải thông tin chi tiết Tàu sửa chữa của đơn
                try {
                    const shipId = orderData?.shipId;
                    if (shipId) {
                        const sSnap = await getDoc(doc(db, 'ship', shipId));
                        if (sSnap.exists()) setShip(sSnap.data());
                    }
                } catch (e) { /* Bỏ qua */ }

                // 2. Tải thông tin tài khoản Khách hàng thông qua khóa ngoại 'uid'
                try {
                    const cid = orderData?.uid;
                    let cust: any = null;
                    if (cid) {
                        try {
                            const uSnap = await getDoc(doc(db, 'users', cid));
                            if (uSnap.exists()) {
                                cust = uSnap.data();
                            }
                        } catch (e) { /* Bỏ qua */ }
                        
                        if (!cust) {
                            try {
                                const cSnap = await getDoc(doc(db, 'customers', cid));
                                if (cSnap.exists()) {
                                    cust = cSnap.data();
                                }
                            } catch (e) { /* Bỏ qua */ }
                        }
                    }

                    // Dự phòng nếu không tìm thấy bằng ID, truy vấn dựa theo email
                    if (!cust && orderData?.email) {
                        try {
                            const q = query(collection(db, 'customers'), where('email', '==', orderData.email));
                            const snaps = await getDocs(q);
                            if (!snaps.empty) {
                                cust = snaps.docs[0].data();
                            }
                        } catch (e) { /* Bỏ qua */ }
                    }

                    if (!cust && orderData?.email) {
                        try {
                            const q2 = query(collection(db, 'users'), where('Email', '==', orderData.email));
                            const snaps2 = await getDocs(q2);
                            if (!snaps2.empty) cust = snaps2.docs[0].data();
                        } catch (e) { /* Bỏ qua */ }
                    }

                    setCustomer(cust);
                    
                    // Xác định tên hiển thị trên header (Tên chủ xưởng đang đăng nhập)
                    let creatorName = cust?.fullName || cust?.UserName || cust?.name || orderData?.createdByName || orderData?.createdBy || '';

                    if (!creatorName) {
                        try {
                            const uid = auth?.currentUser?.uid;
                            let resolvedName: string | null = null;

                            if (uid) {
                                try {
                                    const userSnap = await getDoc(doc(db, 'users', uid));
                                    if (userSnap.exists()) {
                                        const u = userSnap.data();
                                        resolvedName = (u as any)?.UserName || (u as any)?.fullName || (u as any)?.name || (u as any)?.displayName || null;
                                    }
                                } catch {}
                            }

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
                } catch (e) { /* Bỏ qua */ }

                // 3. Tải thông tin xưởng
                try {
                    if (orderData?.workshopId) {
                        const wSnap = await getDoc(doc(db, 'workShop', orderData.workshopId));
                        if (wSnap.exists()) setWorkshopName(wSnap.data().name || null);
                    }
                } catch (e) { /* Bỏ qua */ }

                // 4. Tải danh mục vật liệu làm từ catalog
                try {
                    const matsSnap = await getDocs(collection(db, 'material'));
                    const mats = matsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
                    setMaterialsCatalog(mats);

                    if (orderData?.id) {
                        // Tải vật tư được giám định viên đề xuất của đơn
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
                        
                        // Tải nhân công thợ được giám định viên phân công kèm đơn giá
                        try {
                            const lq = query(collection(db, 'repairorderlabor'), where('RepairOrder_ID', '==', orderData.id));
                            const lsnap = await getDocs(lq);
                            if (!lsnap.empty) {
                                const ll = lsnap.docs.map(d => {
                                    const data = d.data() as any;
                                    const days = Math.max(1, Number(data.Days ?? data.Quantity ?? 0) || 1);
                                    const expertise = (data.Expertise || data.expertise || '').toString().trim();
                                    const storedRate = Number(data.UnitPrice || 350000);
                                    const expertiseBasedRate = expertise ? getExpertiseRate(expertise) : null;
                                    const unitPrice = expertiseBasedRate ?? storedRate;
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
                        } catch (e2) { /* Bỏ qua */ }
                    }
                } catch (e) { /* Bỏ qua */ }
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

    // Tính toán chi phí phục vụ hiển thị
    const computedMaterials = materialLines.reduce((s, x) => s + (Number(x.lineTotal) || 0), 0);
    const computedLabor = laborLines.reduce((s, x) => s + (Number(x.lineTotal) || 0), 0);
    const materialsCost = (order?.materialsCost !== undefined && order?.materialsCost !== null) ? Number(order.materialsCost) : computedMaterials;
    const laborCost = (order?.laborCost !== undefined && order?.laborCost !== null) ? Number(order.laborCost) : computedLabor;
    const totalCost = (order?.totalCost !== undefined && order?.totalCost !== null) ? Number(order.totalCost) : (materialsCost + laborCost);

    return (
        <WorkshopLayout selectedKey="orders" onSelect={(k) => { if (k === 'schedule') navigate('/workshop?tab=schedule'); else navigate('/workshop'); }} userName={headerName} loadingUser={false}>
            <div>
                <div className="flex items-center justify-between mb-4">
                    <Title level={4} className="m-0">Thông tin chi tiết đơn sửa chữa</Title>
                    <Button onClick={() => navigate(-1)}>Quay lại</Button>
                </div>

                {/* Bảng thuộc tính thông tin đơn sửa chữa */}
                <Descriptions title="Thông tin đơn" bordered column={1}>
                    <Descriptions.Item label="Trạng thái">{order?.Status || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Ngày tạo">
                        {(() => {
                            const fmt = (v: any) => {
                                if (!v) return undefined;
                                try {
                                    if (typeof v === 'string') {
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
                                order?.CreatedAt,
                                order?.createdAt,
                            ];
                            for (const c of candidates) {
                                const out = fmt(c);
                                if (out) return out;
                            }
                            return '—';
                        })()}
                    </Descriptions.Item>
                    <Descriptions.Item label="Tóm tắt hỏng hóc">
                        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{order?.Description || '—'}</div>
                    </Descriptions.Item>
                </Descriptions>

                <div style={{ height: 16 }} />

                {/* Bảng thuộc tính thông tin Tàu */}
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

                <Descriptions title="Thông tin xưởng" bordered column={1}>
                    <Descriptions.Item label="Xưởng">{workshopName || '—'}</Descriptions.Item>
                </Descriptions>

                {/* Bảng phương án sửa chữa kỹ thuật và danh sách vật tư/nhân công chi tiết */}
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
                                    <Col span={12}><div>Số ngày</div></Col>
                                </Row>

                                {laborLines.map((line, idx) => (
                                    <Row key={line.id || idx} gutter={8} className="mb-2">
                                        <Col span={12}>
                                            <div style={{ paddingTop: 6 }}>{line.employeeName || line.employeeId || '-'}</div>
                                        </Col>
                                        <Col span={12}>
                                            <div style={{ paddingTop: 6 }}>{line.days}</div>
                                        </Col>
                                    </Row>
                                ))}

                                <div className="text-right font-medium">Chi phí nhân công: {laborLines.reduce((s, x) => s + (Number(x.lineTotal) || 0), 0).toLocaleString('vi-VN')} đ</div>
                            </Card>
                        )}
                        
                        {(materialLines.length > 0 || laborLines.length > 0) && (
                            <div className="text-right font-semibold mt-2">Tổng chi phí dự toán: {totalCost.toLocaleString('vi-VN')} đ</div>
                        )}
                    </div>
                )}
            </div>
        </WorkshopLayout>
    );
};

export default OrderInfo;
