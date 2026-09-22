import { createBrowserRouter, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import LoginPage from '@/pages/auth/Login';
import RegisterPage from '@/pages/auth/Register';
import VerifyEmailPage from '@/pages/auth/VerifyEmail';
import ForgotPasswordPage from '@/pages/auth/ForgotPassword';
import ResetPasswordPage from '@/pages/auth/ResetPassword';
import CompleteProfilePage from '@/pages/auth/CompleteProfile';
import HubPage from '@/pages/Hub';
import DashboardPage from '@/pages/Dashboard';
import { ComingSoon } from '@/pages/ComingSoon';

function protect(element: ReactNode) {
  return <ProtectedRoute>{element}</ProtectedRoute>;
}

export const router = createBrowserRouter([
  // Public auth
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/verify-email', element: <VerifyEmailPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },

  // Authenticated
  { path: '/hub', element: protect(<HubPage />) },
  { path: '/qbank', element: protect(<ComingSoon title="Question Banks" />) },
  { path: '/library', element: protect(<ComingSoon title="Medical Library" />) },
  { path: '/complete-profile', element: protect(<CompleteProfilePage />) },
  { path: '/dashboard', element: protect(<DashboardPage />) },

  { path: '/', element: <Navigate to="/hub" replace /> },
  { path: '*', element: <Navigate to="/hub" replace /> },
]);