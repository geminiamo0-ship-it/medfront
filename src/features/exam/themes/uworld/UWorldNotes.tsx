import type { ExamRunnerController } from '../../core/useExamRunner';
export function UWorldNotes({ controller: c }: { controller: ExamRunnerController }) {
  return <form key={c.currentQuestion?.id + ':' + (c.note?.updatedAt ?? '')}
    onSubmit={e => {
      e.preventDefault();
      const content = String(new FormData(e.currentTarget).get('note') ?? '').trim();
      if (content) c.saveCurrentNote(content);
    }}>
    <p className="uw-tool-hint">Private note for this question</p>
    <textarea name="note" aria-label="Question note" defaultValue={c.note?.content ?? ''}
      disabled={c.noteQuery.isLoading || c.saveNoteMutation.isPending} rows={7}
      placeholder={c.noteQuery.isLoading ? 'Loading…' : 'Write your note…'} />
    <button type="submit" className="uw-tool-primary" disabled={c.noteQuery.isLoading || c.saveNoteMutation.isPending}>
      {c.saveNoteMutation.isPending ? 'Saving…' : 'Save Note'}
    </button>
    {c.saveNoteMutation.isError ? <p role="alert">Could not save note. Try again.</p> : null}
    {c.saveNoteMutation.isSuccess ? <p role="status">Note saved.</p> : null}
  </form>;
}
