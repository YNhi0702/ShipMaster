import React, { ReactNode, useEffect, useState } from 'react';
import { Layout, Avatar, Dropdown, Spin } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { Outlet, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import DirectorSidebar from './DirectorSidebar';

const { Header, Content } = Layout;

interface DirectorLayoutProps {
    children?: ReactNode;
}

const DirectorLayout: React.FC<DirectorLayoutProps> = ({ children }) => {
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false);
    const [userName, setUserName] = useState<string>('Giám đốc');
    const [loadingUser, setLoadingUser] = useState<boolean>(true);

    useEffect(() => {
        const fetchUserProfile = async () => {
            const uid = sessionStorage.getItem('uid') || localStorage.getItem('uid');
            if (!uid) {
                setLoadingUser(false);
                return;
            }

            try {
                const snap = await getDoc(doc(db, 'users', uid));
                if (snap.exists()) {
                    const data = snap.data() as Record<string, any>;
                    const resolvedName = data?.UserName || data?.fullName || data?.username || data?.name || data?.displayName || 'Giám đốc';
                    setUserName(resolvedName);
                }
            } catch (error) {
                console.error('Failed to load director profile', error);
            } finally {
                setLoadingUser(false);
            }
        };

        fetchUserProfile();
    }, []);

    return (
        <Layout className="min-h-screen bg-gray-100">
            <DirectorSidebar collapsed={collapsed} onCollapse={setCollapsed} />
            <Layout>
                <Header className="bg-white shadow-md flex justify-end items-center px-6 py-4">
                    <Dropdown
                        trigger={["click"]}
                        placement="bottomRight"
                        menu={{
                            items: [{ key: 'logout', label: 'Đăng xuất' }],
                            onClick: ({ key }) => {
                                if (key === 'logout') {
                                    sessionStorage.clear();
                                    localStorage.clear();
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
                    {children ?? <Outlet />}
                </Content>
            </Layout>
        </Layout>
    );
};

export default DirectorLayout;
