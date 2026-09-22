import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiError } from '@/api/client';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: string } | null)?.from || '/dashboard';

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
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <img src="/favicon.svg" alt="MedPark" className="h-8 w-8" />
          <span className="text-2xl font-bold tracking-tight text-mp">MedPark</span>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-7 shadow-card">
          <h1 className="mb-1 text-xl font-bold text-ink">Welcome back</h1>
          <p className="mb-6 text-sm text-ink-muted">Sign in to continue studying.</p>

          {error && (
            <div className="mb-4 rounded-lg border border-bad/30 bg-bad/5 px-3 py-2 text-sm text-bad">
              {error}
            </div>
          )}

          {needsVerification && (
            <div className="mb-4 rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-sm text-warn">
              Please verify your email first. We sent you a fresh code.
            </div>
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

          <div className="mt-5 flex items-center justify-between text-sm">
            <Link to="/forgot-password" className="text-mp hover:underline">
              Forgot password?
            </Link>
            <Link to="/register" className="text-mp hover:underline">
              Create account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}