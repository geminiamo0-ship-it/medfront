import type { ExamHighlight } from '../../types';

const MARKER_ATTR = 'data-medpark-marker';

function unwrapExisting(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>(`mark[${MARKER_ATTR}="1"]`).forEach((mark) => {
    mark.replaceWith(document.createTextNode(mark.textContent || ''));
  });
  root.normalize();
}

function collectTextNodes(root: HTMLElement) {
  const nodes: Array<{ node: Text; start: number; end: number }> = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let current = walker.nextNode();
  while (current) {
    const node = current as Text;
    const length = node.data.length;
    nodes.push({ node, start: offset, end: offset + length });
    offset += length;
    current = walker.nextNode();
  }
  return nodes;
}

export function applyQuestionHighlights(root: HTMLElement, highlights: ExamHighlight[]) {
  unwrapExisting(root);
  const active = highlights
    .filter((item) => (item.source ?? 'question') === 'question' && item.endIndex > item.startIndex)
    .sort((a, b) => a.startIndex - b.startIndex);

  // Apply from the end backwards so splitting later text nodes never changes
  // the offsets of earlier descriptors.
  for (const highlight of [...active].reverse()) {
    const nodes = collectTextNodes(root);
    const segments = nodes
      .filter((entry) => entry.end > highlight.startIndex && entry.start < highlight.endIndex)
      .map((entry) => ({
        node: entry.node,
        start: Math.max(0, highlight.startIndex - entry.start),
        end: Math.min(entry.node.data.length, highlight.endIndex - entry.start),
      }))
      .filter((segment) => segment.end > segment.start)
      .reverse();

    for (const segment of segments) {
      const selected = segment.node.splitText(segment.start);
      selected.splitText(segment.end - segment.start);
      const mark = document.createElement('mark');
      mark.setAttribute(MARKER_ATTR, '1');
      mark.className = 'amboss-user-marker';
      mark.style.setProperty('--amboss-marker-color', highlight.color || '#ffe36e');
      selected.parentNode?.insertBefore(mark, selected);
      mark.appendChild(selected);
    }
  }
}

export function selectionToQuestionHighlight(
  root: HTMLElement,
  color = '#ffe36e',
): ExamHighlight | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;

  const prefix = document.createRange();
  prefix.selectNodeContents(root);
  prefix.setEnd(range.startContainer, range.startOffset);
  const startIndex = prefix.toString().length;
  const text = range.toString();
  const endIndex = startIndex + text.length;

  if (!text.trim() || endIndex <= startIndex) return null;

  return {
    text,
    startIndex,
    endIndex,
    color,
    source: 'question',
  };
}
