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