// Серверная функция Vercel: POST /api/hint
import { BadRequest, handleHint } from "../server/hint";
import { makeClaudeGenerator } from "../server/claude";

const generate = makeClaudeGenerator();

interface Req {
  method?: string;
  body?: unknown;
}
interface Res {
  status(code: number): Res;
  json(data: unknown): void;
  setHeader(name: string, value: string): void;
}

export default async function handler(req: Req, res: Res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "method" });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    res.status(200).json(await handleHint(body, generate));
  } catch (e) {
    if (e instanceof BadRequest || e instanceof SyntaxError) res.status(400).json({ error: e.message });
    else res.status(500).json({ error: "internal" });
  }
}
