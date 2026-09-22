import { api } from './client';

export interface NotebookNote {
  id: number;
  title?: string;
  content?: string;
  updatedAt?: string;
  createdAt?: string;
}

export function getNotes() {
  return api.get<NotebookNote[]>('/notebook');
}

export function createNote(body: { title: string; content: string }) {
  return api.post<NotebookNote>('/notebook', body);
}

export function updateNote(id: number | string, body: { title: string; content: string }) {
  return api.put<{ success?: boolean }>(`/notebook/${encodeURIComponent(String(id))}`, body);
}

export function deleteNote(id: number | string) {
  return api.delete<{ success?: boolean }>(`/notebook/${encodeURIComponent(String(id))}`);
}