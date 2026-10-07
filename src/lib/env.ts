/**
 * Runtime config. The API base URL comes from Vite env so dev/prod can differ.
 * Falls back to the live Railway API so the app never points at a dead host.
 */
export const API_URL: string =
  (import.meta.env.VITE_API_URL as string) ||
  'https://medhvgg-production.up.railway.app/api';

/** Prefix for offline media served from the CDN. */
export const MEDIA_CDN = 'https://pub-2a81f2cb19cc4473a3d076e657af6121.r2.dev/';