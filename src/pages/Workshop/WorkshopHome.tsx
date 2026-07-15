// src/pages/Workshop/WorkshopHome.tsx
// Giao diện chính dành cho Chủ xưởng sửa chữa (Workshop Owner).
// Quản lý 2 tab chính: tab "Đơn sửa chữa" (xem chi tiết) và tab "Lịch sửa chữa" (lập lịch biểu, theo dõi tiến độ và đánh dấu hoàn thành).
import React, { useEffect, useState } from 'react';
import { Button, Table, Typography, message, Space, Form, DatePicker, Modal, Select, Input, Checkbox } from 'antd';
import moment from 'moment';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import WorkshopLayout from '../../components/Workshop/WorkshopLayout';
import StaffManagement from './StaffManagement';

const { Title } = Typography;

const WorkshopHome: React.FC = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState<any[]>([]); // Danh sách toàn bộ đơn sửa chữa
    const [selectedKey, setSelectedKey] = useState<'orders' | 'schedule' | 'employees' | 'inspected' | 'proposal'>('orders'); // Tab hiện tại được chọn
    const [workshops, setWorkshops] = useState<Array<{ id: string; name: string }>>([]); // Các xưởng thuộc quyền sở hữu của user
    const [selectedWorkshopId, setSelectedWorkshopId] = useState<string | null>(null); // Xưởng hiện tại đang xem thông tin
    const [orderSearch, setOrderSearch] = useState<string>(''); // Nội dung tìm kiếm đơn hàng
    const [scheduleSearch, setScheduleSearch] = useState<string>(''); // Nội dung tìm kiếm lịch trình
    const [scheduleDateRange, setScheduleDateRange] = useState<any[] | null>(null); // Bộ lọc khoảng thời gian lịch trình
    const location = useLocation();
    const [userName, setUserName] = useState<string>(''); // Tên chủ xưởng hiển thị ở header
    const [loadingUser, setLoadingUser] = useState<boolean>(true);
    const [loadingOrders, setLoadingOrders] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    
    // State quản lý Modal lập lịch sửa chữa
    const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
    const [schedulingOrderId, setSchedulingOrderId] = useState<string | null>(null);
    const [scheduling, setScheduling] = useState(false);
    const [form] = Form.useForm();
    const [isEditingSchedule, setIsEditingSchedule] = useState(false); // Xác định xem là "Tạo mới lịch" hay "Chỉnh sửa lịch cũ"

    // 1. Đồng bộ hóa tab được chọn dựa vào tham số query trên URL (?tab=...)
    useEffect(() => {
        try {
            const params = new URLSearchParams(location.search || '');
            const tab = params.get('tab');
            if (tab === 'schedule') setSelectedKey('schedule');
            else if (tab === 'employees') setSelectedKey('employees');
            else if (tab === 'inspected') setSelectedKey('inspected');
            else if (tab === 'proposal') setSelectedKey('proposal');
            else setSelectedKey('orders');
        } catch (e) { /* Bỏ qua */ }
    }, [location.search]);

    // 2. Tải danh sách đơn sửa chữa của xưởng từ Firestore
    const fetchOrdersForWorkshop = async (workshopId: string | null) => {
        if (!workshopId) {
            setOrders([]);
            return;
        }

        try {
            setLoadingOrders(true);
            setRefreshing(true);
            
            let ordersSnap: any = null;

            // Hỗ trợ chọn giá trị 'ALL' để gom toàn bộ đơn sửa chữa của mọi xưởng do user này làm chủ
            if (workshopId === 'ALL') {
                const allOrders = await getDocs(collection(db, 'repairOrder'));
                const ownedIds = workshops.map((w) => w.id);
                // Lọc ở phía Client
                const filtered = allOrders.docs.filter((d) => {
                    const o = d.data();
                    return ownedIds.includes(o?.workshopId || '');
                });
                ordersSnap = { docs: filtered } as any;
            } else {
                // Thống nhất quy chuẩn đặt tên: Đơn liên kết với xưởng bằng trường 'workshopId'
                const oq = query(collection(db, 'repairOrder'), where('workshopId', '==', workshopId));
                ordersSnap = await getDocs(oq);
            }

            // Map thêm thông tin tên Tàu của từng đơn để hiển thị đầy đủ
            const rows = await Promise.all(
                ordersSnap.docs.map(async (d: any) => {
                    const o = d.data();
                    const createdAt = o.StartDate?.toDate ? o.StartDate.toDate().toLocaleDateString('vi-VN') : '';
                    let shipName = 'Không xác định';
                    try {
                        if (o.shipId) {
                            const shipDoc = await getDoc(doc(db, 'ship', o.shipId));
                            shipName = shipDoc.exists() ? (shipDoc.data() as any).name : 'Không xác định';
                        }
                    } catch (e) { /* Bỏ qua lỗi load tên tàu */ }
                    return {
                        id: d.id,
                        ...o,
                        createdAt,
                        shipName,
                    };
                })
            );

            setOrders(rows);
        } catch (e) {
            setOrders([]);
        } finally {
            setLoadingOrders(false);
            setRefreshing(false);
        }
    };

    // 3. Khởi tạo tải dữ liệu (Thông tin Tên chủ xưởng và danh sách Xưởng sở hữu)
    const fetchData = async () => {
        const sessionUid = sessionStorage.getItem('uid');
        const uid = sessionUid || auth.currentUser?.uid || null;

        try {
            setLoadingUser(true);
            setLoadingOrders(true);
            setRefreshing(true);

            // Tìm kiếm họ tên hiển thị: kiểm tra users -> employees (theo email) -> workShop -> displayName của Auth
            try {
                const userRef = uid ? doc(db, 'users', uid) : null;
                let resolvedName: string | null = null;
                if (userRef) {
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        const u = userSnap.data();
                        resolvedName = u?.UserName || u?.fullName || u?.username || u?.name || u?.displayName || null;
                    }
                }

                if (!resolvedName) {
                    try {
                        const email = auth.currentUser?.email;
                        if (email) {
                            const empQuery = query(collection(db, 'employees'), where('Email', '==', email));
                            const empSnap = await getDocs(empQuery);
                            if (!empSnap.empty) {
                                const empData = empSnap.docs[0].data();
                                resolvedName = empData?.UserName || empData?.fullName || empData?.name || null;
                            }
                        }
                    } catch (e) { /* Bỏ qua */ }
                }

                if (!resolvedName && uid) {
                    const wsDoc = await getDoc(doc(db, 'workShop', uid));
                    if (wsDoc.exists()) resolvedName = wsDoc.data().name || null;
                }

                if (!resolvedName) resolvedName = auth.currentUser?.displayName || 'Chủ xưởng';

                setUserName(resolvedName);
            } catch (e) { /* Bỏ qua */ }

            // Tìm danh sách xưởng mà user này được chỉ định làm chủ (owner)
            if (!uid) {
                setWorkshops([]);
                setSelectedWorkshopId(null);
                setOrders([]);
            } else {
                try {
                    // Thống nhất quy chuẩn đặt tên: Chủ xưởng liên kết bằng trường 'ownerID'
                    const wsQ = query(collection(db, 'workShop'), where('ownerID', '==', uid));
                    const wsSnap = await getDocs(wsQ);
                    const found: Array<{ id: string; name: string }> = [];

                    wsSnap.docs.forEach((d) => {
                        const data = d.data();
                        found.push({ id: d.id, name: data?.name || data?.UserName || d.id });
                    });

                    // Nhận diện dự phòng nếu ID tài liệu trùng với UID
                    if (found.length === 0) {
                        const wsDoc = await getDoc(doc(db, 'workShop', uid));
                        if (wsDoc.exists()) {
                            const data = wsDoc.data();
                            found.push({ id: wsDoc.id, name: data?.name || data?.UserName || wsDoc.id });
                        }
                    }

                    setWorkshops(found);
                    const defaultWs = found.length > 0 ? found[0].id : null;
                    
                    // Chọn mặc định xưởng đầu tiên trong danh sách nếu chưa có xưởng nào được chọn
                    if (!selectedWorkshopId && defaultWs) {
                        setSelectedWorkshopId(defaultWs);
                        await fetchOrdersForWorkshop(defaultWs);
                    } else if (selectedWorkshopId) {
                        await fetchOrdersForWorkshop(selectedWorkshopId);
                    }
                } catch (e) {
                    setWorkshops([]);
                    setSelectedWorkshopId(null);
                    setOrders([]);
                }
            }
        } catch (error) {
            message.error('Lỗi khi tải dữ liệu!');
        } finally {
            setLoadingUser(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [navigate, location.search]);

    // Gọi tải lại đơn hàng khi người dùng thay đổi xưởng sửa chữa ở Select box
    useEffect(() => {
        if (selectedWorkshopId) {
            fetchOrdersForWorkshop(selectedWorkshopId);
        }
    }, [selectedWorkshopId]);

    // Các cột hiển thị danh sách đơn sửa chữa (Tab Đơn sửa chữa)
    const columns = [
        {
            title: 'STT',
            key: 'stt',
            width: 60,
            render: (_: any, __: any, index: number) => index + 1,
        },
        { title: 'Ngày tạo', dataIndex: 'createdAt', key: 'createdAt' },
        { title: 'Tàu', dataIndex: 'shipName', key: 'shipName', render: (v: string) => <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{v}</div> },
        { title: 'Trạng thái', dataIndex: 'Status', key: 'Status', render: (v: string) => <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{v}</div> },
        {
            title: 'Hành động',
            key: 'action',
            render: (_: any, record: any) => (
                <div className="flex gap-2">
                    <Button onClick={() => navigate(`/workshop/orders/${record.id}`, { state: record })}>Xem</Button>
                </div>
            ),
        },
    ];

    // Các cột hiển thị danh sách lịch sửa chữa (Tab Lịch sửa chữa)
    const scheduleColumns = [
        { title: 'STT', key: 'stt', width: 60, render: (_: any, __: any, index: number) => index + 1 },
        { title: 'Tàu', dataIndex: 'shipName', key: 'shipName', render: (v: string) => <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{v}</div> },
        { title: 'Lịch bắt đầu', dataIndex: 'scheduleStart', key: 'scheduleStart' },
        { title: 'Lịch kết thúc', dataIndex: 'scheduleEnd', key: 'scheduleEnd' },
        { title: 'Trạng thái', dataIndex: 'Status', key: 'Status', render: (v: string) => <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{v}</div> },
        {
            title: 'Hành động',
            key: 'action',
            render: (_: any, record: any) => {
                const hasSchedule = !!(record.ScheduleStartDate && record.ScheduleEndDate);
                return (
                    <Button onClick={() => openScheduleForRecord(record)}>
                        {hasSchedule ? 'Chỉnh sửa' : 'Tạo lịch'}
                    </Button>
                );
            },
        },
    ];

    // Mở Modal lập lịch / chỉnh sửa lịch sửa chữa cho đơn hàng
    const openScheduleForRecord = (record: any) => {
        setSchedulingOrderId(record.id);
        const hasSchedule = !!(record.ScheduleStartDate && record.ScheduleEndDate);
        setIsEditingSchedule(hasSchedule);

        try {
            // Nếu đơn đã được lập lịch trước đó, hiển thị lại khoảng ngày cũ trên Picker
            if (hasSchedule) {
                const s = record.ScheduleStartDate?.toDate ? moment(record.ScheduleStartDate.toDate()) : moment(record.ScheduleStartDate);
                const e = record.ScheduleEndDate?.toDate ? moment(record.ScheduleEndDate.toDate()) : moment(record.ScheduleEndDate);
                form.setFieldsValue({ dateRange: [s, e] });
            } else {
                form.resetFields();
            }
        } catch (e) {
            form.resetFields();
        }

        setScheduleModalVisible(true);
    };

    // Tạo các trường ngày bắt đầu/kết thúc kiểu Date để phục vụ lọc dữ liệu
    const scheduleRows = orders.map((o) => {
        let rawDateObj: Date | null = null;
        if (o.ScheduleStartDate?.toDate) rawDateObj = o.ScheduleStartDate.toDate();
        else if (o.ScheduleStartDate instanceof Date) rawDateObj = o.ScheduleStartDate;
       
        if (!rawDateObj) {
            if (o.StartDate?.toDate) rawDateObj = o.StartDate.toDate();
            else if (o.StartDate instanceof Date) rawDateObj = o.StartDate;
        }
        const date = rawDateObj ? rawDateObj.toLocaleDateString('vi-VN') : (o.createdAt || '—');

        let scheduleStartObj: Date | null = null;
        let scheduleEndObj: Date | null = null;
        if (o.ScheduleStartDate?.toDate) scheduleStartObj = o.ScheduleStartDate.toDate();
        else if (o.ScheduleStartDate instanceof Date) scheduleStartObj = o.ScheduleStartDate;
        if (o.ScheduleEndDate?.toDate) scheduleEndObj = o.ScheduleEndDate.toDate();
        else if (o.ScheduleEndDate instanceof Date) scheduleEndObj = o.ScheduleEndDate;
        const scheduleStart = scheduleStartObj ? scheduleStartObj.toLocaleDateString('vi-VN') : '—';
        const scheduleEnd = scheduleEndObj ? scheduleEndObj.toLocaleDateString('vi-VN') : '—';

        return { ...o, date, _startDate: rawDateObj, _endDate: scheduleEndObj, scheduleStart, scheduleEnd };
    });

    const normalize = (str: string) => {
        if (!str) return '';
        return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    };

    // Chỉ hiển thị các đơn có trạng thái "Đã lên lịch" hoặc "Sắp xếp lịch sửa chữa" trên Tab Lịch sửa chữa
    const validScheduleStates = ['Đã lên lịch', 'Sắp xếp lịch sửa chữa'];
    const filteredScheduleRows = scheduleRows.filter((r) =>
        validScheduleStates.includes(r.Status)
    );

    // Áp dụng bộ lọc tìm kiếm text và bộ lọc khoảng thời gian (DatePicker Range)
    const filteredScheduleRowsWithSearch = filteredScheduleRows.filter((r) => {
        const normalizedSearch = (scheduleSearch || '').toString().toLowerCase().trim();
        const hay = `${r.shipName || ''} ${r.Status || ''} ${r.createdAt || ''}`.toLowerCase();
        const textMatch = !normalizedSearch || hay.includes(normalizedSearch);

        let dateMatch = true;
        if (scheduleDateRange && scheduleDateRange.length === 2) {
            const [startM, endM] = scheduleDateRange;
            const rowDate = r._startDate ? new Date(r._startDate) : null;
            if (rowDate) {
                const t = rowDate.getTime();
                const s = startM ? startM.startOf('day').valueOf() : null;
                const e = endM ? endM.endOf('day').valueOf() : null;
                if (s && e) {
                    dateMatch = t >= s && t <= e;
                }
            } else {
                dateMatch = false;
            }
        }

        return textMatch && dateMatch;
    });

    // Lọc tìm kiếm đơn hàng thông thường
    const normalizedOrderSearch = (orderSearch || '').toString().toLowerCase().trim();
    const filteredOrders = orders.filter((o) => {
        if (!normalizedOrderSearch) return true;
        const hay = `${o.shipName || ''} ${o.Status || ''}`.toLowerCase();
        return hay.includes(normalizedOrderSearch);
    });

    return (
        <WorkshopLayout selectedKey={selectedKey} onSelect={(key: string) => {
            setSelectedKey(key as any);
            if (key === 'schedule') navigate('/workshop?tab=schedule', { replace: true });
            else navigate('/workshop', { replace: true });
        }} userName={userName} loadingUser={loadingUser}>

            {selectedKey === 'orders' && (
                <div className="w-full overflow-x-auto">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <Title level={5} className="m-0">Đơn sửa chữa</Title>
                            <Select
                                style={{ width: 320 }}
                                placeholder="Chọn xưởng"
                                value={selectedWorkshopId || undefined}
                                onChange={(val) => setSelectedWorkshopId(val as string)}
                                options={[{ label: 'Tất cả', value: 'ALL' }, ...workshops.map(w => ({ label: w.name, value: w.id }))]}
                                notFoundContent={workshops.length === 0 ? 'Không có xưởng' : undefined}
                            />
                            <Input.Search
                                placeholder="Tìm theo tàu, trạng thái"
                                allowClear
                                onSearch={(v) => setOrderSearch(v)}
                                onChange={(e) => setOrderSearch(e.target.value)}
                                style={{ width: 360 }}
                                value={orderSearch}
                            />
                        </div>
                    </div>
                    <Table
                        columns={columns}
                        dataSource={filteredOrders}
                        rowKey="id"
                        loading={loadingOrders || refreshing}
                        bordered
                        className="shadow-sm"
                        scroll={{ x: 'max-content' }}
                    />
                </div>
            )}

            {selectedKey === 'employees' && (
                <div>
                    <StaffManagement />
                </div>
            )}

            {selectedKey === 'schedule' && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <Title level={5} className="m-0">Lịch sửa chữa</Title>
                            <Select
                                style={{ width: 320 }}
                                placeholder="Chọn xưởng"
                                value={selectedWorkshopId || undefined}
                                onChange={(val) => setSelectedWorkshopId(val as string)}
                                options={[{ label: 'Tất cả', value: 'ALL' }, ...workshops.map(w => ({ label: w.name, value: w.id }))]}
                                notFoundContent={workshops.length === 0 ? 'Không có xưởng' : undefined}
                            />
                            <Input.Search
                                placeholder="Tìm theo tàu, trạng thái..."
                                allowClear
                                onSearch={(v) => setScheduleSearch(v)}
                                onChange={(e) => setScheduleSearch(e.target.value)}
                                style={{ width: 320 }}
                                value={scheduleSearch}
                            />
                            <DatePicker.RangePicker
                                onChange={(vals) => setScheduleDateRange(vals as any)}
                                value={scheduleDateRange as any}
                            />
                        </div>
                    </div>

                    <div className="w-full overflow-x-auto">
                        <Table
                            columns={scheduleColumns.map(col => ({ ...col, ellipsis: true }))}
                            dataSource={filteredScheduleRowsWithSearch}
                            rowKey="id"
                            loading={loadingOrders || refreshing}
                            bordered
                            pagination={{ pageSize: 10 }}
                            scroll={{ x: 'max-content' }}
                            // Thuật toán bôi màu cảnh báo thời hạn sửa chữa trên Table:
                            onRow={(record: any) => {
                                try {
                                    const end = record._endDate ? new Date(record._endDate) : null;
                                    if (!end) return {} as any;
                                    
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0); // Đưa về 0 giờ ngày hôm nay để so sánh chuẩn xác
                                    
                                    const endTime = end.getTime();
                                    const tToday = today.getTime();
                                    
                                    // Thời gian kết thúc của ngày mai (23:59:59.999)
                                    const endOfTomorrow = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000 - 1);
                                    const tEndOfTomorrow = endOfTomorrow.getTime();

                                    // Cảnh báo màu VÀNG nhạt (#fff7e6) nếu hạn hoàn thành rơi vào ngày hôm nay hoặc ngày mai (cần tập trung nhân sự)
                                    if (endTime >= tToday && endTime <= tEndOfTomorrow) {
                                        return { style: { background: '#fff7e6' } } as any;
                                    }

                                    // Báo động màu ĐỎ nhạt (#ffe6e6) nếu đã quá thời hạn kết thúc sửa chữa dự kiến mà đơn vẫn chưa hoàn thành
                                    if (endTime < tToday) {
                                        return { style: { background: '#ffe6e6' } } as any;
                                    }

                                    return {} as any;
                                } catch (e) {
                                    return {} as any;
                                }
                            }}
                        />
                    </div>

                    {/* Modal thiết lập ngày công sửa chữa và Đánh dấu hoàn thành */}
                    <Modal
                        title={'Lịch sửa chữa'}
                        open={scheduleModalVisible}
                        okText="Lưu"
                        cancelText="Huỷ"
                        onCancel={() => {
                            setScheduleModalVisible(false);
                            form.resetFields();
                            setSchedulingOrderId(null);
                            setIsEditingSchedule(false);
                        }}
                        onOk={async () => {
                            try {
                                const vals = await form.validateFields();
                                const range = vals.dateRange as any[];
                                const isCompleted = vals.isCompleted || false; // Trạng thái checkbox hoàn thành

                                if (!schedulingOrderId) throw new Error('Order id missing');

                                setScheduling(true);
                                const payload: any = {};

                                // Lưu trữ khoảng ngày sửa chữa dự tính (Timestamp Firestore)
                                if (range && range[0] && range[1]) {
                                    const startMoment: any = range[0];
                                    const endMoment: any = range[1];

                                    const sDate = startMoment.toDate();
                                    sDate.setHours(0, 0, 0, 0);

                                    const eDate = endMoment.toDate();
                                    eDate.setHours(23, 59, 59, 999);

                                    payload.ScheduleStartDate = Timestamp.fromDate(sDate);
                                    payload.ScheduleEndDate = Timestamp.fromDate(eDate);
                                }

                                // Nếu là thao tác "Chỉnh sửa lịch", cho phép tích checkbox đánh dấu "Hoàn thành sửa chữa"
                                if (isEditingSchedule) {
                                    payload.Status = isCompleted ? 'Hoàn thành sửa chữa' : 'Đã lên lịch';
                                } else {
                                    // Tạo lịch lần đầu tiên -> trạng thái chuyển sang "Đã lên lịch"
                                    payload.Status = 'Đã lên lịch';
                                }

                                // Cập nhật trực tiếp lên đơn hàng ở Firestore
                                await updateDoc(doc(db, 'repairOrder', schedulingOrderId), payload);

                                message.success(
                                    isCompleted ? 'Đã hoàn thành sửa chữa' :
                                    isEditingSchedule ? 'Đã cập nhật lịch' :
                                    'Đã tạo lịch cho đơn'
                                );

                                // Đóng modal và reset
                                setScheduleModalVisible(false);
                                form.resetFields();
                                setSchedulingOrderId(null);
                                await fetchOrdersForWorkshop(selectedWorkshopId);
                                setSelectedKey('schedule');

                            } catch (e: any) {
                                message.error(e.message || 'Lỗi khi lưu lịch');
                            } finally {
                                setScheduling(false);
                                setIsEditingSchedule(false);
                            }
                        }}
                        confirmLoading={scheduling}
                    >
                        <Form form={form} layout="vertical">
                            <Form.Item
                                name="dateRange"
                                label="Chọn ngày bắt đầu - kết thúc"
                                rules={[{ required: true }]}
                            >
                                <DatePicker.RangePicker />
                            </Form.Item>

                            {/* Checkbox đánh dấu hoàn thành sửa chữa chỉ xuất hiện khi chỉnh sửa lịch cũ */}
                            {isEditingSchedule && (
                                <Form.Item name="isCompleted" valuePropName="checked">
                                    <Checkbox>Hoàn thành sửa chữa</Checkbox>
                                </Form.Item>
                            )}
                        </Form>
                    </Modal>
                </div>
            )}
        </WorkshopLayout>
    );
};
export default WorkshopHome;