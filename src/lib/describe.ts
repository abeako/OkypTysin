import type { Lang, StepId, StudentAction, Task } from "../types";

/** Общие подсказки для шага «что спрашивают», если в задаче нет своих. */
export const GENERIC_HINTS: Record<Lang, Partial<Record<StepId, [string, string]>>> = {
  ru: {
    what_asked: [
      "Перечитай вопрос в конце. Какое в нём главное слово: «сколько», «когда», «где», «что делать»?",
      "Выбери вариант, который повторяет вопрос задачи своими словами — не то, что уже известно из условия.",
    ],
  },
  kk: {
    what_asked: [
      "Соңындағы сұрақты қайта оқы. Ондағы басты сөз қандай: «қанша», «қашан», «қайда», «не істеу керек»?",
      "Есептің сұрағын өз сөзімен қайталайтын нұсқаны таңда — шартта бұрыннан белгілі нәрсені емес.",
    ],
  },
};

export function offlineHint(task: Task, lang: Lang, step: StepId, level: 1 | 2): string {
  const pair = task[lang].hints[step] ?? GENERIC_HINTS[lang][step];
  if (pair) return pair[level - 1];
  return lang === "kk" ? "Шартты тағы бір рет мұқият оқы." : "Перечитай условие ещё раз внимательно.";
}

/** Человекочитаемое описание того, что сделал ученик, — для промпта ИИ. */
export function describeAction(task: Task, lang: Lang, step: StepId, action: StudentAction | undefined): string {
  const loc = task[lang];
  if (!action) return "пока ничего не сделал, просит подсказку";
  const parts: string[] = [];
  if (action.selected) {
    parts.push(
      action.selected.length
        ? `выделил в тексте: ${action.selected.map((s) => `«${s}»`).join(", ")}`
        : "ничего не выделил",
    );
  }
  if (typeof action.choice === "number") {
    const opts =
      step === "answer" ? loc.options : step !== "select_evidence" ? loc.checks[step as "what_asked"]?.options : undefined;
    const text = opts?.[action.choice];
    if (text) parts.push(`выбрал вариант «${text}» (неверно)`);
  }
  if (action.input !== undefined) parts.push(`ввёл ответ «${action.input}» (неверно)`);
  return parts.join("; ") || "просит подсказку";
}
