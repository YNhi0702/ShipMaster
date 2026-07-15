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
    const { state } = useLocation(); // Nhận dữ liệu truyền từ trang Home qua React Router State (nếu có)
    const { id } = useParams(); // Lấy ID của đơn sửa chữa trên URL
    const navigate = useNavigate();

    const [orderData, setOrderData] = useState<any>(state || null); // Lưu trữ dữ liệu đơn sửa chữa
    const [loading, setLoading] = useState(!state); // Trạng thái tải đơn hàng từ Firestore (nếu state chưa có)

    // Các thông tin bổ trợ hiển thị
    const [shipName, setShipName] = useState('');
    const [workshopName, setWorkshopName] = useState('');
    const [workshopAddress, setWorkshopAddress] = useState('');
    const [workshopPhone, setWorkshopPhone] = useState('');
    const [workshopEmail, setWorkshopEmail] = useState('');

    const [userName, setUserName] = useState('');
    const [userAddress, setUserAddress] = useState('');
    const [userPhone, setUserPhone] = useState('');
    
    const [loadingUser, setLoadingUser] = useState(true);

    const [canceling, setCanceling] = useState(false); // Trạng thái spinner khi khách ấn Hủy đơn
    const [accepting, setAccepting] = useState(false); // Trạng thái spinner đồng ý phương án sửa chữa

    const [reproposalModalVisible, setReproposalModalVisible] = useState(false); // Modal yêu cầu đề xuất lại phương án
    const [reproposalSubmitting, setReproposalSubmitting] = useState(false);
    const [proposalModalVisible, setProposalModalVisible] = useState(false); // Modal xem phương án đề xuất của giám định viên

    const [materialsCatalog, setMaterialsCatalog] = useState<any[]>([]); // Catalog mẫu vật tư
    const [materialLines, setMaterialLines] = useState<any[]>([]); // Dòng vật tư đã nạp cho đơn hàng này

    const [isInvoiceVisible, setIsInvoiceVisible] = useState(false); // Quản lý đóng/mở Modal hiển thị hóa đơn thanh toán PDF

    // Định dạng hiển thị tiền tệ
    const formatMoney = (value: number) =>
        value.toLocaleString('vi-VN') + ' đ';

    // Hàm chuẩn hóa chuỗi phục vụ so sánh không dấu viết thường
    const normalize = (str: any) =>
        String(str || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();

    // Mở và đóng modal hóa đơn
    const showInvoice = () => setIsInvoiceVisible(true);
    const hideInvoice = () => setIsInvoiceVisible(false);

    // 1. Tải thông tin cá nhân khách hàng
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
                    const custData = customerSnapshot.docs[0].data();
                    setUserName(custData.fullName || 'Khách hàng');
                    setUserAddress(custData.address || '');
                    setUserPhone(custData.phoneNumber || '');
                }
            } catch {}

            setLoadingUser(false);

            // Nếu người dùng truy cập trực tiếp từ URL, tiến hành fetch chi tiết đơn sửa chữa từ Firestore
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
                } catch (error) {
                    message.error('Lỗi tải đơn hàng.');
                } finally {
                    setLoading(false);
                }
            }
        };

        fetchOrder();
    }, [state, id, navigate]);

    // 2. Tải danh mục vật liệu mẫu từ Firestore làm cơ sở quy đổi tên
    useEffect(() => {
        const loadCatalog = async () => {
            try {
                const mats = await getDocs(collection(db, 'material'));
                setMaterialsCatalog(mats.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
            } catch {}
        };
        loadCatalog();
    }, []);

    // 3. Tải danh sách vật tư đã được gán trực tiếp của đơn hàng này
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

    // 4. Lấy thông tin chi tiết tên Tàu và xưởng sửa chữa
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
                    if (wsSnap.exists()) {
                        const wsData = wsSnap.data();
                        setWorkshopName(wsData.name || 'Không xác định');
                        setWorkshopAddress(wsData.address || '');
                        setWorkshopPhone(wsData.phoneNumber || '');
                        setWorkshopEmail(wsData.email || '');
                    } else {
                        setWorkshopName(orderData.workshopName || 'Không xác định');
                    }
                } else {
                    setWorkshopName(orderData.workshopName || 'Không xác định');
                }
            } catch {
                setWorkshopName('Không xác định');
            }
        };

        fetchNames();
    }, [orderData]);

    // 5. Tổng hợp các chi phí vật tư và nhân công
    const materialsCost = materialLines.reduce(
        (s, x) => s + (Number(x.lineTotal) || 0),
        0
    );

    const savedMaterialsCost = Number(orderData?.materialsCost) || materialsCost;
    const savedLaborCost = Number(orderData?.laborCost) || 0;
    const savedTotalCost = Number(orderData?.totalCost) || (savedMaterialsCost + savedLaborCost);

    // Dừng hiển thị nếu đang tải
    if (loading || !orderData) {
        return (
            <div className="p-6">
                <Spin /> Đang tải dữ liệu...
            </div>
        );
    }

    const { createdAt, Status, description } = orderData;

    const proposalText: string = orderData?.repairplan || ''; // Nội dung văn bản đề xuất kỹ thuật

    const statusNorm = normalize(Status);
    const isProposed = statusNorm === normalize('đã đề xuất phương án');

    // Các trạng thái được phép "Hủy đơn"
    const showCancelFor = new Set([
        normalize('chờ giám định'),
        normalize('đang giám định'),
        normalize('đã đề xuất phương án'),
        normalize('yêu cầu đề xuất lại'),
    ]);
    const canCancel = showCancelFor.has(statusNorm);

    // 7. Đồng ý với phương án đề xuất của giám định viên
    const handleAcceptRepair = async () => {
        if (!id) return;
        setAccepting(true);
        try {
            // Cập nhật trạng thái đơn sửa chữa thành "Sắp xếp lịch sửa chữa" để chuyển quyền qua cho chủ xưởng lập lịch
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

    // Gửi yêu cầu sửa đổi lại phương án cho cán bộ giám định viên chỉnh sửa lại
    const handleRequestReproposal = async (text: string) => {
        if (!id) return;
        try {
            setReproposalSubmitting(true);
            // Ghi nhận phản hồi và chuyển trạng thái về "Yêu cầu đề xuất lại"
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

    // Xử lý Hủy đơn sửa chữa
    const handleCancelOrder = async () => {
        if (!id) return;
        setCanceling(true);
        try {
            // Xóa các vật tư liên kết nháp trước khi xóa đơn hàng để tránh rác database
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

            // Xóa tài liệu đơn sửa chữa trong collection 'repairOrder'
            await deleteDoc(doc(db, 'repairOrder', id));
            message.success('Đã xóa đơn hàng.');
            navigate('/');
        } catch {
            message.error('Lỗi khi huỷ đơn.');
        } finally {
            setCanceling(false);
        }
    };

    return (
        <CustomerLayout userName={userName} loadingUser={loadingUser}>
            <div className="flex justify-between items-center mb-4">
                <Title level={4} className="m-0">
                    Chi tiết đơn sửa chữa
                </Title>
                <Button onClick={() => navigate(-1)}>Quay lại</Button>
            </div>

            {/* Bảng thông tin thuộc tính đơn sửa chữa */}
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

            {/* Nút xem hóa đơn thanh toán PDF xuất hiện khi đơn ở trạng thái đã tạo hóa đơn */}
            {normalize(Status) === normalize('đã tạo hóa đơn') && (
                <div className="mt-4 text-right">
                    <Button type="primary" onClick={showInvoice}>
                        Xem hóa đơn
                    </Button>
                </div>
            )}

            {/* Modal lớn chứa Hóa đơn xuất PDF */}
            <Modal
                title={null}
                open={isInvoiceVisible}
                onCancel={hideInvoice}
                footer={null}
                width={850}
                style={{ top: 20 }}
            >
                <Invoice
                    shipName={shipName}
                    workshopName={workshopName}
                    workshopAddress={workshopAddress}
                    workshopPhone={workshopPhone}
                    workshopEmail={workshopEmail}
                    createdAt={createdAt}
                    materialsCost={savedMaterialsCost}
                    laborCost={savedLaborCost}
                    totalCost={savedTotalCost}
                    customerName={userName}
                    customerAddress={userAddress}
                    customerPhone={userPhone}
                    invoiceId={orderData?.id}
                    items={materialLines.map((m: any) => ({
                        description: m.name,
                        unit: m.unit,
                        quantity: m.qty,
                        unitPrice: m.unitPrice,
                        amount: m.lineTotal
                    }))}
                />
            </Modal>

            {/* Khối các nút điều khiển duyệt phương án / hủy đơn */}
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

            {/* Modal hiển thị chi tiết phương án kỹ thuật và vật liệu/nhân viên đề xuất */}
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

            {/* Modal ghi chép phản hồi yêu cầu điều chỉnh từ khách hàng */}
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
