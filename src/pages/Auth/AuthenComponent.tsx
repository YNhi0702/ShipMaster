import React from 'react';
import { Tabs, Typography } from 'antd';
import Login from './Login';
import Register from './Register';

const { TabPane } = Tabs;
const { Title } = Typography;

const AuthenComponent: React.FC = () => {
    return (
        <div
            className="min-h-screen flex items-center justify-center bg-cover bg-center relative"
            style={{
                backgroundImage:
                    'url(https://reddragoncons.com/storage/2020/10/cong-ty-sua-chua-tau-bien.jpg)',
            }}
        >
            <div className="absolute inset-0 bg-black opacity-60"></div>

            <div className="relative bg-white rounded-lg shadow-lg max-w-4xl w-full mx-4 flex flex-col md:flex-row overflow-hidden">
                <div
                    className="hidden md:block md:w-1/2 bg-cover bg-center"
                    style={{
                        backgroundImage:
                            'url(https://images.unsplash.com/photo-1542744173-05336fcc7ad4?auto=format&fit=crop&w=800&q=80)',
                    }}
                />

                <div
                    className="w-full md:w-1/2 p-6 sm:p-10"
                    style={{ minHeight: '75vh', transition: 'min-height 0.3s ease' }}
                >
                    <Title level={3} className="text-center mb-6 font-semibold">
                        Ship <span className="text-blue-600">Master</span>
                    </Title>

                    <Tabs defaultActiveKey="login" size="large" centered>
                        <TabPane tab="Đăng nhập" key="login">
                            <Login />
                        </TabPane>
                        <TabPane tab="Đăng ký" key="register">
                            <Register />
                        </TabPane>
                    </Tabs>
                </div>
            </div>
        </div>
    );
};

export default AuthenComponent;
