import React from 'react';
import { Layout, Menu, Button } from 'antd';
import { UserOutlined, ShopOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';

const { Sider } = Layout;

interface DirectorSidebarProps {
    collapsed?: boolean;
    onCollapse?: (collapsed: boolean) => void;
}

const DirectorSidebar: React.FC<DirectorSidebarProps> = ({ collapsed = false, onCollapse }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const getSelectedKey = () => {
        const path = location.pathname;
        if (path.includes('/director/workshops')) return 'workshops';
        return 'users';
    };

    const menuItems = [
        {
            key: 'users',
            icon: <UserOutlined />,
            label: 'Quản lý người dùng',
            onClick: () => navigate('/director/users'),
        },
        {
            key: 'workshops',
            icon: <ShopOutlined />,
            label: 'Quản lý xưởng',
            onClick: () => navigate('/director/workshops'),
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
                onClick={() => navigate('/director')}
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
                theme="light"
                mode="inline"
                selectedKeys={[getSelectedKey()]}
                style={{ height: '100%', borderRight: 0 }}
                items={menuItems}
            />
        </Sider>
    );
};

export default DirectorSidebar;
