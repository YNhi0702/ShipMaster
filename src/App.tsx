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

const App: React.FC = () => {
  return (
    <Router>
      <Routes>

        {/* LOGIN */}
        <Route path="/login" element={<AuthenComponent />} />

        {/* CUSTOMER HOME */}
        <Route
          path="/"
          element={
            <PrivateRoute allowedRoles={['customer']}>
              <CustomerHome />
            </PrivateRoute>
          }
        />

        {/* CUSTOMER - ORDER DETAIL */}
        <Route
          path="/orders/:id"
          element={
            <PrivateRoute allowedRoles={['customer']}>
              <OrderDetail />
            </PrivateRoute>
          }
        />

        {/* INSPECTOR - ORDER DETAIL */}
        <Route
          path="/inspector/orders/:id"
          element={
            <PrivateRoute allowedRoles={['inspector', 'officer', '1']}>
              <OrderDetailInspector />
            </PrivateRoute>
          }
        />

        {/* INSPECTOR - DONE DETAIL */}
        <Route
          path="/inspector/done/:id"
          element={
            <PrivateRoute allowedRoles={['inspector', 'officer', '1']}>
              <OrderDetailDone />
            </PrivateRoute>
          }
        />

        {/* INSPECTOR - PROPOSAL */}
        <Route
          path="/inspector/proposal/:id"
          element={
            <PrivateRoute allowedRoles={['inspector', 'officer', '1']}>
              <ProposalInspector />
            </PrivateRoute>
          }
        />

        {/* CUSTOMER - CREATE ORDER */}
        <Route
          path="/createRepairOder"
          element={
            <PrivateRoute allowedRoles={['customer']}>
              <CreateOrder />
            </PrivateRoute>
          }
        />

        {/* INSPECTOR HOME */}
        <Route
          path="/inspector"
          element={
            <PrivateRoute allowedRoles={['inspector', 'officer', '1']}>
              <InspectorHome />
            </PrivateRoute>
          }
        />

        {/* WORKSHOP HOME */}
        <Route
          path="/workshop"
          element={
            <PrivateRoute allowedRoles={['workshop', '2', 'workshop_owner', 'owner']}>
              <WorkshopHome />
            </PrivateRoute>
          }
        />

        {/* WORKSHOP ORDER DETAIL */}
        <Route
          path="/workshop/orders/:id"
          element={
            <PrivateRoute allowedRoles={['workshop', '2', 'workshop_owner', 'owner']}>
              <OrderInfo />
            </PrivateRoute>
          }
        />

        {/* ACCOUNTANT */}
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
        </Route>

      </Routes>
    </Router>
  );
};

export default App;
