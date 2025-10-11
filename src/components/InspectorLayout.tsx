import React, { useState } from 'react';
import { Layout, Avatar, Spin, Dropdown, Button } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import InspectorSidebar from './InspectorSidebar';

const { Header, Content } = Layout;

interface InspectorLayoutProps {
    selectedKey: 'orders' | 'proposal';
    onSelect: (key: 'orders' | 'proposal') => void;
    userName: string;
    loadingUser: boolean;
    children: React.ReactNode;
}

const InspectorLayout: React.FC<InspectorLayoutProps> = ({ selectedKey, onSelect, userName, loadingUser, children }) => {
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <Layout className="min-h-screen bg-gray-100">
            <InspectorSidebar
                selectedKey={selectedKey}
                onSelect={(key) => onSelect(key as 'orders' | 'proposal')}
                collapsed={collapsed}
                onCollapse={setCollapsed}
            />
            <Layout>
                <Header className="bg-white shadow-md flex justify-end items-center px-6 py-4">
                    <Dropdown
                        trigger={["click"]}
                        placement="bottomRight"
                        menu={{
                            items: [
                                { key: 'logout', label: 'Đăng xuất' },
                            ],
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

export default InspectorLayout;


