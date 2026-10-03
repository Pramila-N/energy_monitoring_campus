import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { AdminLayout } from './components/layout/AdminLayout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Campus from './pages/Campus.jsx';
import Buildings from './pages/Buildings.jsx';
import BuildingDetail from './pages/BuildingDetail.jsx';
import Classrooms from './pages/Classrooms.jsx';
import ClassroomDetail from './pages/ClassroomDetail.jsx';
import Energy from './pages/Energy.jsx';
import Appliances from './pages/Appliances.jsx';
import Predictions from './pages/Predictions.jsx';
import Alerts from './pages/Alerts.jsx';
import Recommendations from './pages/Recommendations.jsx';
import Reports from './pages/Reports.jsx';

function Protected({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Protected>
            <AdminLayout />
          </Protected>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/campus" element={<Campus />} />
        <Route path="/buildings" element={<Buildings />} />
        <Route path="/buildings/:id" element={<BuildingDetail />} />
        <Route path="/classrooms" element={<Classrooms />} />
        <Route path="/classrooms/:id" element={<ClassroomDetail />} />
        <Route path="/energy" element={<Energy />} />
        <Route path="/appliances" element={<Appliances />} />
        <Route path="/predictions" element={<Predictions />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/recommendations" element={<Recommendations />} />
        <Route path="/reports" element={<Reports />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}