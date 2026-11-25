import type { HintRequest, HintResponse, Lang } from "./types";
import { getTask } from "./tasks";
import { checkLeak } from "./lib/leak";

/**
 * Просит у сервера персональную подсказку ИИ. Если сети нет, сервер молчит
 * или ответ похож на утечку — возвращает null, и остаётся офлайн-подсказка.
 */
export async function fetchAiHint(req: HintRequest, timeoutMs = 12_000): Promise<string | null> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("/api/hint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as HintResponse;
    if (data.source !== "ai" || typeof data.hint !== "string") return null;
    // Вторая линия защиты: фильтр утечки работает и на телефоне.
    const task = getTask(req.taskId);
    if (!task || checkLeak(data.hint, task, req.lang as Lang).leak) return null;
    return data.hint;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
