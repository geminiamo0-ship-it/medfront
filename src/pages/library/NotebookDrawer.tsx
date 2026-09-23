import type { CSSProperties, Ref } from 'react';
import type { NotebookNote } from '@/api/notebook';

interface NotebookDrawerProps {
  open: boolean;
  /** Drawer width in px — rendered as the `--nbw` CSS custom property. */
  width: number;
  /** Ref to the contentEditable note body; parent handlers read/write it. */
  bodyRef: Ref<HTMLDivElement>;
  onClose: () => void;
  onInsertArticleRef: () => void;
  onAddNote: () => void;
  noteSearch: string;
  onNoteSearchChange: (value: string) => void;
  notes: NotebookNote[];
  activeNoteId: number | null;
  onOpenNote: (id: number) => void;
  noteTitle: string;
  onNoteTitleChange: (value: string) => void;
  onExecFormat: (cmd: string, val?: string) => void;
  onSaveNote: () => void;
  onExportPdf: () => void;
}

export function NotebookDrawer({
  open,
  width,
  bodyRef,
  onClose,
  onInsertArticleRef,
  onAddNote,
  noteSearch,
  onNoteSearchChange,
  notes,
  activeNoteId,
  onOpenNote,
  noteTitle,
  onNoteTitleChange,
  onExecFormat,
  onSaveNote,
  onExportPdf,
}: NotebookDrawerProps) {
  return (
    <div
      id="nbdr"
      className={open ? 'open' : ''}
      style={{ '--nbw': `${width}px` } as CSSProperties}
    >
      <div id="nbrz" />
      <div id="nbhdr">
        <h3>📓 Notebook</h3>
        <button id="nbaibtn" onClick={onInsertArticleRef} title="Insert current article reference">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          Insert Article
        </button>
        <button id="nbplus" onClick={onAddNote}>
          + Note
        </button>
        <button id="nbcl" onClick={onClose}>
          ✕
        </button>
      </div>
      <div id="nbsr">
        <input
          type="text"
          placeholder="Search notes..."
          value={noteSearch}
          onChange={(e) => onNoteSearchChange(e.target.value)}
        />
      </div>
      <div id="nbbody">
        <div id="nbtree">
          {notes.length === 0 ? (
            <div style={{ padding: '10px 8px', fontSize: 11, color: '#9ca3af' }}>No notes yet.</div>
          ) : (
            notes.map((n) => (
              <div
                key={n.id}
                className={`nbt${activeNoteId === n.id ? ' act' : ''}`}
                onClick={() => onOpenNote(n.id)}
              >
                {n.title || 'Untitled'}
              </div>
            ))
          )}
        </div>
        <div id="nbew">
          <input
            type="text"
            id="nbti"
            placeholder="Untitled note..."
            value={noteTitle}
            onChange={(e) => onNoteTitleChange(e.target.value)}
          />
          <div id="nbtbar">
            <button className="nbtl" onClick={() => onExecFormat('bold')}>
              <b>B</b>
            </button>
            <button className="nbtl" onClick={() => onExecFormat('italic')}>
              <i>I</i>
            </button>
            <button className="nbtl" onClick={() => onExecFormat('underline')}>
              <u>U</u>
            </button>
            <button className="nbtl" onClick={() => onExecFormat('strikeThrough')}>
              <s>S</s>
            </button>
            <button className="nbtl" onClick={() => onExecFormat('insertOrderedList')}>
              1.
            </button>
            <button className="nbtl" onClick={() => onExecFormat('insertUnorderedList')}>
              •
            </button>
            <select
              onChange={(e) => {
                onExecFormat('fontSize', e.currentTarget.value);
                e.currentTarget.selectedIndex = 0;
              }}
              className="nbtl"
              style={{ width: 46, padding: '2px 4px' }}
              defaultValue=""
            >
              <option value="">Sz</option>
              <option value="1">S</option>
              <option value="3">M</option>
              <option value="5">L</option>
              <option value="7">XL</option>
            </select>
            <input
              type="color"
              onChange={(e) => onExecFormat('foreColor', e.currentTarget.value)}
              className="nbtl"
              style={{ width: 26, height: 24, padding: 0, cursor: 'pointer' }}
              title="Color"
            />
          </div>
          <div id="nbed" ref={bodyRef} contentEditable suppressContentEditableWarning spellCheck={false} />
          <div id="nbft">
            <button id="nbsv" onClick={onSaveNote}>
              💾 Save
            </button>
            <button id="nbex" onClick={onExportPdf}>
              📄 PDF
            </button>
            <span id="nbsync" />
          </div>
        </div>
      </div>
    </div>
  );
}