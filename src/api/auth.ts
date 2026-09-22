import { api } from './client';

export interface AuthUser {
  userId: number;
  name: string;
  nickname?: string | null;
  email: string;
  role?: string;
  country?: string;
  dateOfBirth?: string | null;
  phoneNumber?: string | null;
  rating: number;
  ratingTier: string;
  maxRating: number;
  contestsParticipated?: number;
  subscriptionPlan: string;
  subscriptionExpiry: string | null;
  isProfilePublic?: boolean;
  resetCount?: number;
  authProvider?: string;
  hasLocalPassword?: boolean;
  createdAt?: string;
  token?: string;
}

interface Envelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface LoginResult {
  success: boolean;
  message?: string;
  /** When email OTP is enabled, new registrations don't return a token yet. */
  data: {
    userId?: number;
    email: string;
    requiresVerification?: boolean;
    token?: string;
  } & Partial<AuthUser>;
}

export function login(email: string, password: string) {
  return api.post<LoginResult>('/auth/login', { email, password });
}

export function register(input: {
  name: string;
  email: string;
  password: string;
  country: string;
}) {
  return api.post<LoginResult>('/auth/register', input);
}

export function sendVerification(email: string) {
  return api.post<Envelope<unknown>>('/auth/send-verification', { email });
}

export function verifyOtp(email: string, code: string) {
  return api.post<LoginResult>('/auth/verify-otp', { email, code });
}

export function forgotPassword(email: string) {
  return api.post<{ success: boolean; message?: string; code?: string }>(
    '/auth/forgot-password',
    { email },
  );
}

export function resetPassword(input: { email: string; code: string; newPassword: string }) {
  return api.post<LoginResult>('/auth/reset-password', input);
}

export function getMe() {
  return api.get<Envelope<AuthUser>>('/auth/me');
}

export function logout() {
  return api.post<Envelope<unknown>>('/auth/logout');
}