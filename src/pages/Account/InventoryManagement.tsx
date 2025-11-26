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

interface InventoryItem {
    id: string;
    [key: string]: any;
}

const InventoryManagement: React.FC = () => {
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [searchText, setSearchText] = useState<string>('');
    const [allFields, setAllFields] = useState<string[]>([]);
    const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [form] = Form.useForm();

    const fetchInventory = async () => {
        try {
            setLoading(true);
            const snapshot = await getDocs(collection(db, 'material'));

            const items: InventoryItem[] = [];
            const fieldSet = new Set<string>();

            snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();
                const item: InventoryItem = {
                    id: docSnap.id,
                    ...data,
                };

                // Collect all field names
                Object.keys(data).forEach((key) => fieldSet.add(key));

                items.push(item);
            });

            // Sort fields to show common ones first
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

    useEffect(() => {
        fetchInventory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    const formatCurrency = (value: any): string => {
        const num = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(num)
            ? num.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })
            : '---';
    };

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

    const handleAdd = () => {
        setEditingItem(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    const handleEdit = (record: InventoryItem) => {
        setEditingItem(record);
        const formValues: Record<string, any> = {};

        allFields.forEach((field) => {
            formValues[field] = record[field];
        });

        form.setFieldsValue(formValues);
        setIsModalVisible(true);
    };

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

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            const saveData: Record<string, any> = {};

            allFields.forEach((field) => {
                if (field === 'id') return;
                if (values[field] !== undefined && values[field] !== null && values[field] !== '') {
                    saveData[field] = values[field];
                }
            });

            if (editingItem) {
                // Update existing item
                await updateDoc(doc(db, 'material', editingItem.id), saveData);
                message.success('Đã cập nhật vật liệu thành công!');
            } else {
                // Add new item
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

    const handleCancel = () => {
        setIsModalVisible(false);
        form.resetFields();
        setEditingItem(null);
    };

    const filteredItems = inventoryItems.filter((item) => {
        if (!searchText) return true;
        const searchLower = searchText.toLowerCase();
        return Object.values(item).some((value) =>
            String(value).toLowerCase().includes(searchLower),
        );
    });

    const currencyParser = (value?: string): number => {
        if (!value) return 0;
        const parsed = value.replace(/\$\s?|(,*)/g, '');
        const num = Number(parsed);
        return Number.isNaN(num) ? 0 : num;
    };

    const currencyFormatter = (value?: number | string): string => {
        if (value === null || value === undefined || value === '') return '';
        const str = String(value);
        return str.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };

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
                    >
            
                    </Button>
                    <Popconfirm
                        title="Bạn có chắc chắn muốn xóa vật liệu này?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Xóa"
                        cancelText="Hủy"
                    >
                        <Button type="link" danger icon={<DeleteOutlined />} size="small">
    
                        </Button>
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
                        // Skip id field in form
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
