interface AmbossToolbarProps {
  cluesOn: boolean;
  hintOpen: boolean;
  hintAvailable: boolean;
  labsOpen: boolean;
  notesOpen: boolean;
  marked: boolean;
  onClues: () => void;
  onHint: () => void;
  onLabs: () => void;
  onNotes: () => void;
  onMark: () => void;
  onFlashcards: () => void;
}

export function AmbossToolbar(props: AmbossToolbarProps) {
  return (
    <div className="amboss-tools" aria-label="Question tools">
      <div className="amboss-tool-group">
        <button type="button" className={props.cluesOn ? 'amboss-tool is-active' : 'amboss-tool'} onClick={props.onClues}>
          <span>☰</span> KEY INFO
        </button>
        <button
          type="button"
          className={props.hintOpen ? 'amboss-tool is-active' : 'amboss-tool'}
          onClick={props.onHint}
          disabled={!props.hintAvailable}
        >
          <span>?</span> ATTENDING TIP
        </button>
        <button type="button" className={props.labsOpen ? 'amboss-tool is-active' : 'amboss-tool'} onClick={props.onLabs}>
          <span>▣</span> LABS
        </button>
      </div>
      <div className="amboss-tool-group">
        <button type="button" className={props.notesOpen ? 'amboss-tool is-active' : 'amboss-tool'} onClick={props.onNotes}>
          <span>✎</span> ADD NOTES
        </button>
        <button type="button" className={props.marked ? 'amboss-tool is-marked' : 'amboss-tool'} onClick={props.onMark}>
          <span>⚑</span> {props.marked ? 'MARKED' : 'MARK'}
        </button>
        <button type="button" className="amboss-tool" onClick={props.onFlashcards}>
          <span>☆</span> GET ANKI CARDS
        </button>
      </div>
    </div>
  );
}
