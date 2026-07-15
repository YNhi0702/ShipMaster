import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Typography, Descriptions, Image, Button, Spin, message, Form, Input } from 'antd';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import InspectorLayout from '../../components/Inspector/InspectorLayout';

const { Title } = Typography;

const OrderDetailInspector: React.FC = () => {
    const { id } = useParams(); // Lấy ID của đơn hàng từ URL
    const navigate = useNavigate();
    const [orderData, setOrderData] = useState<any>(null); // State lưu trữ dữ liệu đơn sửa chữa
    const [loading, setLoading] = useState(true); // Trạng thái tải dữ liệu
    const [shipName, setShipName] = useState('');
    const [shipInfo, setShipInfo] = useState<any | null>(null);
    const [workshopName, setWorkshopName] = useState('');
    const [employeeName, setEmployeeName] = useState('');
    const [workshopEmployees, setWorkshopEmployees] = useState<Array<{ id: string; UserName?: string; Email?: string; Phone?: string }>>([]); // Thợ kỹ thuật của xưởng
    const [loadingEmployees, setLoadingEmployees] = useState(false);
    const [accepting, setAccepting] = useState(false); // Trạng thái spinner tiếp nhận đơn
    const [accepted, setAccepted] = useState(false); // Đơn đã được tiếp nhận hay chưa
    const [showProposal, setShowProposal] = useState(false); // Trạng thái ẩn/hiện Form nhập đề xuất phương án
    const [proposalLoading, setProposalLoading] = useState(false); // Trạng thái spinner khi lưu đề xuất
    const [form] = Form.useForm();
    const [proposalChanged, setProposalChanged] = useState(false); // Nhận biết nội dung đề xuất có thay đổi hay không
    const [userName, setUserName] = useState(''); // Họ tên của Giám định viên hiện tại
    const [loadingUser, setLoadingUser] = useState(true);
    const location = useLocation();
    const isInspectedView = new URLSearchParams(location.search).get('view') === 'inspected'; // Đọc cờ xem chỉ đọc từ URL

    // Tải thông tin cá nhân của Giám định viên và thông tin cơ bản của đơn sửa chữa
    useEffect(() => {
        const fetchData = async () => {
            const uid = sessionStorage.getItem('uid');
            if (!uid) {
                navigate('/login');
                return;
            }

            try {
                // Tải họ tên giám định viên từ collection 'employees'
                const employeesRef = collection(db, 'employees');
                const empQuery = query(employeesRef, where('__name__', '==', uid));
                const empSnapshot = await getDocs(empQuery);
                if (!empSnapshot.empty) {
                    setUserName(empSnapshot.docs[0].data().UserName || 'Giám định viên');
                }
                setLoadingUser(false);

                // Tải thông tin tài liệu đơn sửa chữa
                if (id) {
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
                        setAccepted(data.Status !== 'Chờ giám định');
                        // Tự động mở form viết đề xuất nếu đơn đang ở trạng thái giám định hoặc bị yêu cầu đề xuất lại
                        setShowProposal(!isInspectedView && (data.Status === 'Đang giám định' || data.Status === 'Yêu cầu đề xuất lại'));
                        // Đưa nội dung cũ (nếu có) vào form nháp
                        form.setFieldsValue({ proposal: data.repairplan || '' });
                        setProposalChanged(false);
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

    // Tải tên Tàu, tên Xưởng, tên Giám định viên đã gán cho đơn hàng
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

    // Tải danh sách thợ sửa chữa (Role_ID = 5) của xưởng được giao việc
    useEffect(() => {
        const loadWorkshopEmployees = async () => {
            if (!orderData?.workshopId) {
                setWorkshopEmployees([]);
                return;
            }
            try {
                setLoadingEmployees(true);
                const employeesRef = collection(db, 'employees');
                const q = query(
                    employeesRef,
                    where('workShopID', '==', orderData.workshopId),
                    where('Role_ID', '==', 5)
                );
                const snap = await getDocs(q);
                const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
                setWorkshopEmployees(list);
            } catch (e) {
                setWorkshopEmployees([]);
            } finally {
                setLoadingEmployees(false);
            }
        };
        loadWorkshopEmployees();
    }, [orderData?.workshopId]);

    // Xử lý khi Giám định viên bấm nút "Tiếp nhận đơn"
    const handleAccept = async () => {
        if (!orderData) return;
        setAccepting(true);
        try {
            const uid = sessionStorage.getItem('uid');
            // Cập nhật trạng thái đơn thành "Đang giám định" và ghi nhận ID giám định viên
            await updateDoc(doc(db, 'repairOrder', orderData.id), {
                Status: 'Đang giám định',
                inspectorId: uid,
                assignedInspector: userName,
            });
            setAccepted(true);
            setShowProposal(false);
            message.success('Đã tiếp nhận đơn và gán cán bộ giám định!');
            setOrderData((prev: any) => ({ ...prev, Status: 'Đang giám định', inspectorId: uid, assignedInspector: userName }));
            
            setTimeout(() => {
                navigate('/inspector');
            }, 1500);
        } catch (e) {
            message.error('Lỗi khi tiếp nhận đơn.');
        } finally {
            setAccepting(false);
        }
    };

    // Gửi phương án đề xuất dạng Văn bản mô tả
    const handleProposal = async (values: any) => {
        if (!orderData) return;
        const existing = (orderData.repairplan || '').toString().trim();
        const incoming = (values.proposal || '').toString().trim();

        // Nếu là yêu cầu đề xuất lại, bắt buộc nội dung đề xuất mới phải khác đề xuất cũ
        if (orderData.Status === 'Yêu cầu đề xuất lại' && incoming === existing) {
            message.warning('Vui lòng chỉnh sửa đề xuất trước khi gửi.');
            return;
        }

        if (!incoming) {
            message.warning('Nội dung đề xuất không được để trống.');
            return;
        }

        setProposalLoading(true);
        try {
            // Cập nhật trường 'repairplan' và chuyển trạng thái đơn sang "Đã đề xuất phương án"
            await updateDoc(doc(db, 'repairOrder', orderData.id), {
                repairplan: incoming,
                Status: 'Đã đề xuất phương án',
            });
            message.success('Đã gửi đề xuất phương án!');
            setOrderData((prev: any) => ({ ...prev, repairplan: incoming, Status: 'Đã đề xuất phương án' }));
            setShowProposal(false);
        } catch (e) {
            message.error('Lỗi khi gửi đề xuất.');
        } finally {
            setProposalLoading(false);
        }
    };

    if (loading || !orderData) {
        return <div className="p-6"><Spin /> Đang tải dữ liệu...</div>;
    }

    const {
        createdAt,
        Status,
        description,
        priority,
        estimatedCost,
        expectedCompletionDate,
        customerName,
        customerPhone,
        customerEmail,
        imageList = {},
    } = orderData;

    const existingPlan = (orderData.repairplan || '').toString().trim();

    return (
        <InspectorLayout
            selectedKey="orders"
            onSelect={(key) => {
                if (key === 'orders') navigate('/inspector');
                else if (key === 'proposal') navigate('/inspector?tab=proposal');
                else if (key === 'inspected') navigate('/inspector?tab=inspected');
            }}
            userName={userName}
            loadingUser={loadingUser}
        >
            <div className="flex justify-between items-center mb-6">
                <Title level={3} className="m-0">Tiếp nhận đơn sửa chữa</Title>
                <Button onClick={() => navigate(-1)}>Quay lại</Button>
            </div>
            
            {/* Bảng thuộc tính thông tin đơn sửa chữa và Tàu */}
            <Descriptions title="Thông tin đơn" bordered column={1}>
                <Descriptions.Item label="Ngày tạo">{createdAt}</Descriptions.Item>
                <Descriptions.Item label="Trạng thái">{Status}</Descriptions.Item>
                <Descriptions.Item label="Tàu">{shipName}</Descriptions.Item>
                <Descriptions.Item label="Xưởng">{workshopName}</Descriptions.Item>
                {description && <Descriptions.Item label="Mô tả">{description}</Descriptions.Item>}
                {priority && <Descriptions.Item label="Độ ưu tiên">{priority}</Descriptions.Item>}
                {estimatedCost && <Descriptions.Item label="Chi phí dự kiến">{estimatedCost?.toLocaleString()} VND</Descriptions.Item>}
                {expectedCompletionDate && <Descriptions.Item label="Ngày hoàn thành dự kiến">{expectedCompletionDate}</Descriptions.Item>}

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

            {/* Bảng thuộc tính thông tin Khách hàng (nếu có) */}
            {(customerName || customerPhone || customerEmail) && (
                <Descriptions title="Thông tin khách hàng" bordered column={1} className="mt-6">
                    {customerName && <Descriptions.Item label="Tên khách hàng">{customerName}</Descriptions.Item>}
                    {customerPhone && <Descriptions.Item label="Số điện thoại">{customerPhone}</Descriptions.Item>}
                    {customerEmail && <Descriptions.Item label="Email">{customerEmail}</Descriptions.Item>}
                </Descriptions>
            )}
            
            {/* Hình ảnh đính kèm */}
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
            
            {/* Nút tiếp nhận đơn dành cho GĐV */}
            {!accepted && Status === 'Chờ giám định' && (
                <Button type="primary" className="mt-6" loading={accepting} onClick={handleAccept}>
                    Tiếp nhận đơn
                </Button>
            )}
            
            {/* Hiển thị yêu cầu chỉnh sửa phương án từ Khách hàng nếu đơn bị trả về */}
            {orderData.Status === 'Yêu cầu đề xuất lại' && orderData.CustomerAdjustmentRequest && (
                <div className="mt-6 max-w-xl">
                    <Title level={4}>Yêu cầu điều chỉnh từ khách hàng</Title>
                    <div className="bg-yellow-50 p-4 rounded border border-yellow-200 whitespace-pre-line">
                        <div className="mb-2 font-medium">{orderData.CustomerAdjustmentRequest.createdByName || 'Khách hàng'}</div>
                        <div className="text-sm text-gray-700">{orderData.CustomerAdjustmentRequest.text}</div>
                    </div>
                </div>
            )}

            {/* Form ghi phương án kỹ thuật */}
            {showProposal && (
                <div className="mt-8 max-w-xl">
                    <Title level={4}>{orderData.Status === 'Yêu cầu đề xuất lại' ? 'Chỉnh sửa đề xuất (bắt buộc)' : 'Gửi đề xuất phương án'}</Title>

                    {orderData.repairplan && (
                        <div className="mb-4">
                            <div className="text-sm text-gray-500">Phương án hiện tại:</div>
                            <div className="bg-gray-50 p-3 rounded border border-gray-200 whitespace-pre-line">{orderData.repairplan}</div>
                        </div>
                    )}

                    <Form form={form} onFinish={handleProposal} onValuesChange={() => {
                        const val = (form.getFieldValue('proposal') || '').toString().trim();
                        const existing = (orderData.repairplan || '').toString().trim();
                        setProposalChanged(val !== existing && val.length > 0);
                    }}>
                        <Form.Item name="proposal" rules={[{ required: true, message: 'Vui lòng nhập đề xuất.' }]}> 
                            <Input.TextArea rows={8} placeholder="Viết đề xuất phương án ở đây..." />
                        </Form.Item>
                        <div className="flex gap-3 justify-end">
                            <Button htmlType="submit" type="primary" loading={proposalLoading} disabled={orderData.Status === 'Yêu cầu đề xuất lại' ? !proposalChanged : false}>
                                Gửi đề xuất
                            </Button>
                        </div>
                    </Form>
                </div>
            )}

            {/* Xem lại phương án ở chế độ chỉ đọc */}
            {existingPlan && (
                <div className="mt-8 max-w-xl">
                    <Title level={4}>Phương án sửa chữa</Title>
                    <div className="bg-gray-50 p-3 rounded border border-gray-200 whitespace-pre-line">{existingPlan}</div>
                </div>
            )}
        </InspectorLayout>
    );
};

export default OrderDetailInspector;
