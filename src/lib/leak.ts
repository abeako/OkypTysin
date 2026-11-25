import type { Lang, Task } from "../types";
import { includesBounded, normalizeText, words } from "./text";
import { timeToMinutes } from "./check";

/**
 * Фильтр утечки ответа. Любой текст, который видит ученик до решения
 * (подсказка ИИ или заранее записанная подсказка), проходит через эту проверку.
 */
export interface LeakResult {
  leak: boolean;
  reason?: string;
}

const MULTIPLIERS: [RegExp, number][] = [
  [/^\s*(тыс|мың|k\b)/u, 1000],
  [/^\s*(млн|миллион)/u, 1_000_000],
];

/** Все числа в тексте (с учётом «тыс.», «млн»). */
function extractNumbers(norm: string): number[] {
  const out: number[] = [];
  const re = /\d+(?:,\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm))) {
    let n = Number(m[0].replace(",", "."));
    const rest = norm.slice(m.index + m[0].length);
    for (const [r, k] of MULTIPLIERS) if (r.test(rest)) n *= k;
    out.push(n);
  }
  return out;
}

/** Все записи времени в тексте: 11:30, 11 ч 30 мин, 11 сағ 30 мин, 11 часов 30 минут. */
function extractTimes(norm: string): number[] {
  const out: number[] = [];
  const re = /(\d{1,2})\s*(?::|ч(?:ас\p{L}*)?\.?|сағ(?:ат)?\.?)\s*(\d{1,2})(?!\d)/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm))) {
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h < 24 && min < 60) out.push(h * 60 + min);
  }
  return out;
}

const ORDINALS: Record<Lang, string[]> = {
  ru: ["перв", "втор", "трет", "четв", "пят"],
  kk: ["бірінші", "екінші", "үшінші", "төртінші", "бесінші"],
};

/** Упоминание номера правильного варианта: «вариант 2», «второй вариант», «2-нұсқа». */
function mentionsOptionIndex(norm: string, index: number): boolean {
  const n = index + 1;
  const noun = "(?:вариант\\w*|нұсқа\\w*|ответ\\w*|жауап\\w*)";
  const patterns = [
    new RegExp(`${noun}\\s*(?:№|номер|нөмір)?\\s*${n}(?!\\d)`, "u"),
    new RegExp(`(?<!\\d)${n}\\s*-?\\s*(?:й|ый|ий|ой|ші|шы|інші|ыншы)?\\s*${noun}`, "u"),
    new RegExp(`${ORDINALS.ru[index]}\\p{L}*\\s+${noun}`, "u"),
    new RegExp(`${ORDINALS.kk[index]}\\s+${noun}`, "u"),
  ];
  return patterns.some((p) => p.test(norm));
}

/** Самая длинная общая последовательность слов подряд. */
function longestCommonRun(a: string[], b: string[]): number {
  let best = 0;
  const prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : 0;
      if (prev[j] > best) best = prev[j];
      diag = tmp;
    }
  }
  return best;
}

export interface LeakOptions {
  /** Не проверять цитирование эталона (текст показывается уже после шага доказательства). */
  allowEvidence?: boolean;
}

export function checkLeak(text: string, task: Task, lang: Lang, opts: LeakOptions = {}): LeakResult {
  const loc = task[lang];
  const norm = normalizeText(text);
  const a = task.answer;

  if (a.type === "number") {
    const tol = a.tolerance ?? 1e-9;
    if (extractNumbers(norm).some((n) => Math.abs(n - a.value) <= tol)) {
      return { leak: true, reason: "answer-number" };
    }
  }
  if (a.type === "time") {
    const target = timeToMinutes(a.value);
    if (extractTimes(norm).includes(target)) return { leak: true, reason: "answer-time" };
  }
  if (a.type === "choice" && loc.options) {
    const correct = normalizeText(loc.options[a.correctIndex]);
    if (includesBounded(norm, correct)) return { leak: true, reason: "answer-option" };
    if (mentionsOptionIndex(norm, a.correctIndex)) return { leak: true, reason: "answer-index" };
  }
  for (const v of loc.answerVariants ?? []) {
    if (includesBounded(norm, normalizeText(v))) return { leak: true, reason: "answer-variant" };
  }

  // Дословное эталонное предложение-доказательство (или его большой кусок).
  // В математике эталон — это данные условия, их называть можно.
  if (task.subject !== "reading" || opts.allowEvidence) return { leak: false };
  const hintWords = words(text);
  for (const ev of loc.evidence) {
    const evWords = words(ev);
    if (evWords.length < 4) continue; // короткие данные (числа) называть можно
    const limit = Math.min(5, Math.ceil(evWords.length * 0.6));
    if (longestCommonRun(evWords, hintWords) >= limit) {
      return { leak: true, reason: "evidence-quote" };
    }
  }
  return { leak: false };
}
