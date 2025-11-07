import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Typography, Descriptions, Image, Button, Spin, message, Form, Input, Avatar } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import InspectorLayout from '../components/InspectorLayout';

const { Title } = Typography;

const OrderDetailInspector: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [orderData, setOrderData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [shipName, setShipName] = useState('');
    const [shipInfo, setShipInfo] = useState<any | null>(null);
    const [workshopName, setWorkshopName] = useState('');
    const [employeeName, setEmployeeName] = useState('');
    const [workshopEmployees, setWorkshopEmployees] = useState<Array<{ id: string; UserName?: string; Email?: string; Phone?: string }>>([]);
    const [loadingEmployees, setLoadingEmployees] = useState(false);
    const [accepting, setAccepting] = useState(false);
    const [accepted, setAccepted] = useState(false);
    const [showProposal, setShowProposal] = useState(false);
    const [proposalLoading, setProposalLoading] = useState(false);
    const [form] = Form.useForm();
    const [proposalChanged, setProposalChanged] = useState(false);
    const [userName, setUserName] = useState('');
    const [loadingUser, setLoadingUser] = useState(true);
    const location = useLocation();
    const isInspectedView = new URLSearchParams(location.search).get('view') === 'inspected';

    useEffect(() => {
        const fetchData = async () => {
            const uid = sessionStorage.getItem('uid');
            if (!uid) {
                navigate('/login');
                return;
            }

            try {
                // Lấy thông tin giám định viên
                const employeesRef = collection(db, 'employees');
                const empQuery = query(employeesRef, where('__name__', '==', uid));
                const empSnapshot = await getDocs(empQuery);
                if (!empSnapshot.empty) {
                    setUserName(empSnapshot.docs[0].data().UserName || 'Giám định viên');
                }
                setLoadingUser(false);

                // Lấy thông tin đơn hàng
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
                        // Show proposal form when inspector should propose or re-propose
                        // but if opened from inspected view, do not show the editable form
                        setShowProposal(!isInspectedView && (data.Status === 'Đang giám định' || data.Status === 'Yêu cầu đề xuất lại'));
                        // Prefill form with existing proposal if any
                        form.setFieldsValue({ proposal: data.proposal || data.repairplan || '' });
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

    useEffect(() => {
        const fetchNames = async () => {
            if (!orderData) return;

            // Ship name
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

            // Workshop name
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

            // Inspector name (optional)
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

    // Load employees (role 5) of the selected workshop
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

    const handleAccept = async () => {
        if (!orderData) return;
        setAccepting(true);
        try {
            const uid = sessionStorage.getItem('uid');
            await updateDoc(doc(db, 'repairOrder', orderData.id), {
                Status: 'Đang giám định',
                inspectorId: uid,
                assignedInspector: userName, // Gán tên cán bộ giám định
            });
            setAccepted(true);
            setShowProposal(false);
            message.success('Đã tiếp nhận đơn và gán cán bộ giám định!');
            setOrderData((prev: any) => ({ ...prev, Status: 'Đang giám định', inspectorId: uid, assignedInspector: userName }));
            
            // Chuyển về trang home sau 1.5 giây
            setTimeout(() => {
                navigate('/inspector');
            }, 1500);
        } catch (e) {
            message.error('Lỗi khi tiếp nhận đơn.');
        } finally {
            setAccepting(false);
        }
    };

    const handleProposal = async (values: any) => {
        if (!orderData) return;
        const existing = (orderData.proposal || orderData.repairplan || '').toString().trim();
        const incoming = (values.proposal || '').toString().trim();

        // If status requests re-proposal, require that incoming proposal is different
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
            await updateDoc(doc(db, 'repairOrder', orderData.id), {
                proposal: incoming,
                Status: 'Đã đề xuất phương án',
            });
            message.success('Đã gửi đề xuất phương án!');
            setOrderData((prev: any) => ({ ...prev, proposal: incoming, Status: 'Đã đề xuất phương án' }));
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
        proposal,
    } = orderData;

    // also check for repairplan (legacy field) and prefer it for display when present
    const existingPlan = (orderData.proposal || orderData.repairplan || '').toString().trim();

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
                <Descriptions title="Thông tin đơn" bordered column={1}>
                    <Descriptions.Item label="Mã đơn">{id}</Descriptions.Item>
                    <Descriptions.Item label="Ngày tạo">{createdAt}</Descriptions.Item>
                    <Descriptions.Item label="Trạng thái">{Status}</Descriptions.Item>
                    <Descriptions.Item label="Tàu">{shipName}</Descriptions.Item>
                    <Descriptions.Item label="Cán bộ giám định">{orderData.assignedInspector || employeeName || 'Chưa được gán'}</Descriptions.Item>
                    <Descriptions.Item label="Xưởng">{workshopName}</Descriptions.Item>
                    {description && <Descriptions.Item label="Mô tả">{description}</Descriptions.Item>}
                    {priority && <Descriptions.Item label="Độ ưu tiên">{priority}</Descriptions.Item>}
                    {estimatedCost && <Descriptions.Item label="Chi phí dự kiến">{estimatedCost?.toLocaleString()} VND</Descriptions.Item>}
                    {expectedCompletionDate && <Descriptions.Item label="Ngày hoàn thành dự kiến">{expectedCompletionDate}</Descriptions.Item>}

                    {/* Thông tin tàu hiển thị chung trong cùng bảng */}
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

                    {/* Employees of selected workshop with Role_ID = 5 */}
                    <div className="mt-6 max-w-2xl">
                        <Title level={4} className="mb-3">Nhân viên của xưởng (Role 5)</Title>
                        {loadingEmployees ? (
                            <div className="text-gray-500">Đang tải danh sách nhân viên...</div>
                        ) : workshopEmployees.length === 0 ? (
                            <div className="text-gray-500">Không có nhân viên phù hợp.</div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {workshopEmployees.map(emp => (
                                    <div key={emp.id} className="flex items-center gap-3 p-3 border rounded">
                                        <Avatar icon={<UserOutlined />} />
                                        <div className="flex flex-col">
                                            <span className="font-medium">{emp.UserName || 'Nhân viên'}</span>
                                            <span className="text-sm text-gray-600">{emp.Phone || ''}{emp.Phone && emp.Email ? ' · ' : ''}{emp.Email || ''}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>


                {(customerName || customerPhone || customerEmail) && (
                    <Descriptions title="Thông tin khách hàng" bordered column={1} className="mt-6">
                        {customerName && <Descriptions.Item label="Tên khách hàng">{customerName}</Descriptions.Item>}
                        {customerPhone && <Descriptions.Item label="Số điện thoại">{customerPhone}</Descriptions.Item>}
                        {customerEmail && <Descriptions.Item label="Email">{customerEmail}</Descriptions.Item>}
                    </Descriptions>
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
                {!accepted && Status === 'Chờ giám định' && (
                    <Button type="primary" className="mt-6" loading={accepting} onClick={handleAccept}>
                        Tiếp nhận đơn
                    </Button>
                )}
                
                {/* If customer requested a re-proposal, show their request */}
                {orderData.Status === 'Yêu cầu đề xuất lại' && orderData.CustomerAdjustmentRequest && (
                    <div className="mt-6 max-w-xl">
                        <Title level={4}>Yêu cầu điều chỉnh từ khách hàng</Title>
                        <div className="bg-yellow-50 p-4 rounded border border-yellow-200 whitespace-pre-line">
                            <div className="mb-2 font-medium">{orderData.CustomerAdjustmentRequest.createdByName || 'Khách hàng'}</div>
                            <div className="text-sm text-gray-700">{orderData.CustomerAdjustmentRequest.text}</div>
                        </div>
                    </div>
                )}

                {showProposal && (
                    <div className="mt-8 max-w-xl">
                        <Title level={4}>{orderData.Status === 'Yêu cầu đề xuất lại' ? 'Chỉnh sửa đề xuất (bắt buộc)' : 'Gửi đề xuất phương án'}</Title>

                        {/* Display current proposal if exists */}
                        {proposal && (
                            <div className="mb-4">
                                <div className="text-sm text-gray-500">Phương án hiện tại:</div>
                                <div className="bg-gray-50 p-3 rounded border border-gray-200 whitespace-pre-line">{proposal}</div>
                            </div>
                        )}

                        <Form form={form} onFinish={handleProposal} onValuesChange={() => {
                            const val = (form.getFieldValue('proposal') || '').toString().trim();
                            const existing = (proposal || '').toString().trim();
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

                {/* Always show existing proposal/repair plan in read-only mode for inspected or other statuses */}
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
