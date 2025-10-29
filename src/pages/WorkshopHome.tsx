import React, { useEffect, useState } from 'react';
import { Button, Table, Typography, message, Space, Form, DatePicker, Modal, Select, Input } from 'antd';
import moment from 'moment';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import WorkshopLayout from '../components/WorkshopLayout';

const { Title } = Typography;

const WorkshopHome: React.FC = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState<any[]>([]);
    const [selectedKey, setSelectedKey] = useState<'orders' | 'schedule'>('orders');
    const [workshops, setWorkshops] = useState<Array<{ id: string; name: string }>>([]);
    const [selectedWorkshopId, setSelectedWorkshopId] = useState<string | null>(null);
    const [orderSearch, setOrderSearch] = useState<string>('');
    const [scheduleSearch, setScheduleSearch] = useState<string>('');
    const [scheduleDateRange, setScheduleDateRange] = useState<any[] | null>(null);
    const location = useLocation();
    const [userName, setUserName] = useState<string>('');
    const [loadingUser, setLoadingUser] = useState<boolean>(true);
    const [loadingOrders, setLoadingOrders] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    // scheduling modal state
    const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
    const [schedulingOrderId, setSchedulingOrderId] = useState<string | null>(null);
    const [scheduling, setScheduling] = useState(false);
    const [form] = Form.useForm();
    const [isEditingSchedule, setIsEditingSchedule] = useState(false);

    // initialize selected tab from URL query param `tab`
    useEffect(() => {
        try {
            const params = new URLSearchParams(location.search || '');
            const tab = params.get('tab');
            if (tab === 'schedule') setSelectedKey('schedule');
            else setSelectedKey('orders');
        } catch (e) {
            // ignore
        }
    }, [location.search]);

    const fetchOrdersForWorkshop = async (workshopId: string | null) => {
        if (!workshopId) {
            setOrders([]);
            return;
        }

        try {
            setLoadingOrders(true);
            setRefreshing(true);
            // Support a special 'ALL' value to fetch orders for all workshops the user owns
            const orderFieldCandidates = ['workshopId', 'workShopId', 'workshop_id', 'workshop', 'shopId'];
            let ordersSnap: any = null;

            if (workshopId === 'ALL') {
                // If user chose 'ALL', fetch all repair orders and filter client-side to those belonging to any owned workshop
                const allOrders = await getDocs(collection(db, 'repairOrder'));
                const ownedIds = workshops.map((w) => w.id);
                const filtered = allOrders.docs.filter((d) => {
                    const o = d.data();
                    return ownedIds.some((wsid) =>
                        o?.workshopId === wsid ||
                        o?.workShopId === wsid ||
                        o?.workshop === wsid ||
                        o?.workshop_id === wsid ||
                        o?.shopId === wsid
                    );
                });
                ordersSnap = { docs: filtered } as any;
            } else {
                // Try querying repairOrder by common workshop id field names first
                for (const ofld of orderFieldCandidates) {
                    const oq = query(collection(db, 'repairOrder'), where(ofld, '==', workshopId));
                    const snap = await getDocs(oq);
                    if (!snap.empty) {
                        ordersSnap = snap;
                        break;
                    }
                }

                // Fallback: if no direct query returned docs, fetch all orders and filter client-side by any matching field
                if (!ordersSnap) {
                    const allOrders = await getDocs(collection(db, 'repairOrder'));
                    const filtered = allOrders.docs.filter((d) => {
                        const o = d.data();
                        return (
                            o?.workshopId === workshopId ||
                            o?.workShopId === workshopId ||
                            o?.workshop === workshopId ||
                            o?.workshop_id === workshopId ||
                            o?.shopId === workshopId
                        );
                    });
                    ordersSnap = { docs: filtered } as any;
                }
            }

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
                    } catch (e) {
                        // ignore
                    }
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

    const fetchData = async () => {
        const sessionUid = sessionStorage.getItem('uid');
        const uid = sessionUid || auth.currentUser?.uid || null;

        try {
            setLoadingUser(true);
            setLoadingOrders(true);
            setRefreshing(true);

            // fetch owner name: prefer users/{uid}.UserName, then employees (queried by email), then workShop, then auth.displayName
            try {
                // If we have a uid (from session or auth), try users/{uid} first
                const userRef = uid ? doc(db, 'users', uid) : null;
                let resolvedName: string | null = null;
                if (userRef) {
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        const u = userSnap.data();
                        resolvedName = u?.UserName || u?.fullName || u?.name || u?.displayName || null;
                    }
                }

                // If we still don't have a name, try to find an employee record by email (employee docs often aren't keyed by auth uid)
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
                    } catch (e) {
                        // ignore employee lookup errors
                    }
                }

                // If still not found, try workShop collection (doc id might equal uid)
                if (!resolvedName && uid) {
                    const wsDoc = await getDoc(doc(db, 'workShop', uid));
                    if (wsDoc.exists()) resolvedName = wsDoc.data().name || null;
                }

                // final fallback to Firebase Auth displayName or static label
                if (!resolvedName) resolvedName = auth.currentUser?.displayName || 'Chủ xưởng';

                setUserName(resolvedName);
            } catch (e) {
                // ignore
            }

            // fetch list of workshops owned by this user and select the first one by default
            if (!uid) {
                setWorkshops([]);
                setSelectedWorkshopId(null);
                setOrders([]);
            } else {
                try {
                    const ownerFieldCandidates = ['ownerId', 'ownerID', 'ownerid', 'owner', 'ownerUID', 'ownerUid'];
                    const wsAll = await getDocs(collection(db, 'workShop'));
                    const found: Array<{ id: string; name: string }> = [];
                    for (const d of wsAll.docs) {
                        const data: any = d.data();
                        // check owner fields first (explicit common names)
                        let matched = false;
                        for (const fld of ownerFieldCandidates) {
                            const v = data?.[fld];
                            if (!v) continue;
                            // string match
                            if (typeof v === 'string' && (v === uid || v.includes(uid))) {
                                matched = true;
                                break;
                            }
                            // array of strings or ids
                            if (Array.isArray(v)) {
                                if (v.includes(uid) || v.some((el: any) => (typeof el === 'string' && el.includes && el.includes(uid)))) {
                                    matched = true;
                                    break;
                                }
                                // array of objects [{ uid: '...' }, { id: '...' }]
                                if (v.some((el: any) => el && (el.uid === uid || el.id === uid || el.ownerId === uid))) {
                                    matched = true;
                                    break;
                                }
                            }
                            // object with nested id/uid
                            if (typeof v === 'object' && v !== null) {
                                if (v.uid === uid || v.id === uid || v.ownerId === uid) {
                                    matched = true;
                                    break;
                                }
                            }
                        }

                        // fallback: scan all fields for a direct match (covers non-standard schemas)
                        if (!matched) {
                            const keys = Object.keys(data || {});
                            for (const k of keys) {
                                const v = data[k];
                                if (!v) continue;
                                if (typeof v === 'string' && (v === uid || v.includes && v.includes(uid))) {
                                    matched = true;
                                    break;
                                }
                                if (Array.isArray(v)) {
                                    if (v.includes(uid) || v.some((el: any) => (typeof el === 'string' && el.includes && el.includes(uid)))) {
                                        matched = true;
                                        break;
                                    }
                                    if (v.some((el: any) => el && (el.uid === uid || el.id === uid || el.ownerId === uid))) {
                                        matched = true;
                                        break;
                                    }
                                }
                                if (typeof v === 'object' && v !== null) {
                                    if (v.uid === uid || v.id === uid || v.ownerId === uid) {
                                        matched = true;
                                        break;
                                    }
                                }
                            }
                        }

                        // also accept doc id equals uid as a fallback
                        if (!matched && d.id === uid) matched = true;
                        if (matched) {
                            found.push({ id: d.id, name: data?.name || data?.UserName || d.id });
                        }
                    }

                    // (strict) only include workshops where the current user is explicitly an owner

                    setWorkshops(found);
                    const defaultWs = found.length > 0 ? found[0].id : null;
                    // only set selectedWorkshopId if not already chosen by the user
                    if (!selectedWorkshopId && defaultWs) {
                        setSelectedWorkshopId(defaultWs);
                        await fetchOrdersForWorkshop(defaultWs);
                    } else if (selectedWorkshopId) {
                        // refresh orders for the currently selected workshop
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

    // when selectedWorkshopId changes (user picks different workshop), reload orders
    useEffect(() => {
        if (selectedWorkshopId) {
            fetchOrdersForWorkshop(selectedWorkshopId);
        }
    }, [selectedWorkshopId]);



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

    // schedule table columns
    const scheduleColumns = [
        { title: 'STT', key: 'stt', width: 60, render: (_: any, __: any, index: number) => index + 1 },
    { title: 'Ngày', dataIndex: 'date', key: 'date' },
    { title: 'Lịch bắt đầu', dataIndex: 'scheduleStart', key: 'scheduleStart' },
    { title: 'Lịch kết thúc', dataIndex: 'scheduleEnd', key: 'scheduleEnd' },
    { title: 'Tàu', dataIndex: 'shipName', key: 'shipName', render: (v: string) => <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{v}</div> },
    { title: 'Trạng thái', dataIndex: 'Status', key: 'Status', render: (v: string) => <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{v}</div> },
        {
            title: 'Hành động', key: 'action', render: (_: any, record: any) => {
                // consider it 'has schedule' only if BOTH schedule fields exist
                const hasSchedule = !!(record.ScheduleStartDate && record.ScheduleEndDate);
                return (
                    <Button onClick={() => openScheduleForRecord(record)}>
                        {hasSchedule ? 'Chỉnh sửa' : 'Tạo lịch'}
                    </Button>
                );
            },
        },
    ];

    const openScheduleForRecord = (record: any) => {
        setSchedulingOrderId(record.id);
        // determine if this is an edit (existing schedule present)
        const hasSchedule = !!(record.ScheduleStartDate || record.ScheduleEndDate || record._startDate);
        setIsEditingSchedule(hasSchedule);
        // prefill form if schedule exists
        try {
            if (record.ScheduleStartDate && record.ScheduleEndDate) {
                const s = record.ScheduleStartDate?.toDate ? moment(record.ScheduleStartDate.toDate()) : moment(record.ScheduleStartDate);
                const e = record.ScheduleEndDate?.toDate ? moment(record.ScheduleEndDate.toDate()) : moment(record.ScheduleEndDate);
                form.setFieldsValue({ dateRange: [s, e] });
            } else if (record._startDate) {
                const s = moment(record._startDate);
                form.setFieldsValue({ dateRange: [s, s] });
            } else {
                form.resetFields();
            }
        } catch (e) {
            form.resetFields();
        }
        setScheduleModalVisible(true);
    };

    // derive schedule rows from orders and attach a Date object for filtering
    const scheduleRows = orders.map((o) => {
        // prefer schedule-specific fields so we don't mix order-level dates with schedule dates
        let rawDateObj: Date | null = null;
        if (o.ScheduleStartDate?.toDate) rawDateObj = o.ScheduleStartDate.toDate();
        else if (o.ScheduleStartDate instanceof Date) rawDateObj = o.ScheduleStartDate;
        // fallback to legacy StartDate (if a schedule wasn't set via new UI)
        if (!rawDateObj) {
            if (o.StartDate?.toDate) rawDateObj = o.StartDate.toDate();
            else if (o.StartDate instanceof Date) rawDateObj = o.StartDate;
        }
        const date = rawDateObj ? rawDateObj.toLocaleDateString('vi-VN') : (o.createdAt || '—');
    // derive schedule start/end (dự kiến)
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

    // date range filter removed

    const normalize = (str: string) => {
        if (!str) return '';
        // normalize and strip diacritics (using unicode combining marks range)
        return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    };

    // Return true for status values that mean "this order belongs in the schedule tab".
    // Accept both legacy 'Sắp xếp lịch sửa chữa' and new 'Đã lên lịch'.
    const isScheduledStatus = (s: any) => {
        if (!s) return false;
        const norm = normalize(String(s));
        const targets = [normalize('sắp xếp lịch sửa chữa'), normalize('đã lên lịch')];
        return targets.includes(norm);
    };

    const filteredScheduleRows = scheduleRows.filter((r) => {
        // include orders that either have a scheduled status OR already have both ScheduleStartDate & ScheduleEndDate
        const scheduledByStatus = isScheduledStatus(r.Status) || isScheduledStatus(r.status) || isScheduledStatus(r.StatusText);
        const scheduledByFields = !!(r.ScheduleStartDate && r.ScheduleEndDate);
        return scheduledByStatus || scheduledByFields;
    });

    // apply schedule-specific text and date filters
    const normalizedScheduleSearch = (scheduleSearch || '').toString().toLowerCase().trim();
    const filteredScheduleRowsWithSearch = filteredScheduleRows.filter((r) => {
        // text matching across shipName, Status, createdAt (exclude id)
        const hay = `${r.shipName || ''} ${r.Status || ''} ${r.createdAt || ''}`.toLowerCase();
        const textMatch = !normalizedScheduleSearch || hay.includes(normalizedScheduleSearch);

        // date range filter (if provided)
        let dateMatch = true;
        if (scheduleDateRange && scheduleDateRange.length === 2) {
            const [startM, endM] = scheduleDateRange;
            const rowDate = r._startDate ? new Date(r._startDate) : null;
            if (rowDate) {
                // compare as timestamps
                const t = rowDate.getTime();
                const s = startM ? startM.startOf ? startM.startOf('day').valueOf() : startM.valueOf() : null;
                const e = endM ? endM.endOf ? endM.endOf('day').valueOf() : endM.valueOf() : null;
                if (s && e) {
                    dateMatch = t >= s && t <= e;
                }
            } else {
                // if no date for row, exclude when date range specified
                dateMatch = false;
            }
        }

        return textMatch && dateMatch;
    });

    // apply orders text search
    const normalizedOrderSearch = (orderSearch || '').toString().toLowerCase().trim();
    const filteredOrders = orders.filter((o) => {
        if (!normalizedOrderSearch) return true;
        // search only shipName and Status (exclude id)
        const hay = `${o.shipName || ''} ${o.Status || ''}`.toLowerCase();
        return hay.includes(normalizedOrderSearch);
    });

    // (No inspected view here) Workshop only exposes Orders and Schedule via the sidebar.

    return (
        <WorkshopLayout selectedKey={selectedKey} onSelect={(key) => {
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

        {/* 'Inspected' view removed — workshop UI exposes only Orders and Schedule via the sidebar */}

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
                    <Space>
                        {/* create button removed */}
                    </Space>
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
                        onRow={(record: any) => {
                            try {
                                const end = record._endDate ? new Date(record._endDate) : null;
                                if (!end) return {} as any;
                                // normalize to start of day (local)
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

                                const endTime = end.getTime();
                                const tToday = today.getTime();
                                // include whole of 'tomorrow' as yellow: treat anything up to the end of tomorrow as within 1 day after today
                                const endOfTomorrow = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000 - 1); // today + 2 days - 1ms => 23:59:59.999 of tomorrow
                                const tEndOfTomorrow = endOfTomorrow.getTime();

                                // If endDate is today or within 1 day after today (i.e. any time on tomorrow) -> yellow
                                if (endTime >= tToday && endTime <= tEndOfTomorrow) {
                                    return { style: { background: '#fff7e6' } } as any;
                                }

                                // If endDate is before today -> red
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

                <Modal
                    title={'Lịch sửa chữa'}
                    open={scheduleModalVisible}
                    okText="Lưu"
                    cancelText="Huỷ"
                    onCancel={() => { setScheduleModalVisible(false); form.resetFields(); setSchedulingOrderId(null); setIsEditingSchedule(false); }}
                    onOk={async () => {
                        try {
                            const vals = await form.validateFields();
                            const range = vals.dateRange as any[];
                            if (!schedulingOrderId) throw new Error('Order id missing');
                            setScheduling(true);
                            const payload: any = {};
                            let hasBothScheduleFields = false;
                            if (range && range[0] && range[1]) {
                                // store schedule-specific timestamps so we don't overwrite order-level StartDate/EndDate
                                // normalize to whole-day boundaries (local time)
                                const startMoment: any = range[0];
                                const endMoment: any = range[1];
                                const sDate = startMoment.toDate();
                                sDate.setHours(0, 0, 0, 0);
                                const eDate = endMoment.toDate();
                                eDate.setHours(23, 59, 59, 999);
                                payload.ScheduleStartDate = Timestamp.fromDate(sDate);
                                payload.ScheduleEndDate = Timestamp.fromDate(eDate);
                                hasBothScheduleFields = true;
                            }
                            // only set status to 'Đã lên lịch' when both schedule fields exist
                            if (hasBothScheduleFields) {
                                payload.Status = 'Đã lên lịch';
                            }
                            await updateDoc(doc(db, 'repairOrder', schedulingOrderId), payload);
                            if (isEditingSchedule) message.success('Đã cập nhật lịch cho đơn');
                            else message.success('Đã tạo lịch cho đơn');
                            setScheduleModalVisible(false);
                            form.resetFields();
                            setSchedulingOrderId(null);
                            // refresh only the orders for the currently selected workshop so we stay on that workshop's tab
                            await fetchOrdersForWorkshop(selectedWorkshopId);
                            // ensure we remain on schedule view for that workshop
                            setSelectedKey('schedule');
                        } catch (e: any) {
                            message.error((e && e.message) || 'Lỗi khi tạo lịch');
                        } finally {
                            setScheduling(false);
                            setIsEditingSchedule(false);
                        }
                    }}
                    confirmLoading={scheduling}
                >
                    <Form form={form} layout="vertical">
                        <Form.Item name="dateRange" label="Chọn ngày bắt đầu - kết thúc" rules={[{ required: true }]}> 
                            <DatePicker.RangePicker />
                        </Form.Item>
                    </Form>
                </Modal>
            </div>
        )}
    </WorkshopLayout>
);
};

export default WorkshopHome;
