import type { Answer } from "../types";

/** Разбирает число из ввода ученика: «5 500», «5500 ₸», «2,5». */
export function parseNumber(input: string): number | null {
  const s = input.replace(/[  ]/g, " ").replace(/(\d)\s+(?=\d)/g, "$1");
  const m = s.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Разбирает время: «11:30», «11.30», «11 30», «11 ч 30 мин», «11 сағ 30 мин». Возвращает минуты от 0:00. */
export function parseTime(input: string): number | null {
  const nums = input.match(/\d+/g);
  if (!nums || nums.length > 2) return null;
  const h = Number(nums[0]);
  const m = nums.length === 2 ? Number(nums[1]) : 0;
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** Время + длительность в минутах -> "H:MM". Используется в пересчёте ответов. */
export function addMinutes(hhmm: string, minutes: number): string {
  return minutesToTime(timeToMinutes(hhmm) + minutes);
}

export type AnswerCheck = "correct" | "wrong" | "unparsed";

/** Проверка ответа кодом (для числа и времени). Выбор варианта проверяется по индексу. */
export function checkAnswer(answer: Answer, input: string | number): AnswerCheck {
  if (answer.type === "choice") {
    return input === answer.correctIndex ? "correct" : "wrong";
  }
  if (typeof input !== "string") return "unparsed";
  if (answer.type === "number") {
    const n = parseNumber(input);
    if (n === null) return "unparsed";
    const tol = answer.tolerance ?? 1e-9;
    return Math.abs(n - answer.value) <= tol ? "correct" : "wrong";
  }
  const t = parseTime(input);
  if (t === null) return "unparsed";
  return t === timeToMinutes(answer.value) ? "correct" : "wrong";
}

export interface EvidenceResult {
  ok: boolean;
  /** Сколько обязательных фрагментов не выделено. */
  missing: number;
  /** Выделенные фрагменты, которые не нужны для ответа. */
  extra: string[];
  /** Среди лишних есть специально заложенная ловушка. */
  distractorPicked: boolean;
}

/** Доказательство засчитывается, если выделены все эталонные фрагменты и ничего лишнего. */
export function checkEvidence(
  selected: string[],
  evidence: string[],
  optional: string[] = [],
  distractors: string[] = [],
): EvidenceResult {
  const sel = new Set(selected.map((s) => s.trim()));
  const allowed = new Set([...evidence, ...optional].map((s) => s.trim()));
  const missing = evidence.filter((e) => !sel.has(e.trim())).length;
  const extra = [...sel].filter((s) => !allowed.has(s));
  const distractorSet = new Set(distractors.map((d) => d.trim()));
  return {
    ok: missing === 0 && extra.length === 0,
    missing,
    extra,
    distractorPicked: extra.some((e) => distractorSet.has(e)),
  };
}
