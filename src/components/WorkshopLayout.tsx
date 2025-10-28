import React, { useState } from 'react';
import { Layout, Avatar, Spin, Dropdown } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import WorkshopSidebar from './WorkshopSidebar';

const { Header, Content } = Layout;

interface WorkshopLayoutProps {
    selectedKey?: 'orders' | 'proposal' | 'schedule' | 'inspected';
    onSelect?: (k: string) => void;
    userName: string;
    loadingUser: boolean;
    children: React.ReactNode;
}

const WorkshopLayout: React.FC<WorkshopLayoutProps> = ({ selectedKey = 'orders', onSelect, userName, loadingUser, children }) => {
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false);

    const defaultOnSelect = (k: string) => {
        if (k === 'orders') navigate('/workshop');
        else if (k === 'schedule') navigate('/workshop?tab=schedule');
        else if (k === 'inspected') navigate('/workshop?tab=inspected');
        else navigate('/workshop');
    };

    return (
        <Layout className="min-h-screen bg-gray-100">
            <WorkshopSidebar selectedKey={selectedKey} onSelect={(k) => onSelect ? onSelect(k) : defaultOnSelect(k)} collapsed={collapsed} onCollapse={setCollapsed} />
            <Layout>
                <Header className="bg-white shadow-md flex justify-end items-center px-6 py-4">
                    <Dropdown
                        trigger={["click"]}
                        placement="bottomRight"
                        menu={{
                            items: [{ key: 'logout', label: 'Đăng xuất' }],
                            onClick: ({ key }: { key: string }) => {
                                if (key === 'logout') {
                                    sessionStorage.clear();
                                    navigate('/login');
                                }
                            }
                        }}
                    >
                        <div className="flex items-center gap-3 select-none text-xl font-bold cursor-pointer">
                            <Avatar icon={<UserOutlined />} />
                            {loadingUser ? <Spin size="small" /> : <span>{userName}</span>}
                        </div>
                    </Dropdown>
                </Header>
                <Content className="m-6 p-6 bg-white rounded-lg shadow">
                    {children}
                </Content>
            </Layout>
        </Layout>
    );
};

export default WorkshopLayout;
