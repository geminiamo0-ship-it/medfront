import type { QuestionNote } from '../../types';

interface AmbossNotesEditorProps {
  open: boolean;
  note: QuestionNote | null;
  loading: boolean;
  saving: boolean;
  questionId: number;
  onClose: () => void;
  onSave: (content: string) => void;
}

export function AmbossNotesEditor({
  open,
  note,
  loading,
  saving,
  questionId,
  onClose,
  onSave,
}: AmbossNotesEditorProps) {
  if (!open) return null;

  return (
    <form
      className="amboss-notes"
      key={`${questionId}:${note?.id ?? 'new'}:${note?.updatedAt ?? ''}`}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const content = String(form.get('content') ?? '').trim();
        if (content) onSave(content);
      }}
    >
      <div className="amboss-note-help">Question note</div>
      <div className="amboss-note-toolbar" aria-hidden="true">
        <strong>B</strong><em>i</em><u>U</u><span>☷</span><span>≣</span><span>¶</span>
      </div>
      <textarea
        name="content"
        defaultValue={note?.content ?? ''}
        placeholder={loading ? 'Loading note…' : 'Edit your note…'}
        disabled={loading || saving}
        rows={5}
      />
      <div className="amboss-note-actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" className="is-primary" disabled={loading || saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
