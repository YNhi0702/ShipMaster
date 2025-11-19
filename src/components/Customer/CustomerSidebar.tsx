
import React, { useState } from 'react';
import { Layout, Menu, Typography, Button } from 'antd';
import { LogoutOutlined, MenuUnfoldOutlined, MenuFoldOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Sider } = Layout;
const { Title, Text } = Typography;

interface SidebarProps {
    userName: string;
    selectedKey?: string;
    onLogout?: () => void;
}

const SidebarComponent: React.FC<SidebarProps> = ({ userName, selectedKey = 'orders', onLogout }) => {
    const [collapsed, setCollapsed] = useState(false);
    const navigate = useNavigate();

    const toggleCollapsed = () => setCollapsed(!collapsed);

    const handleMenuSelect = (e: any) => {
        const key = e.key;
        if (key === 'orders') {
            navigate('/');
        } else if (key === 'create_order') {
            navigate('/create');
        }
    };

    return (
        <Sider
            collapsible
            collapsed={collapsed}
            onCollapse={setCollapsed}
            breakpoint="md"
            collapsedWidth={60}
            style={{ minHeight: '100vh', backgroundColor: '#0f172a' }}
            trigger={null}
        >
            <div className="flex flex-col h-full p-4 text-white justify-between">
                {/* Phần trên */}
                <div>
                    <div className="flex justify-between items-center mb-6">
                        <Title
                            level={3}
                            className="text-white m-0"
                            style={{ whiteSpace: 'nowrap', userSelect: 'none' }}
                        >
                            {collapsed ? 'SM' : 'ShipMaster'}
                        </Title>
                        <Button
                            type="text"
                            onClick={toggleCollapsed}
                            className="text-white md:hidden"
                            aria-label="Toggle menu"
                        >
                            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                        </Button>
                    </div>

                    {!collapsed && (
                        <>
                            <div className="mb-10">
                                <Text className="text-white text-lg select-none">
                                    Xin chào, <br />
                                    <strong>{userName}</strong>
                                </Text>
                            </div>

                            <Menu
                                theme="dark"
                                mode="inline"
                                selectedKeys={[selectedKey]}
                                onClick={handleMenuSelect}
                                style={{ backgroundColor: 'transparent' }}
                                items={[
                                    {
                                        key: 'orders',
                                        label: 'Quản lý đơn hàng',
                                    },
                                    {
                                        key: 'create_order',
                                        label: 'Tạo đơn sửa chữa',
                                    },
                                ]}
                            />
                        </>
                    )}
                </div>

                {/* Phần dưới: nút đăng xuất */}
                <div className="mt-6">
                    <Button
                        type="primary"
                        danger
                        block
                        icon={<LogoutOutlined />}
                        onClick={onLogout}
                        style={{ borderRadius: 6 }}
                    >
                        {collapsed ? '' : 'Đăng xuất'}
                    </Button>
                </div>
            </div>
        </Sider>
    );
};

export default SidebarComponent;
