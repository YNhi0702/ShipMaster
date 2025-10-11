import React from 'react';
import { Layout, Avatar, Spin, Dropdown, Typography } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Header, Content } = Layout;
const { Title } = Typography;

interface CustomerLayoutProps {
    userName: string;
    loadingUser: boolean;
    children: React.ReactNode;
}

const CustomerLayout: React.FC<CustomerLayoutProps> = ({ userName, loadingUser, children }) => {
    const navigate = useNavigate();

    return (
        <Layout className="min-h-screen bg-gray-100">
            <Header className="bg-white shadow-md px-6 py-4 flex justify-between items-center">
                <div
                    className="m-0 flex items-center gap-2 select-none cursor-pointer"
                    onClick={() => navigate('/')}
                >
                    <Title level={3} className="m-0">
                        Ship <span className="text-blue-600">Master</span>
                    </Title>
                </div>

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
                        },
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
    );
};

export default CustomerLayout;


