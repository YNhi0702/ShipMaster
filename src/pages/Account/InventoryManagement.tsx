import React, { useEffect, useState } from 'react';
import {
    Table,
    Input,
    message,
    Typography,
    Button,
    Modal,
    Form,
    InputNumber,
    Space,
    Popconfirm,
} from 'antd';
import { SearchOutlined, EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { collection, getDocs, updateDoc, deleteDoc, doc, addDoc } from 'firebase/firestore';
import type { ColumnsType } from 'antd/es/table';
import { db } from '../../firebase';

const { Title } = Typography;

// Định nghĩa Interface của vật liệu tồn kho
interface InventoryItem {
    id: string; // ID tài liệu Firestore
    [key: string]: any; // Hỗ trợ các trường dữ liệu tùy biến khác
}

const InventoryManagement: React.FC = () => {
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]); // Danh sách vật liệu
    const [loading, setLoading] = useState<boolean>(true); // Trạng thái spinner đang tải dữ liệu
    const [searchText, setSearchText] = useState<string>(''); // Văn bản nhập trong ô tìm kiếm
    const [allFields, setAllFields] = useState<string[]>([]); // Danh sách tất cả các trường dữ liệu tự động phát hiện trong Firestore
    const [isModalVisible, setIsModalVisible] = useState<boolean>(false); // Trạng thái ẩn/hiện Modal CRUD
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null); // Vật liệu đang được chọn để chỉnh sửa (null nếu là thêm mới)
    const [form] = Form.useForm(); // Đối tượng quản lý Form dữ liệu

    /**
     * Tải dữ liệu danh mục vật liệu và tự động phát hiện các trường dữ liệu động của tài liệu
     */
    const fetchInventory = async () => {
        try {
            setLoading(true);
            const snapshot = await getDocs(collection(db, 'material'));

            const items: InventoryItem[] = [];
            const fieldSet = new Set<string>(); // Sử dụng Set để lưu trữ các tên cột duy nhất mà không bị trùng lặp

            snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();
                const item: InventoryItem = {
                    id: docSnap.id,
                    ...data,
                };

                // Thuật toán quét tất cả các keys (thuộc tính) trong dữ liệu để hỗ trợ hiển thị bảng động
                Object.keys(data).forEach((key) => fieldSet.add(key));

                items.push(item);
            });

            // Danh sách các trường phổ biến được ưu tiên hiển thị trước
            const commonFields = [
                'Name',
                'name',
                'MaterialName',
                'Unit',
                'unit',
                'Quantity',
                'quantity',
                'Stock',
                'stock',
                'Price',
                'price',
                'UnitPrice',
                'unitPrice',
                'Category',
                'category',
                'Description',
                'description',
            ];

            // Sắp xếp các cột: Các cột phổ biến xếp trước, các trường tùy biến lạ xuất hiện sau
            const sortedFields = [
                ...commonFields.filter((f) => fieldSet.has(f)),
                ...Array.from(fieldSet).filter((f) => !commonFields.includes(f)),
            ];

            setAllFields(sortedFields);
            setInventoryItems(items);
        } catch (error) {
            console.error('Failed to fetch inventory', error);
            message.error('Không thể tải dữ liệu kho!');
        } finally {
            setLoading(false);
        }
    };

    // Tải dữ liệu ngay khi giao diện kho được nạp
    useEffect(() => {
        fetchInventory();
    }, []);

    /**
     * Hàm định dạng hiển thị các kiểu dữ liệu an toàn trên bảng chính
     */
    const formatValue = (value: any): string => {
        if (value === null || value === undefined) {
            return '---';
        }
        if (typeof value === 'number') {
            return value.toLocaleString('vi-VN');
        }
        if (typeof value === 'boolean') {
            return value ? 'Có' : 'Không';
        }
        if (value instanceof Date) {
            return value.toLocaleDateString('vi-VN');
        }
        if (value?.toDate && typeof value.toDate === 'function') {
            try {
                const date = value.toDate();
                return date.toLocaleDateString('vi-VN');
            } catch {
                return String(value);
            }
        }
        return String(value);
    };

    // Hàm định dạng tiền tệ Việt Nam đồng
    const formatCurrency = (value: any): string => {
        const num = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(num)
            ? num.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })
            : '---';
    };

    /**
     * Hàm lấy nhãn hiển thị Việt hóa cho các cột dữ liệu động
     */
    const getFieldLabel = (field: string): string => {
        const labelMap: { [key: string]: string } = {
            Name: 'Tên vật liệu',
            name: 'Tên',
            MaterialName: 'Tên vật liệu',
            Unit: 'Đơn vị',
            unit: 'Đơn vị',
            Quantity: 'Số lượng',
            quantity: 'Số lượng',
            Stock: 'Tồn kho',
            stock: 'Tồn kho',
            Price: 'Giá',
            price: 'Giá',
            UnitPrice: 'Đơn giá',
            unitPrice: 'Đơn giá',
            Category: 'Danh mục',
            category: 'Danh mục',
            Description: 'Mô tả',
            description: 'Mô tả',
        };
        return labelMap[field] || field;
    };

    /**
     * Xác định xem một trường dữ liệu có phải là trường liên quan đến tiền tệ hay không
     */
    const shouldFormatAsCurrency = (field: string): boolean => {
        const currencyFields = [
            'Price',
            'price',
            'UnitPrice',
            'unitPrice',
            'Cost',
            'cost',
            'Total',
            'total',
            'Amount',
            'amount',
        ];
        return currencyFields.some((cf) => field.toLowerCase().includes(cf.toLowerCase()));
    };

    // Nhấp nút "Thêm vật liệu" để mở Form rỗng
    const handleAdd = () => {
        setEditingItem(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    // Nhấp nút "Chỉnh sửa" để mở Form điền sẵn dữ liệu của bản ghi được chọn
    const handleEdit = (record: InventoryItem) => {
        setEditingItem(record);
        const formValues: Record<string, any> = {};

        allFields.forEach((field) => {
            formValues[field] = record[field];
        });

        form.setFieldsValue(formValues);
        setIsModalVisible(true);
    };

    // Nhấp nút "Xóa" để xóa tài liệu khỏi collection 'material'
    const handleDelete = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'material', id));
            message.success('Đã xóa vật liệu thành công!');
            fetchInventory();
        } catch (error) {
            console.error('Failed to delete inventory item', error);
            message.error('Không thể xóa vật liệu!');
        }
    };

    // Thực hiện lưu dữ liệu (Thêm mới hoặc Cập nhật)
    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            const saveData: Record<string, any> = {};

            // Nhặt các trường dữ liệu hợp lệ từ form
            allFields.forEach((field) => {
                if (field === 'id') return;
                if (values[field] !== undefined && values[field] !== null && values[field] !== '') {
                    saveData[field] = values[field];
                }
            });

            if (editingItem) {
                // Thực hiện cập nhật tài liệu đã có
                await updateDoc(doc(db, 'material', editingItem.id), saveData);
                message.success('Đã cập nhật vật liệu thành công!');
            } else {
                // Thực hiện tạo tài liệu mới
                await addDoc(collection(db, 'material'), saveData);
                message.success('Đã thêm vật liệu thành công!');
            }

            setIsModalVisible(false);
            form.resetFields();
            setEditingItem(null);
            fetchInventory();
        } catch (error) {
            console.error('Failed to save inventory item', error);
            message.error(editingItem ? 'Không thể cập nhật vật liệu!' : 'Không thể thêm vật liệu!');
        }
    };

    // Hủy bỏ thao tác sửa/thêm
    const handleCancel = () => {
        setIsModalVisible(false);
        form.resetFields();
        setEditingItem(null);
    };

    // Lọc tìm kiếm dữ liệu trên bảng theo từ khóa
    const filteredItems = inventoryItems.filter((item) => {
        if (!searchText) return true;
        const searchLower = searchText.toLowerCase();
        return Object.values(item).some((value) =>
            String(value).toLowerCase().includes(searchLower)
        );
    });

    // Chuyển đổi chuỗi tiền tệ (phân tách dấu phẩy) về số
    const currencyParser = (value?: string): number => {
        if (!value) return 0;
        const parsed = value.replace(/\$\s?|(,*)/g, '');
        const num = Number(parsed);
        return Number.isNaN(num) ? 0 : num;
    };

    // Định dạng số hiển thị trong ô nhập tiền có dấu phân cách hàng nghìn
    const currencyFormatter = (value?: number | string): string => {
        if (value === null || value === undefined || value === '') return '';
        const str = String(value);
        return str.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };

    // Xác định kiểu Input hiển thị động trên Modal dựa theo tên trường
    const getInputComponent = (field: string) => {
        if (shouldFormatAsCurrency(field)) {
            return (
                <InputNumber<number>
                    style={{ width: '100%' }}
                    min={0}
                    formatter={currencyFormatter}
                    parser={currencyParser}
                />
            );
        }

        const lowerField = field.toLowerCase();

        if (
            lowerField.includes('quantity') ||
            lowerField.includes('stock') ||
            lowerField.includes('qty')
        ) {
            return <InputNumber<number> style={{ width: '100%' }} min={0} />;
        }

        if (
            lowerField.includes('description') ||
            lowerField.includes('note') ||
            lowerField.includes('mota')
        ) {
            return <Input.TextArea rows={3} />;
        }

        return <Input />;
    };

    // Định nghĩa danh sách các cột của bảng chính
    const columns: ColumnsType<InventoryItem> = [
        {
            title: 'STT',
            key: 'stt',
            width: 60,
            fixed: 'left',
            render: (_: any, __: InventoryItem, index: number) => index + 1,
        },
        ...allFields.map((field) => ({
            title: getFieldLabel(field),
            dataIndex: field,
            key: field,
            render: (value: any) => {
                if (shouldFormatAsCurrency(field)) {
                    return formatCurrency(value);
                }
                return formatValue(value);
            },
        })),
        {
            title: 'Hành động',
            key: 'actions',
            width: 150,
            fixed: 'right',
            render: (_: any, record: InventoryItem) => (
                <Space>
                    <Button
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                        size="small"
                    />
                    <Popconfirm
                        title="Bạn có chắc chắn muốn xóa vật liệu này?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Xóa"
                        cancelText="Hủy"
                    >
                        <Button type="link" danger icon={<DeleteOutlined />} size="small" />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div className="w-full">
            <div className="flex items-center justify-between mb-4">
                <Title level={4} className="m-0">
                    Danh sách vật liệu
                </Title>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleAdd}
                >
                    Thêm vật liệu
                </Button>
            </div>

            <div className="mb-4">
                <Input
                    placeholder="Tìm kiếm vật liệu..."
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    allowClear
                    style={{ maxWidth: 400 }}
                />
            </div>

            {/* Bảng hiển thị vật tư linh hoạt */}
            <Table<InventoryItem>
                columns={columns}
                dataSource={filteredItems}
                rowKey="id"
                loading={loading}
                bordered
                className="shadow-sm"
                pagination={{
                    pageSize: 10,
                    showSizeChanger: false,
                }}
                scroll={{ x: 'max-content' }}
            />

            {/* Modal thêm / sửa vật liệu */}
            <Modal
                title={editingItem ? 'Chỉnh sửa vật liệu' : 'Thêm vật liệu mới'}
                open={isModalVisible}
                onOk={handleSave}
                onCancel={handleCancel}
                okText={editingItem ? 'Cập nhật' : 'Thêm'}
                cancelText="Hủy"
                width={700}
                destroyOnClose
            >
                <Form form={form} layout="vertical">
                    {allFields.map((field) => {
                        if (field === 'id') return null;

                        const isRequired = ['Name', 'name', 'MaterialName'].includes(field);

                        return (
                            <Form.Item
                                key={field}
                                label={getFieldLabel(field)}
                                name={field}
                                rules={
                                    isRequired
                                        ? [
                                              {
                                                  required: true,
                                                  message: `Vui lòng nhập ${getFieldLabel(field)}!`,
                                              },
                                          ]
                                        : []
                                }
                            >
                                {getInputComponent(field)}
                            </Form.Item>
                        );
                    })}
                </Form>
            </Modal>
        </div>
    );
};

export default InventoryManagement;
