import type { Subject } from "../types";

export interface Segment {
  text: string;
  /** Номер фрагмента, который можно выделить касанием; null — обычный текст. */
  id: number | null;
}

// Число с необязательными разрядами, дробью/временем и знаком процента или тенге.
const NUMBER_RE = /\d+(?: \d{3})*(?:[.,:]\d+)?(?:\s?(?:%|₸))?/g;
// Предложение или строка: до .!? (включительно) или до конца строки.
const SENTENCE_RE = /[^.!?\n]+(?:[.!?]+|(?=\n)|$)/g;

/**
 * Делит текст задачи на фрагменты. Эталонные фрагменты и ловушки становятся
 * выделяемыми целиком; в остальном тексте в математике выделяются числа,
 * в чтении — предложения. Так набор выделяемых фрагментов не подсказывает ответ.
 */
export function segmentContext(context: string, subject: Subject, fragments: string[]): Segment[] {
  const marks: { start: number; end: number }[] = [];
  for (const f of fragments) {
    const start = context.indexOf(f);
    if (start < 0) continue;
    const end = start + f.length;
    if (marks.some((m) => start < m.end && end > m.start)) continue;
    marks.push({ start, end });
  }
  marks.sort((a, b) => a.start - b.start);

  const out: Segment[] = [];
  let nextId = 0;
  const pushPlain = (text: string) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.id === null) last.text += text;
    else out.push({ text, id: null });
  };
  const pushGap = (gap: string) => {
    if (!gap) return;
    const re = subject === "math" ? NUMBER_RE : SENTENCE_RE;
    re.lastIndex = 0;
    let pos = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(gap))) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      let s = m.index;
      let e = s + m[0].length;
      // в предложениях выносим пробелы по краям в обычный текст
      while (s < e && /\s/.test(gap[s])) s++;
      while (e > s && /\s/.test(gap[e - 1])) e--;
      const core = gap.slice(s, e);
      if (!/[\p{L}\p{N}]/u.test(core)) continue;
      pushPlain(gap.slice(pos, s));
      out.push({ text: core, id: nextId++ });
      pos = e;
    }
    pushPlain(gap.slice(pos));
  };

  let pos = 0;
  for (const m of marks) {
    pushGap(context.slice(pos, m.start));
    out.push({ text: context.slice(m.start, m.end), id: nextId++ });
    pos = m.end;
  }
  pushGap(context.slice(pos));

  // Номера по порядку в тексте, чтобы порядок не выдавал эталон.
  let n = 0;
  for (const s of out) if (s.id !== null) s.id = n++;
  return out;
}
