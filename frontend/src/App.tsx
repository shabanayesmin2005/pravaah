import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';

// Pages
import { Login } from './pages/Login';
import { CommandCenter } from './pages/CommandCenter';
import { PlateSearch } from './pages/PlateSearch';
import { TrajectoryPlayback } from './pages/TrajectoryPlayback';
import { Alerts } from './pages/Alerts';
import { Analytics } from './pages/Analytics';
import { BlacklistPage } from './pages/BlacklistPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { NotFound } from './pages/NotFound';

export const App: React.FC = () => {
  const { initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1F2937',
            color: '#F3F4F6',
            border: '1px solid #374151',
            fontSize: '12px',
          },
        }}
      />
      <Routes>
        {/* Public login route */}
        <Route path="/login" element={<Login />} />

        {/* Protected App Shell */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          {/* Command Center - All Roles */}
          <Route index element={<CommandCenter />} />

          {/* Traffic Analytics - All Roles */}
          <Route path="analytics" element={<Analytics />} />

          {/* Alerts Feed - Admin, Police, TrafficAuthority */}
          <Route
            path="alerts"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Police', 'TrafficAuthority']}>
                <Alerts />
              </ProtectedRoute>
            }
          />

          {/* Plate Search - Admin, Police only */}
          <Route
            path="plates"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Police']}>
                <PlateSearch />
              </ProtectedRoute>
            }
          />

          {/* Trajectory Playback - Admin, Police only */}
          <Route
            path="trajectories"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Police']}>
                <TrajectoryPlayback />
              </ProtectedRoute>
            }
          />
          <Route
            path="trajectories/:plate"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Police']}>
                <TrajectoryPlayback />
              </ProtectedRoute>
            }
          />

          {/* Hotlist / Blacklist Management - Admin, Police only */}
          <Route
            path="blacklist"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Police']}>
                <BlacklistPage />
              </ProtectedRoute>
            }
          />

          {/* System Audit Logs - Admin only */}
          <Route
            path="audit-logs"
            element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <AuditLogsPage />
              </ProtectedRoute>
            }
          />

          {/* 404 Catch-All inside shell */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
