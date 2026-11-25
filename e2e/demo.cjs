/**
 * Сквозной тест сценария демо (раздел 9 брифа) в настоящем браузере.
 * Нужен Playwright (npm i -D playwright && npx playwright install chromium).
 * Запуск: npm run build && npm run e2e
 */
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const PORT = 4179;
const URL = `http://localhost:${PORT}/`;
const SHOTS = process.env.SHOTS_DIR || path.join(__dirname, "screenshots");

function assert(cond, msg) {
  if (!cond) throw new Error("ПРОВАЛ: " + msg);
  console.log("  ✓ " + msg);
}

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(URL);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("preview-сервер не запустился");
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
    stdio: "ignore",
    env: { ...process.env, ANTHROPIC_API_KEY: "" }, // офлайн-подсказки: тест не зависит от ИИ
  });
  const browser = await chromium.launch();
  try {
    await waitForServer();
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const shot = (name) => page.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage: true });

    await page.goto(URL);
    await page.evaluate(() => localStorage.setItem("dalel.lang", '"ru"'));
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await shot("01-list");

    console.log("Математика: «Автобус в Баянаул»");
    await page.click('[data-testid="task-math-01-bus"]');

    // 1. Ответ наугад до доказательства — не засчитан
    await page.click('[data-testid="early-open"]');
    await page.fill('[data-testid="early-input"]', "11:30");
    await page.click('[data-testid="early-submit"]');
    assert(await page.isVisible('[data-testid="early-result"]'), "ответ без доказательства не засчитан");

    // Шаг 1: что спрашивают
    const choices = () => page.locator(".choice");
    await choices().nth(1).click();
    await page.click('[data-testid="check"]');
    assert(await page.isVisible('[data-testid="step-select_evidence"]'), "шаг 1 пройден");

    // 2. Выделяет цену билета → подсказка уровня 1
    const frag = (text) => page.locator(".frag", { hasText: text }).first();
    await frag("7:40").click();
    await frag("4 500 ₸").click();
    await page.click('[data-testid="check"]');
    await shot("02-wrong-evidence");
    const hint1 = await page.locator('[data-testid="hints"] .hint').first().innerText();
    assert(hint1.includes("Нужна ли цена билета"), "ловушка → подсказка уровня 1 про цену билета");

    // Верное доказательство
    await frag("4 500 ₸").click();
    await frag("3 ч 50 мин").click();
    await frag("12:00").click();
    await page.click('[data-testid="check"]');
    assert(await page.isVisible('[data-testid="step-operation"]'), "доказательство принято кодом");

    // Шаг 3: действие
    await choices().nth(1).click();
    await page.click('[data-testid="check"]');
    assert(await page.isVisible('[data-testid="step-compute_check"]'), "действие выбрано верно");

    // 3. Ошибка в вычислении → уровень 1, 2, затем задача-близнец
    await page.fill('[data-testid="answer-input"]', "11:10");
    await page.click('[data-testid="check"]');
    await page.fill('[data-testid="answer-input"]', "12:10");
    await page.click('[data-testid="check"]');
    await page.fill('[data-testid="answer-input"]', "10:30");
    await page.click('[data-testid="check"]');
    assert(await page.isVisible('[data-testid="twin"]'), "после трёх ошибок открыта задача-близнец");
    const pageText = await page.locator("main").innerText();
    assert(!/11[:.]30/.test(pageText.replace(/половин/g, "")), "на экране нигде нет ответа 11:30");
    await shot("03-twin");

    // 4. Решает сам → засчитано
    await page.fill('[data-testid="answer-input"]', "11.30");
    await page.click('[data-testid="check"]');
    await choices().nth(0).click(); // успеет
    await page.click('[data-testid="check"]');
    assert(await page.isVisible('[data-testid="done"]'), "задача засчитана");
    await shot("04-done");

    // 5. Авиарежим → задача по чтению работает
    console.log("Авиарежим: «Отключение воды»");
    await ctx.setOffline(true);
    await page.goto(URL);
    assert((await page.innerText('[data-testid="net"]')).includes("Офлайн"), "приложение открылось без сети");
    await page.click('[role="tab"]:nth-child(2)');
    await page.click('[data-testid="task-read-01-water"]');
    await choices().nth(1).click();
    await page.click('[data-testid="check"]');
    await page.locator(".frag", { hasText: "с 9:00 до 18:00" }).click();
    await page.click('[data-testid="check"]');
    const offHint = await page.locator('[data-testid="hints"] .hint').first();
    assert((await offHint.getAttribute("data-source")) === "offline", "подсказка пришла из офлайн-банка");
    await shot("05-offline-hint");
    await page.locator(".frag", { hasText: "с 9:00 до 18:00" }).click();
    await page.locator(".frag", { hasText: "Подвоз питьевой воды" }).click();
    await page.click('[data-testid="check"]');
    await choices().nth(1).click();
    await page.click('[data-testid="check"]');
    await choices().nth(1).click();
    await page.click('[data-testid="check"]');
    assert(await page.isVisible('[data-testid="done"]'), "задача по чтению решена офлайн");

    // Казахский интерфейс
    await page.click('button:has-text("ҚАЗ")');
    assert((await page.innerText("main")).includes("Есептер"), "переключение на казахский");
    await page.click(".link.back");
    await page.click('[role="tab"]:nth-child(1)');
    assert((await page.locator(".solved").count()) === 1, "решённая задача отмечена в списке");
    await shot("06-kk-list");

    // Нет горизонтальной прокрутки на 360px
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert(!overflow, "нет горизонтальной прокрутки на ширине 360px");
    assert(errors.length === 0, "нет ошибок JavaScript" + (errors.length ? ": " + errors.join("; ") : ""));
    console.log("\nСценарий демо пройден.");
  } finally {
    await browser.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
