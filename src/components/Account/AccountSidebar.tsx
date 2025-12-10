import React from 'react';
import { Layout, Menu, Button } from 'antd';
import { DollarCircleOutlined, MenuFoldOutlined, MenuUnfoldOutlined, CreditCardOutlined, InboxOutlined, DashboardOutlined, FileTextOutlined, BarChartOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Sider } = Layout;

interface AccountSidebarProps {
    selectedKey?: string;
    onSelect?: (key: string) => void;
    collapsed?: boolean;
    onCollapse?: (collapsed: boolean) => void;
}

const AccountSidebar: React.FC<AccountSidebarProps> = ({ selectedKey = 'invoices', onSelect, collapsed = false, onCollapse }) => {
    const navigate = useNavigate();

    const handleSelect = (key: string) => {
        if (onSelect) {
            onSelect(key);
            return;
        }

        if (key === 'invoices') navigate('/account');
        if (key === 'payments') navigate('/account/payment');
        if (key === 'inventory') navigate('/account/inventory');
        if (key === 'statistics') navigate('/account/statistics');
    };

    const menuItems = [
        {
            key: 'invoices',
            icon: <FileTextOutlined />,
            label: 'Hóa đơn',
            onClick: () => navigate('/account/invoices'),
        },
        {
            key: 'payments',
            icon: <CreditCardOutlined />,
            label: 'Thanh toán',
        },
        {
            key: 'inventory',
            icon: <InboxOutlined />,
            label: 'Quản lý kho',
        },
        {
            key: 'statistics',
            icon: <BarChartOutlined />,
            label: 'Thống kê',
            onClick: () => navigate('/account/statistics'),
        },
    ];

    return (
        <Sider
            width={220}
            collapsible
            collapsed={collapsed}
            onCollapse={onCollapse}
            trigger={null}
            className="bg-white shadow-md min-h-screen"
        >
            <div
                className="h-16 flex items-center justify-center text-2xl font-bold border-b select-none cursor-pointer"
                onClick={() => navigate('/account')}
            >
                {!collapsed ? (
                    <div className="flex items-center gap-2">
                        <Button
                            type="text"
                            size="small"
                            icon={<MenuFoldOutlined />}
                            onClick={() => onCollapse && onCollapse(true)}
                        />
                        <span>
                            Ship <span className="text-blue-600 ml-1">Master</span>
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <Button
                            type="text"
                            size="small"
                            icon={<MenuUnfoldOutlined />}
                            onClick={() => onCollapse && onCollapse(false)}
                        />
                        <span className="text-blue-600">SM</span>
                    </div>
                )}
            </div>

            <Menu
                mode="inline"
                selectedKeys={[selectedKey]}
                style={{ height: '100%', borderRight: 0 }}
                onClick={({ key }) => handleSelect(key as string)}
                items={menuItems}
            />
        </Sider>
    );
};

export default AccountSidebar;