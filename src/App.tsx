// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import PrivateRoute from './routes/PrivateRoute';
import AuthenComponent from "./pages/Auth/AuthenComponent";

// CUSTOMER
import CustomerHome from "./pages/Customer/CustomerHome";
import OrderDetail from "./pages/Customer/OrderDetail";
import CreateOrder from "./pages/Customer/CreateOrder";

// INSPECTOR
import InspectorHome from "./pages/Inspector/InspectorHome";
import OrderDetailInspector from "./pages/Inspector/OrderDetailInspector";
import ProposalInspector from "./pages/Inspector/ProposalInspector";
import OrderDetailDone from "./pages/Inspector/OrderDetailDone";

// WORKSHOP
import WorkshopHome from "./pages/Workshop/WorkshopHome";
import OrderInfo from "./pages/Workshop/OrderInfo";

// ACCOUNTANT
import AccountLayout from "./components/Account/AccountLayout";
import AccountHome from "./pages/Account/AccountHome";
import PaymentList from "./pages/Account/PaymentList";
import InventoryManagement from "./pages/Account/InventoryManagement";
import StatisticsPage from "./pages/Account/StatisticsPage";

// DIRECTOR
import DirectorLayout from "./components/Director/DirectorLayout";
import UserManagement from "./pages/Director/UserManagement";
import WorkshopManagement from "./pages/Director/WorkshopManagement";

const App: React.FC = () => {
  return (
    <Router>
      <Routes>

        {/* LOGIN */}
        <Route path="/login" element={<AuthenComponent />} />

        {/* ============ CUSTOMER ============ */}
        <Route
          path="/"
          element={
            <PrivateRoute allowedRoles={['customer']}>
              <CustomerHome />
            </PrivateRoute>
          }
        />

        <Route
          path="/orders/:id"
          element={
            <PrivateRoute allowedRoles={['customer']}>
              <OrderDetail />
            </PrivateRoute>
          }
        />

        <Route
          path="/createRepairOrder"
          element={
            <PrivateRoute allowedRoles={['customer']}>
              <CreateOrder />
            </PrivateRoute>
          }
        />

        {/* ============ INSPECTOR ============ */}
        <Route
          path="/inspector"
          element={
            <PrivateRoute allowedRoles={['inspector', 'officer', '1']}>
              <InspectorHome />
            </PrivateRoute>
          }
        />

        <Route
          path="/inspector/orders/:id"
          element={
            <PrivateRoute allowedRoles={['inspector', 'officer', '1']}>
              <OrderDetailInspector />
            </PrivateRoute>
          }
        />

        <Route
          path="/inspector/done/:id"
          element={
            <PrivateRoute allowedRoles={['inspector', 'officer', '1']}>
              <OrderDetailDone />
            </PrivateRoute>
          }
        />

        <Route
          path="/inspector/proposal/:id"
          element={
            <PrivateRoute allowedRoles={['inspector', 'officer', '1']}>
              <ProposalInspector />
            </PrivateRoute>
          }
        />

        {/* ============ WORKSHOP ============ */}
        <Route
          path="/workshop"
          element={
            <PrivateRoute allowedRoles={['workshop', 'workshop_owner', '2', 'owner']}>
              <WorkshopHome />
            </PrivateRoute>
          }
        />

        <Route
          path="/workshop/orders/:id"
          element={
            <PrivateRoute allowedRoles={['workshop', 'workshop_owner', '2', 'owner']}>
              <OrderInfo />
            </PrivateRoute>
          }
        />

        {/* ============ ACCOUNTANT ============ */}
        <Route
          path="/account"
          element={
            <PrivateRoute allowedRoles={['accountant']}>
              <AccountLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<AccountHome />} />
          <Route path="payment" element={<PaymentList />} />
          <Route path="inventory" element={<InventoryManagement />} />
          <Route path="statistics" element={<StatisticsPage />} />   {/* 👈 ĐÃ THÊM ROUTE NÀY */}
        </Route>

        {/* ============ DIRECTOR ============ */}
        <Route
          path="/director"
          element={
            <PrivateRoute allowedRoles={['director']}>
              <DirectorLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<UserManagement />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="workshops" element={<WorkshopManagement />} />
        </Route>

      </Routes>
    </Router>
  );
};

export default App;
