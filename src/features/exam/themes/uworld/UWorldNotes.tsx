import { useEffect, useState } from 'react';
import type { ExamRunnerController } from '../../core/useExamRunner';
export function UWorldNotes({ controller: c }: { controller: ExamRunnerController }) {
  const [content, setContent] = useState('');
  useEffect(() => { setContent(c.note?.content ?? ''); }, [c.currentQuestion?.id, c.note?.content]);
  return <form onSubmit={e => {
    e.preventDefault();
    if (content.trim()) c.saveCurrentNote(content.trim());
  }}>
    <p className="uw-tool-hint">Private note for this question</p>
    <textarea aria-label="Question note" value={content} onChange={e => setContent(e.target.value)}
      disabled={c.noteQuery.isLoading || c.saveNoteMutation.isPending} rows={7}
      placeholder={c.noteQuery.isLoading ? 'Loading…' : 'Write your note…'} />
    <button type="submit" className="uw-tool-primary" disabled={!content.trim() || c.saveNoteMutation.isPending}>
      {c.saveNoteMutation.isPending ? 'Saving…' : 'Save Note'}
    </button>
    {c.saveNoteMutation.isError ? <p role="alert">Could not save note. Try again.</p> : null}
    {c.saveNoteMutation.isSuccess ? <p role="status">Note saved.</p> : null}
  </form>;
}
