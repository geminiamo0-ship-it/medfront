import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateProfile, updateProfileDetails } from '@/api/users';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { AuthLayout, FormMessage } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { COUNTRY_OPTIONS } from '@/lib/countries';

const URL_RE = /^https?:\/\/.+/i;

export default function CompleteProfilePage() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();

  const [form, setForm] = useState({
    nickname: user?.nickname ?? '',
    country: user?.country ?? '',
    institution: '',
    graduationYear: '',
    specialization: '',
    location: '',
    avatarUrl: '',
    bio: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (form.avatarUrl && !URL_RE.test(form.avatarUrl)) {
      setError('Avatar URL must start with http:// or https://');
      return;
    }
    const year = form.graduationYear ? Number(form.graduationYear) : undefined;
    if (year !== undefined && (Number.isNaN(year) || year < 2020 || year > 2040)) {
      setError('Graduation year must be between 2020 and 2040.');
      return;
    }

    setLoading(true);
    try {
      const profile: Record<string, unknown> = {};
      if (form.nickname.trim()) profile.nickname = form.nickname.trim();
      if (form.country) profile.country = form.country;
      if (Object.keys(profile).length) await updateProfile(profile);

      const details: Record<string, unknown> = {};
      if (form.institution.trim()) details.institution = form.institution.trim();
      if (year !== undefined) details.graduationYear = year;
      if (form.specialization.trim()) details.specialization = form.specialization.trim();
      if (form.location.trim()) details.location = form.location.trim();
      if (form.avatarUrl.trim()) details.avatarUrl = form.avatarUrl.trim();
      if (form.bio.trim()) details.bio = form.bio.trim();
      if (Object.keys(details).length) await updateProfileDetails(details);

      await refresh();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your profile.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      wide
      title="Complete your profile"
      subtitle="Optional — helps personalize your experience. You can change this later."
      footer={
        <button
          type="button"
          onClick={() => navigate('/dashboard', { replace: true })}
          className="text-link hover:underline"
        >
          Skip for now
        </button>
      }
    >
      {error && <FormMessage>{error}</FormMessage>}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Nickname"
            name="nickname"
            value={form.nickname}
            onChange={(e) => set('nickname', e.target.value)}
            placeholder="Shown on leaderboards"
          />
          <Select
            label="Country"
            name="country"
            placeholder="Select country"
            value={form.country}
            onChange={(e) => set('country', e.target.value)}
            options={COUNTRY_OPTIONS}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Institution"
            name="institution"
            value={form.institution}
            onChange={(e) => set('institution', e.target.value)}
            placeholder="Medical school / hospital"
          />
          <Input
            label="Graduation year"
            name="graduationYear"
            type="number"
            min={2020}
            max={2040}
            value={form.graduationYear}
            onChange={(e) => set('graduationYear', e.target.value)}
            placeholder="2028"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Specialization"
            name="specialization"
            value={form.specialization}
            onChange={(e) => set('specialization', e.target.value)}
            placeholder="e.g. Cardiology"
          />
          <Input
            label="Location"
            name="location"
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="City"
          />
        </div>

        <Input
          label="Avatar URL"
          name="avatarUrl"
          value={form.avatarUrl}
          onChange={(e) => set('avatarUrl', e.target.value)}
          placeholder="https://…"
        />

        <div className="w-full">
          <label htmlFor="bio" className="mb-1.5 block text-sm font-medium text-ink-soft">
            Bio
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={3}
            maxLength={500}
            value={form.bio}
            onChange={(e) => set('bio', e.target.value)}
            placeholder="A short line about you"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-mp focus:ring-2 focus:ring-mp/20"
          />
        </div>

        <Button type="submit" size="lg" loading={loading}>
          Save and continue
        </Button>
      </form>
    </AuthLayout>
  );
}