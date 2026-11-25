import type { HintRequest, HintResponse, Lang, StepId } from "../src/types";
import { getTask } from "../src/tasks";
import { checkLeak } from "../src/lib/leak";
import { offlineHint } from "../src/lib/describe";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";

/** Функция, которая просит у модели подсказку. Возвращает текст или null. */
export type Generate = (system: string, user: string) => Promise<string | null>;

export class BadRequest extends Error {}

const STEPS: StepId[] = ["what_asked", "select_evidence", "operation", "compute_check", "infer", "answer"];
const MAX_ATTEMPTS = 2;

function clip(s: unknown, n: number): string {
  return String(s ?? "").slice(0, n);
}

/** Проверяет и очищает запрос от клиента. Ничего из клиента не принимается на веру. */
export function parseHintRequest(body: unknown): HintRequest {
  if (!body || typeof body !== "object") throw new BadRequest("body");
  const b = body as Record<string, unknown>;
  const taskId = clip(b.taskId, 64);
  const lang = b.lang as Lang;
  const step = b.step as StepId;
  const level = Number(b.level);
  if (!getTask(taskId)) throw new BadRequest("taskId");
  if (lang !== "kk" && lang !== "ru") throw new BadRequest("lang");
  if (!STEPS.includes(step)) throw new BadRequest("step");
  if (level !== 1 && level !== 2) throw new BadRequest("level");
  const a = (b.action ?? {}) as Record<string, unknown>;
  const action: HintRequest["action"] = {};
  if (Array.isArray(a.selected)) action.selected = a.selected.slice(0, 20).map((s) => clip(s, 300));
  if (typeof a.input === "string") action.input = clip(a.input, 40);
  if (typeof a.choice === "number" && Number.isInteger(a.choice)) action.choice = a.choice;
  return { taskId, lang, step, level, action };
}

/**
 * Главная функция подсказки. ИИ формулирует подсказку под ошибку ученика;
 * каждый ответ ИИ проходит фильтр утечки. После 2 неудач (или без ИИ)
 * возвращается заранее записанная подсказка из задачи.
 */
export async function handleHint(body: unknown, generate?: Generate): Promise<HintResponse> {
  const req = parseHintRequest(body);
  const task = getTask(req.taskId)!;
  if (!task.steps.includes(req.step)) throw new BadRequest("step");
  const fallback = offlineHint(task, req.lang, req.step, req.level);
  if (!generate) return { hint: fallback, source: "offline", reason: "no-ai" };

  const system = buildSystemPrompt(req.lang);
  const user = buildUserPrompt(task, req.lang, req.step, req.level, req.action);
  let reason = "empty";
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let text: string | null = null;
    try {
      text = await generate(system, user);
    } catch (e) {
      reason = "ai-error";
      console.error("[hint] ai error:", e instanceof Error ? e.message : e);
      break; // сеть/ключ — повтор не поможет, отдаём офлайн-подсказку
    }
    text = text?.trim() ?? "";
    if (!text || text.length > 400) {
      reason = text ? "too-long" : "empty";
      continue;
    }
    const leak = checkLeak(text, task, req.lang);
    if (leak.leak) {
      reason = `leak:${leak.reason}`;
      console.warn(`[hint] отброшено (${leak.reason}) для ${task.id}`);
      continue;
    }
    return { hint: text, source: "ai" };
  }
  return { hint: fallback, source: "offline", reason };
}
