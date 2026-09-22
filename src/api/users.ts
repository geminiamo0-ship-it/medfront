import { api } from './client';

export interface UpdateProfileInput {
  name?: string;
  country?: string;
  nickname?: string;
  dateOfBirth?: string;
  phoneNumber?: string;
  telegramUsername?: string;
}

export interface UpdateProfileDetailsInput {
  avatarUrl?: string;
  bio?: string;
  institution?: string;
  graduationYear?: number;
  specialization?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  location?: string;
}

export function updateProfile(input: UpdateProfileInput) {
  return api.put<{ success: boolean; message?: string }>('/users/profile', input);
}

export function updateProfileDetails(input: UpdateProfileDetailsInput) {
  return api.put<{ success: boolean; message?: string }>('/users/profile/details', input);
}

export function setPassword(newPassword: string) {
  return api.post<{ success: boolean; message?: string }>('/users/set-password', {
    newPassword,
  });
}

export interface HomeStats {
  user: { name: string };
  loginStreak: { current: number; longest: number };
  questionStreak: { current: number; longest: number; solvedToday: boolean };
  calendar: Array<{ date: string; count: number }>;
  summary: { totalAllTime: number; thisWeek: number; thisMonth: number };
  lastSuspendedTest: unknown | null;
  recentTests: unknown[];
  upcomingContest: unknown | null;
  leaderboardRank: number | null;
  monthlyBadges: Array<{ month: string; total: number; level: number }>;
  badgeThresholds: { bronze: number; silver: number; gold: number };
  specialBadges: unknown[];
}

export function getHomeStats() {
  return api.get<HomeStats>('/users/home-stats');
}