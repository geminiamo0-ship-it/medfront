import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { forgotPassword } from '@/api/auth';
import { ApiError } from '@/api/client';
import { AuthLayout, FormMessage } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setUnavailable('');
    setLoading(true);
    try {
      const res = await forgotPassword(email.trim().toLowerCase());
      if (res.success === false && res.code === 'OTP_DISABLED') {
        setUnavailable(res.message || 'Password recovery via email is currently unavailable.');
        return;
      }
      navigate('/reset-password', {
        replace: true,
        state: { email: email.trim().toLowerCase() },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we'll send you a recovery code."
      footer={
        <Link to="/login" className="text-link hover:underline">
          Back to sign in
        </Link>
      }
    >
      {error && <FormMessage>{error}</FormMessage>}
      {unavailable && <FormMessage kind="info">{unavailable}</FormMessage>}

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <Button type="submit" size="lg" loading={loading}>
          Send recovery code
        </Button>
      </form>
    </AuthLayout>
  );
}