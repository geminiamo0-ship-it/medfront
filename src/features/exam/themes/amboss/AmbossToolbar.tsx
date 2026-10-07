import { ExamIcon } from '../../shared/ExamIcon';

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
          <ExamIcon name="highlight" size={15} /> KEY INFO
        </button>
        <button
          type="button"
          className={props.hintOpen ? 'amboss-tool is-active' : 'amboss-tool'}
          onClick={props.onHint}
          disabled={!props.hintAvailable}
        >
          <ExamIcon name="ai-tutor" size={15} /> ATTENDING TIP
        </button>
        <button type="button" className={props.labsOpen ? 'amboss-tool is-active' : 'amboss-tool'} onClick={props.onLabs}>
          <ExamIcon name="lab-values" size={15} /> LABS
        </button>
      </div>
      <div className="amboss-tool-group">
        <button type="button" className={props.notesOpen ? 'amboss-tool is-active' : 'amboss-tool'} onClick={props.onNotes}>
          <ExamIcon name="notes" size={15} /> ADD NOTES
        </button>
        <button type="button" className={props.marked ? 'amboss-tool is-marked' : 'amboss-tool'} onClick={props.onMark}>
          <ExamIcon name="mark" size={15} /> {props.marked ? 'MARKED' : 'MARK'}
        </button>
        <button type="button" className="amboss-tool" onClick={props.onFlashcards}>
          <ExamIcon name="flashcards" size={15} /> GET ANKI CARDS
        </button>
      </div>
    </div>
  );
}
