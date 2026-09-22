import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { sendVerification, verifyOtp } from '@/api/auth';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { AuthLayout, FormMessage } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { acceptToken } = useAuth();

  const email = (location.state as { email?: string } | null)?.email ?? '';

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    timerRef.current = window.setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [cooldown]);

  if (!email) {
    return <Navigate to="/register" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    if (code.trim().length !== 6) {
      setError('Enter the 6-character code from your email.');
      return;
    }
    setLoading(true);
    try {
      const res = await verifyOtp(email, code.trim().toUpperCase());
      if (res.data?.token) {
        await acceptToken(res.data.token);
        navigate('/complete-profile', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setError('');
    setInfo('');
    try {
      await sendVerification(email);
      setInfo('A new code is on its way. Check your inbox and spam folder.');
      setCooldown(60);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend the code.');
    }
  }

  return (
    <AuthLayout
      title="Verify your email"
      subtitle={`We sent a 6-character code to ${email}.`}
      footer={
        <Link to="/login" className="text-link hover:underline">
          Back to sign in
        </Link>
      }
    >
      {error && <FormMessage>{error}</FormMessage>}
      {info && <FormMessage kind="success">{info}</FormMessage>}

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Verification code"
          name="code"
          inputMode="text"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="A3K7P9"
          className="text-center text-lg tracking-[0.4em]"
        />
        <Button type="submit" size="lg" loading={loading}>
          Verify email
        </Button>
      </form>

      <div className="mt-4 text-center text-sm text-ink-muted">
        Didn&apos;t get it?{' '}
        <button
          type="button"
          onClick={() => void resend()}
          disabled={cooldown > 0}
          className="font-medium text-link hover:underline disabled:cursor-not-allowed disabled:text-ink-faint"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </AuthLayout>
  );
}