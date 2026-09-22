import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { resetPassword } from '@/api/auth';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { AuthLayout, FormMessage } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { acceptToken } = useAuth();

  const email = (location.state as { email?: string } | null)?.email ?? '';

  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!email) {
    return <Navigate to="/forgot-password" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (code.trim().length !== 6) {
      setError('Enter the 6-character recovery code.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await resetPassword({
        email,
        code: code.trim().toUpperCase(),
        newPassword,
      });
      if (res.data?.token) {
        await acceptToken(res.data.token);
      }
      navigate('/hub', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reset failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Set a new password"
      subtitle={`Enter the code we sent to ${email}.`}
      footer={
        <Link to="/login" className="text-link hover:underline">
          Back to sign in
        </Link>
      }
    >
      {error && <FormMessage>{error}</FormMessage>}

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Recovery code"
          name="code"
          maxLength={6}
          autoComplete="one-time-code"
          required
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="A3K7P9"
          className="text-center text-lg tracking-[0.4em]"
        />
        <Input
          label="New password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="8+ characters"
        />
        <Input
          label="Confirm new password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repeat password"
        />
        <Button type="submit" size="lg" loading={loading}>
          Reset password
        </Button>
      </form>
    </AuthLayout>
  );
}