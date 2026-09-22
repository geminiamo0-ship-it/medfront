import { api } from './client';

export interface LibraryArticleRef {
  id: number;
  title?: string;
  name?: string;
  isRead?: boolean;
  isBookmarked?: boolean;
  category?: string;
  excerpt?: string;
}

export interface LibraryCategory {
  id: number;
  name: string;
  articles?: LibraryArticleRef[];
  children?: LibraryCategory[];
}

export interface LibraryArticleContent {
  id: number;
  name?: string;
  title?: string;
  contentHtml?: string;
  content_html?: string;
  content?: string;
  isRead?: boolean;
  isBookmarked?: boolean;
  topicId?: number;
  qbank?: string;
  source?: string;
}

export interface SearchResponse {
  items?: LibraryArticleRef[];
  results?: LibraryArticleRef[];
  articles?: LibraryArticleRef[];
}

export function getStructure(source: string) {
  return api.get<LibraryCategory[]>('/library/structure', { params: { source } });
}

export function getArticle(id: number | string) {
  return api.get<LibraryArticleContent>(`/library/article/${encodeURIComponent(String(id))}`);
}

export function markRead(id: number | string) {
  return api.post<{ success?: boolean }>(`/library/article/${encodeURIComponent(String(id))}/read`, {});
}

export function toggleBookmark(id: number | string) {
  return api.post<{ success?: boolean }>(
    `/library/article/${encodeURIComponent(String(id))}/bookmark`,
    {},
  );
}

export function searchLibrary(q: string, source: string) {
  return api.get<SearchResponse | LibraryArticleRef[]>('/library/search', {
    params: { q, source },
  });
}

export function getAiSummary(id: number | string) {
  return api.get<{ exists: boolean; content: string | null }>(
    `/library/article/${encodeURIComponent(String(id))}/ai-summary`,
  );
}

export function requestAiSummary(id: number | string) {
  return api.post<{ content?: string; summary?: string }>(
    `/library/article/${encodeURIComponent(String(id))}/ai-summary`,
    {},
  );
}