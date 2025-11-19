import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { Layout, Avatar, Dropdown, Spin } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import AccountSidebar from './AccountSidebar';

const { Header, Content } = Layout;

interface AccountLayoutProps {
    children?: ReactNode;
}

const AccountLayout: React.FC<AccountLayoutProps> = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);
    const [userName, setUserName] = useState<string>('Kế toán');
    const [loadingUser, setLoadingUser] = useState<boolean>(true);

    useEffect(() => {
        const fetchUserProfile = async () => {
            const cachedName = sessionStorage.getItem('accountantName') || localStorage.getItem('accountantName');
            if (cachedName) {
                setUserName(cachedName);
                setLoadingUser(false);
                return;
            }

            const uid = sessionStorage.getItem('uid') || localStorage.getItem('uid');
            if (!uid) {
                setLoadingUser(false);
                return;
            }

            try {
                const snap = await getDoc(doc(db, 'users', uid));
                if (snap.exists()) {
                    const data = snap.data() as Record<string, any>;
                    const resolvedName = data?.UserName || data?.fullName || data?.name || data?.displayName || 'Kế toán';
                    setUserName(resolvedName);
                    sessionStorage.setItem('accountantName', resolvedName);
                    localStorage.setItem('accountantName', resolvedName);
                }
            } catch (error) {
                console.error('Failed to load accountant profile', error);
            } finally {
                setLoadingUser(false);
            }
        };

        fetchUserProfile();
    }, []);

    const selectedKey = useMemo(() => {
        if (location.pathname.startsWith('/account/payment')) {
            return 'payments';
        }
        return 'invoices';
    }, [location.pathname]);

    return (
        <Layout className="min-h-screen bg-gray-100">
            <AccountSidebar
                selectedKey={selectedKey}
                collapsed={collapsed}
                onCollapse={setCollapsed}
                onSelect={(key) => {
                    if (key === 'invoices') navigate('/account');
                    if (key === 'payments') navigate('/account/payment');
                }}
            />
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
                                    localStorage.removeItem('accountantName');
                                    localStorage.removeItem('role');
                                    localStorage.removeItem('uid');
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

export default AccountLayout;