import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import Navbar from './components/common/Navbar';

// Driver pages (public)
import HomePage from './pages/driver/HomePage';
import FloorDetailPage from './pages/driver/FloorDetailPage';

// Auth
import LoginPage from './pages/LoginPage';

// Security
import SecurityDashboard from './pages/security/SecurityDashboard';

// Admin
import AdminLayout from './pages/admin/AdminLayout';
import AdminOverview from './pages/admin/AdminOverview';
import AdminFloors from './pages/admin/AdminFloors';
import AdminStaff from './pages/admin/AdminStaff';

import './styles/globals.css';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ─── Public Driver Routes ─────────────────────── */}
          <Route
            path="/"
            element={
              <>
                <Navbar />
                <HomePage />
              </>
            }
          />
          <Route
            path="/floor/:id"
            element={
              <>
                <Navbar />
                <FloorDetailPage />
              </>
            }
          />

          {/* ─── Auth ─────────────────────────────────────── */}
          <Route
            path="/login"
            element={
              <>
                <Navbar />
                <LoginPage />
              </>
            }
          />

          {/* ─── Security Staff ───────────────────────────── */}
          <Route
            path="/security"
            element={
              <ProtectedRoute allowedRoles={['security', 'admin']}>
                <Navbar />
                <SecurityDashboard />
              </ProtectedRoute>
            }
          />

          {/* ─── Admin (nested with sidebar layout) ──────── */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <>
                  <Navbar />
                  <AdminLayout />
                </>
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminOverview />} />
            <Route path="floors" element={<AdminFloors />} />
            <Route path="staff" element={<AdminStaff />} />
          </Route>

          {/* ─── Fallback ─────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
