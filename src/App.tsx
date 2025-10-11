// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PrivateRoute from './routes/PrivateRoute';
import AuthenComponent from "./pages/AuthenComponent";
import CustomerHome from "./pages/CustomerHome";
import OrderDetail from "./pages/OrderDetail";
import CreateOrder from "./pages/CreateOrder";
import InspectorHome from "./pages/InspectorHome";
import OrderDetailInspector from "./pages/OrderDetailInspector";
import ProposalInspector from "./pages/ProposalInspector";

const App: React.FC = () => {
  return (
      <Router>
        <Routes>
          <Route path="/login" element={<AuthenComponent />} />

          <Route
              path="/"
              element={
                <PrivateRoute allowedRoles={['customer']}>
                    <CustomerHome/>
                </PrivateRoute>
              }
          />
      <Route path="/orders/:id"
           element={
        <PrivateRoute allowedRoles={['customer']}>
          <OrderDetail />
        </PrivateRoute>} />

      {/* Route chi tiết đơn cho inspector */}
      <Route path="/inspector/orders/:id"
           element={
        <PrivateRoute allowedRoles={['inspector', 'officer', '1']}>
          <OrderDetailInspector />
        </PrivateRoute>} />

      {/* Route đề xuất phương án cho inspector */}
      <Route path="/inspector/proposal/:id"
           element={
        <PrivateRoute allowedRoles={['inspector', 'officer', '1']}>
          <ProposalInspector />
        </PrivateRoute>} />
            <Route path="/createRepairOder"
                   element={
                       <PrivateRoute allowedRoles={['customer']}>
                           <CreateOrder />
                       </PrivateRoute>} />

          <Route
            path="/inspector"
            element={
              <PrivateRoute allowedRoles={['inspector', 'officer', '1']}>
                <InspectorHome />
              </PrivateRoute>
            }
          />
        </Routes>
      </Router>
  );
};

export default App;
