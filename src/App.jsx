import React, { useState, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { WorkspaceProvider } from './context/WorkspaceContext.jsx';
import { ProtectedRoute } from './routes/ProtectedRoute.jsx';
import { Header } from './components/Header/Header.jsx';
import { Toast } from './components/Toast/Toast.jsx';
import { Login } from './pages/Login/Login.jsx';
import { Register } from './pages/Register/Register.jsx';
import { ForgotPassword } from './pages/ForgotPassword/ForgotPassword.jsx';
import { Workspaces } from './pages/Workspaces/Workspaces.jsx';
import { Calculator } from './pages/Calculator/Calculator.jsx';
import { History } from './pages/History/History.jsx';
import { Members } from './pages/Members/Members.jsx';

function AppShell() {
  const { user } = useAuth();
  const [toastState, setToastState] = useState({ message: '', isError: false });
  const timerRef = useRef(null);

  const showToast = useCallback((message, isError = false) => {
    setToastState({ message, isError });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setToastState({ message: '', isError: false });
    }, 3000);
  }, []);

  return (
    <div className="wrap">
      {user && <Header />}

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        <Route
          path="/workspaces"
          element={
            <ProtectedRoute>
              <Workspaces onToast={showToast} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calculator"
          element={
            <ProtectedRoute>
              <Calculator onToast={showToast} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <History onToast={showToast} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/members"
          element={
            <ProtectedRoute>
              <Members onToast={showToast} />
            </ProtectedRoute>
          }
        />

        <Route
          path="*"
          element={<Navigate to={user ? '/calculator' : '/login'} replace />}
        />
      </Routes>

      <Toast message={toastState.message} isError={toastState.isError} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WorkspaceProvider>
          <AppShell />
        </WorkspaceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
