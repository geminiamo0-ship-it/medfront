import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '@/api/auth';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { AuthLayout, FormMessage } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { COUNTRY_OPTIONS } from '@/lib/countries';

const PASSWORD_RE = /((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*/;
const PHONE_RE = /^\+?\d{6,17}$/;

const HEARD_OPTIONS = [
  'Google',
  'Facebook',
  'Instagram',
  'TikTok',
  'YouTube',
  'Friend or colleague',
  'University',
  'Other',
].map((v) => ({ value: v, label: v }));

export default function RegisterPage() {
  const navigate = useNavigate();
  const { acceptToken } = useAuth();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
    phoneNumber: '',
    country: '',
    university: '',
    nickname: '',
    heardAboutUsFrom: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): string | null {
    if (form.name.trim().length < 2) return 'Please enter your full name.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()))
      return 'Please enter a valid email address.';
    if (!PASSWORD_RE.test(form.password))
      return 'Password needs 8+ characters with an uppercase, a lowercase, and a number or symbol.';
    if (form.password !== form.confirmPassword) return 'Passwords do not match.';
    if (!form.dateOfBirth) return 'Please enter your date of birth.';
    if (!PHONE_RE.test(form.phoneNumber.replace(/\s+/g, '')))
      return 'Please enter a valid phone number (digits, optional leading +).';
    return null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        dateOfBirth: form.dateOfBirth,
        phoneNumber: form.phoneNumber.replace(/\s+/g, ''),
        ...(form.country ? { country: form.country } : {}),
        ...(form.university.trim() ? { university: form.university.trim() } : {}),
        ...(form.nickname.trim() ? { nickname: form.nickname.trim() } : {}),
        ...(form.heardAboutUsFrom ? { heardAboutUsFrom: form.heardAboutUsFrom } : {}),
      });

      if (res.data?.token) {
        await acceptToken(res.data.token);
        navigate('/complete-profile', { replace: true });
      } else {
        navigate('/verify-email', { replace: true, state: { email: form.email.trim().toLowerCase() } });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      wide
      title="Create your account"
      subtitle="Start studying with MedPark."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="text-link hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {error && <FormMessage>{error}</FormMessage>}

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Full name"
          name="name"
          required
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="John Doe"
        />

        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="you@example.com"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            placeholder="8+ characters"
          />
          <Input
            label="Confirm password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={form.confirmPassword}
            onChange={(e) => set('confirmPassword', e.target.value)}
            placeholder="Repeat password"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Date of birth"
            name="dateOfBirth"
            type="date"
            required
            value={form.dateOfBirth}
            onChange={(e) => set('dateOfBirth', e.target.value)}
          />
          <Input
            label="Phone number"
            name="phoneNumber"
            type="tel"
            required
            value={form.phoneNumber}
            onChange={(e) => set('phoneNumber', e.target.value)}
            placeholder="+1234567890"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Country"
            name="country"
            placeholder="Select country"
            value={form.country}
            onChange={(e) => set('country', e.target.value)}
            options={COUNTRY_OPTIONS}
          />
          <Input
            label="Nickname (optional)"
            name="nickname"
            value={form.nickname}
            onChange={(e) => set('nickname', e.target.value)}
            placeholder="Shown on leaderboards"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="University (optional)"
            name="university"
            value={form.university}
            onChange={(e) => set('university', e.target.value)}
            placeholder="Medical school"
          />
          <Select
            label="How did you hear about us? (optional)"
            name="heardAboutUsFrom"
            placeholder="Select"
            value={form.heardAboutUsFrom}
            onChange={(e) => set('heardAboutUsFrom', e.target.value)}
            options={HEARD_OPTIONS}
          />
        </div>

        <Button type="submit" size="lg" loading={loading}>
          Create account
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-ink-faint">
        By creating an account you agree to our Terms and Privacy Policy.
      </p>
    </AuthLayout>
  );
}