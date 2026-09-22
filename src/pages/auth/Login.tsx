import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { ApiError } from '@/api/client';
import { AuthLayout, FormMessage } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: string } | null)?.from || '/hub';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setNeedsVerification(false);
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.message === 'EMAIL_NOT_VERIFIED') {
        setNeedsVerification(true);
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue studying."
      footer={
        <>
          New to MedPark?{' '}
          <Link to="/register" className="text-link hover:underline">
            Create account
          </Link>
        </>
      }
    >
      {error && <FormMessage>{error}</FormMessage>}

      {needsVerification && (
        <FormMessage kind="info">
          Please verify your email first. We just sent you a fresh code.{' '}
          <Link
            to="/verify-email"
            state={{ email: email.trim().toLowerCase() }}
            className="font-medium underline"
          >
            Enter code
          </Link>
        </FormMessage>
      )}

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
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
        />
        <Button type="submit" size="lg" loading={loading}>
          Sign in
        </Button>
      </form>

      <div className="mt-5 text-center text-sm">
        <Link to="/forgot-password" className="text-link hover:underline">
          Forgot password?
        </Link>
      </div>
    </AuthLayout>
  );
}