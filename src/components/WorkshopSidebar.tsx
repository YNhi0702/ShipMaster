import React from 'react';
import { Layout, Menu, Button } from 'antd';
import { SolutionOutlined, CalendarOutlined, TeamOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Sider } = Layout;

interface WorkshopSidebarProps {
	selectedKey?: string;
	onSelect?: (k: string) => void;
	collapsed?: boolean;
	onCollapse?: (c: boolean) => void;
}

const WorkshopSidebar: React.FC<WorkshopSidebarProps> = ({ selectedKey = 'orders', onSelect, collapsed = false, onCollapse }) => {
	const navigate = useNavigate();

	return (
		<Sider width={220} collapsible collapsed={collapsed} onCollapse={onCollapse} trigger={null} className="bg-white shadow-md min-h-screen">
			<div className="h-16 flex items-center justify-center text-2xl font-bold border-b select-none cursor-pointer" onClick={() => navigate('/workshop')}>
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
				onClick={({ key }) => onSelect && onSelect(key as string)}
				items={[
					{ key: 'orders', icon: <SolutionOutlined />, label: 'Đơn sửa chữa' },
					{ key: 'schedule', icon: <CalendarOutlined />, label: 'Lịch sửa chữa' },
					{ key: 'employees', icon: <TeamOutlined />, label: 'Quản lý nhân sự' },
				]}
			/>
		</Sider>
	);
};

export default WorkshopSidebar;

