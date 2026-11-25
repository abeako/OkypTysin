import type { Lang, StepId } from "./types";

// localStorage может быть недоступен (приватный режим) — всё обёрнуто в try/catch.
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ничего страшного */
  }
}

export function loadLang(): Lang {
  const l = read<string>("dalel.lang", "");
  if (l === "kk" || l === "ru") return l;
  return typeof navigator !== "undefined" && navigator.language?.startsWith("kk") ? "kk" : "ru";
}
export const saveLang = (l: Lang) => write("dalel.lang", l);

export interface TaskProgress {
  solved: boolean;
  /** Сколько ошибок было на каждом шаге в последней попытке. */
  mistakes: Partial<Record<StepId, number>>;
}
export type Progress = Record<string, TaskProgress>;

export const loadProgress = (): Progress => read<Progress>("dalel.progress", {});
export function saveTaskProgress(id: string, p: TaskProgress) {
  const all = loadProgress();
  all[id] = p;
  write("dalel.progress", all);
}
