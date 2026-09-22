import { createBrowserRouter, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import LoginPage from '@/pages/auth/Login';
import RegisterPage from '@/pages/auth/Register';
import VerifyEmailPage from '@/pages/auth/VerifyEmail';
import ForgotPasswordPage from '@/pages/auth/ForgotPassword';
import ResetPasswordPage from '@/pages/auth/ResetPassword';
import CompleteProfilePage from '@/pages/auth/CompleteProfile';
import HubPage from '@/pages/Hub';
import DashboardPage from '@/pages/Dashboard';
import LibraryPage from '@/pages/library/LibraryPage';
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

  // Hub (own header)
  { path: '/hub', element: protect(<HubPage />) },

  // Library (own full-screen header, 1:1 with libraries.html)
  { path: '/library', element: protect(<LibraryPage />) },

  // Onboarding (own layout)
  { path: '/complete-profile', element: protect(<CompleteProfilePage />) },

  // App shell
  {
    element: protect(<AppLayout />),
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/contests', element: <ComingSoon title="Contests" /> },
      { path: '/qbank', element: <ComingSoon title="Question Banks" /> },
      { path: '/ai-analyst', element: <ComingSoon title="AI Analyst" /> },
      { path: '/settings', element: <ComingSoon title="Settings" /> },
    ],
  },

  { path: '/', element: <Navigate to="/hub" replace /> },
  { path: '*', element: <Navigate to="/hub" replace /> },
]);