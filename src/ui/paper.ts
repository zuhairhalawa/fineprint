/**
 * Draws the letter's text as "paper": blanked-out runs as black bars, and
 * findings as highlighter marks. Every text piece carries its offset in the
 * letter (data-s), so a selection can be turned back into positions.
 */
import { MASK_CHAR } from '../redact/redact.ts';
import type { Level } from '../types.ts';

export interface Mark {
  start: number;
  end: number;
  level: Level;
  id: string;
  order: number;
}

const RANK: Record<Level, number> = { red: 0, amber: 1, green: 2 };

function piece(text: string, start: number): DocumentFragment {
  // Split a run of text into plain parts and black mask bars.
  const frag = document.createDocumentFragment();
  const re = new RegExp(`${MASK_CHAR}+`, 'g');
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) frag.append(span(text.slice(last, m.index), start + last));
    const bar = span(m[0], start + m.index);
    bar.className = 'mask';
    bar.setAttribute('aria-label', 'blacked out');
    frag.append(bar);
    last = m.index + m[0].length;
  }
  if (last < text.length) frag.append(span(text.slice(last), start + last));
  return frag;
}

function span(text: string, start: number): HTMLSpanElement {
  const s = document.createElement('span');
  s.dataset.s = String(start);
  s.textContent = text;
  return s;
}

export function renderPaper(el: HTMLElement, text: string, marks: Mark[] = []): void {
  el.replaceChildren();
  const cuts = new Set<number>([0, text.length]);
  for (const m of marks) {
    cuts.add(Math.max(0, m.start));
    cuts.add(Math.min(text.length, m.end));
  }
  const points = [...cuts].sort((a, b) => a - b);
  const seen = new Set<string>();
  for (let k = 0; k < points.length - 1; k++) {
    const a = points[k] as number;
    const b = points[k + 1] as number;
    const covering = marks.filter((m) => m.start <= a && m.end >= b).sort((x, y) => RANK[x.level] - RANK[y.level])[0];
    const content = piece(text.slice(a, b), a);
    if (!covering) {
      el.append(content);
      continue;
    }
    const mark = document.createElement('mark');
    mark.className = covering.level;
    mark.dataset.id = covering.id;
    mark.style.setProperty('--i', String(covering.order));
    // Only the first piece of each finding is a link target.
    if (!seen.has(covering.id)) {
      mark.id = `mark-${covering.id}`;
      seen.add(covering.id);
    }
    mark.append(content);
    el.append(mark);
  }
}

/** Converts the current selection inside `el` to [start, end) in the letter, or null. */
export function selectionRange(el: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const r = sel.getRangeAt(0);
  if (!el.contains(r.startContainer) || !el.contains(r.endContainer)) return null;
  const at = (node: Node, offset: number): number | null => {
    const host = (node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element))?.closest<HTMLElement>('[data-s]');
    if (!host) return null;
    return Number(host.dataset.s) + (node.nodeType === Node.TEXT_NODE ? offset : 0);
  };
  const start = at(r.startContainer, r.startOffset);
  const end = at(r.endContainer, r.endOffset);
  if (start === null || end === null || end <= start) return null;
  return { start, end };
}
