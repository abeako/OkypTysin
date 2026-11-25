export type Lang = "kk" | "ru";
export type Subject = "math" | "reading";
export type StepId =
  | "what_asked"
  | "select_evidence"
  | "operation"
  | "compute_check"
  | "infer"
  | "answer";

/** Шаги, на которых ученик выбирает один вариант из списка. */
export type ChoiceStep = "what_asked" | "operation" | "infer" | "compute_check";

export interface ChoiceCheck {
  prompt: string;
  options: string[];
  correctIndex: number;
}

export type Answer =
  | { type: "number"; value: number; tolerance?: number }
  | { type: "time"; value: string } // "HH:MM"
  | { type: "choice"; correctIndex: number };

export type Skill = "locate" | "understand" | "evaluate" | "formulate" | "employ" | "interpret";

/** Всё, что зависит от языка. */
export interface LocalizedTask {
  title: string;
  context: string;
  question: string;
  /** Эталонные фрагменты: ученик обязан выделить их все. Дословные подстроки context. */
  evidence: string[];
  /** Фрагменты, которые можно выделить вместе с эталоном (не обязательно). */
  evidenceOptional?: string[];
  /** Лишние данные-ловушки. Дословные подстроки context. */
  distractors?: string[];
  /** Единица измерения для числового ответа (показывается рядом с полем ввода). */
  unit?: string;
  /** Варианты финального ответа (для answer.type === "choice"). */
  options?: string[];
  /** Дополнительные записи ответа — для фильтра утечки. */
  answerVariants?: string[];
  /** Вопросы с выбором для шагов. compute_check здесь — проверка смысла после ввода ответа. */
  checks: Partial<Record<ChoiceStep, ChoiceCheck>>;
  /** Подсказки уровней 1 и 2 для шагов. */
  hints: Partial<Record<StepId, [string, string]>>;
  /** Уровень 3: такая же задача с другими данными и полным решением. */
  twin: { context: string; solution: string };
}

export interface Task {
  id: string;
  subject: Subject;
  grade: 7 | 8 | 9;
  skill: Skill;
  steps: StepId[];
  answer: Answer;
  /** Независимый пересчёт ответа кодом (только математика). Проверяется в тестах. */
  solve?: () => number | string;
  kk: LocalizedTask;
  ru: LocalizedTask;
}

export interface StudentAction {
  selected?: string[];
  input?: string;
  choice?: number;
}

export interface HintRequest {
  taskId: string;
  lang: Lang;
  step: StepId;
  level: 1 | 2;
  action?: StudentAction;
}

export interface HintResponse {
  hint: string;
  source: "ai" | "offline";
  reason?: string;
}
