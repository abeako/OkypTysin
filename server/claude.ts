import Anthropic from "@anthropic-ai/sdk";
import type { Generate } from "./hint";

const DEFAULT_MODEL = "claude-opus-5-5";

/**
 * Генератор подсказок через Claude. Ключ берётся только из переменных окружения сервера.
 * Возвращает undefined, если ключа нет, — тогда работают офлайн-подсказки.
 */
export function makeClaudeGenerator(env: Record<string, string | undefined> = process.env): Generate | undefined {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return undefined;
  const model = env.HINT_MODEL || DEFAULT_MODEL;
  // Короткий таймаут: на слабом интернете лучше быстро отдать офлайн-подсказку.
  const client = new Anthropic({ apiKey, timeout: 9_000, maxRetries: 0 });
  const useFallbacks = !model.includes("haiku");

  return async (system, user) => {
    const params = {
      model,
      max_tokens: 1024,
      output_config: { effort: "low" as const },
      system,
      messages: [{ role: "user" as const, content: user }],
      ...(useFallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
    };
    const res = await client.beta.messages.create(params as Parameters<typeof client.beta.messages.create>[0] & { stream?: false });
    if (res.stop_reason === "refusal") return null;
    return res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
  };
}
