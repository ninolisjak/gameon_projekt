import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AuthGuard from './components/AuthGuard';
import DashboardLayout from './components/DashboardLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AccessDeniedPage from './pages/AccessDeniedPage';
import VenuesPage from './pages/VenuesPage';
import VenueEditPage from './pages/VenueEditPage';
import ScheduleEditPage from './pages/ScheduleEditPage';
import ReservationsPage from './pages/ReservationsPage';
import RevenuePage from './pages/RevenuePage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/access-denied" element={<AccessDeniedPage />} />

          <Route
            element={
              <AuthGuard>
                <DashboardLayout />
              </AuthGuard>
            }
          >
            <Route path="/venues" element={<VenuesPage />} />
            <Route path="/venues/new" element={<VenueEditPage />} />
            <Route path="/venues/:id" element={<VenueEditPage />} />
            <Route path="/venues/:id/schedule" element={<ScheduleEditPage />} />
            <Route path="/reservations" element={<ReservationsPage />} />
            <Route path="/revenue" element={<RevenuePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/venues" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
