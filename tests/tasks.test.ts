/**
 * Проверка банка задач кодом. Запуск: npm run check-tasks
 * - ответы в математике пересчитываются функцией solve();
 * - эталон и ловушки — дословные подстроки текста, без пересечений;
 * - kk и ru версии согласованы;
 * - ни одна заранее записанная подсказка, вопрос шага или задача-близнец не раскрывает ответ.
 */
import { describe, expect, it } from "vitest";
import { TASKS } from "../src/tasks";
import type { Lang, StepId } from "../src/types";
import { checkAnswer } from "../src/lib/check";
import { checkLeak } from "../src/lib/leak";
import { segmentContext } from "../src/lib/segments";

const LANGS: Lang[] = ["kk", "ru"];
const HINT_STEPS: StepId[] = ["select_evidence", "operation", "compute_check", "infer", "answer"];

describe("банк задач", () => {
  it("12 задач: 6 математика + 6 чтение, уникальные id", () => {
    expect(TASKS).toHaveLength(12);
    expect(TASKS.filter((t) => t.subject === "math")).toHaveLength(6);
    expect(TASKS.filter((t) => t.subject === "reading")).toHaveLength(6);
    expect(new Set(TASKS.map((t) => t.id)).size).toBe(12);
  });

  for (const task of TASKS) {
    describe(task.id, () => {
      if (task.subject === "math") {
        it("ответ пересчитан кодом (solve)", () => {
          expect(task.solve).toBeTypeOf("function");
          const solved = task.solve!();
          if (task.answer.type === "number") {
            expect(Math.abs(Number(solved) - task.answer.value)).toBeLessThan(1e-9);
            expect(checkAnswer(task.answer, String(solved))).toBe("correct");
          } else if (task.answer.type === "time") {
            expect(checkAnswer(task.answer, String(solved))).toBe("correct");
          } else {
            throw new Error("в математике ответ вводится, а не выбирается");
          }
        });
        it("в каждой версии есть лишние данные (distractors)", () => {
          for (const lang of LANGS) expect(task[lang].distractors?.length ?? 0).toBeGreaterThan(0);
        });
      } else {
        it("финальный ответ — выбор варианта", () => {
          expect(task.answer.type).toBe("choice");
        });
      }

      it("шаги соответствуют предмету", () => {
        const expected =
          task.subject === "math"
            ? ["what_asked", "select_evidence", "operation", "compute_check"]
            : ["what_asked", "select_evidence", "infer", "answer"];
        expect(task.steps).toEqual(expected);
      });

      for (const lang of LANGS) {
        const loc = task[lang];
        describe(lang, () => {
          it("эталон, необязательные фрагменты и ловушки — подстроки текста, встречаются один раз и не пересекаются", () => {
            const all = [...loc.evidence, ...(loc.evidenceOptional ?? []), ...(loc.distractors ?? [])];
            expect(loc.evidence.length).toBeGreaterThan(0);
            const ranges: [number, number][] = [];
            for (const f of all) {
              const i = loc.context.indexOf(f);
              expect(i, `«${f}» нет в тексте`).toBeGreaterThanOrEqual(0);
              expect(loc.context.indexOf(f, i + 1), `«${f}» встречается дважды`).toBe(-1);
              for (const [s, e] of ranges) expect(i >= e || i + f.length <= s, `«${f}» пересекается`).toBe(true);
              ranges.push([i, i + f.length]);
            }
          });

          it("каждый эталонный фрагмент можно выделить целиком", () => {
            const segs = segmentContext(loc.context, task.subject, [
              ...loc.evidence,
              ...(loc.evidenceOptional ?? []),
              ...(loc.distractors ?? []),
            ]);
            const tappable = segs.filter((s) => s.id !== null).map((s) => s.text);
            for (const f of loc.evidence) expect(tappable).toContain(f);
            expect(segs.map((s) => s.text).join("")).toBe(loc.context);
            // выделяемых фрагментов больше, чем эталонных: ответ не виден по разметке
            expect(tappable.length).toBeGreaterThan(loc.evidence.length);
          });

          it("для каждого шага есть вопрос или подсказки", () => {
            for (const step of task.steps) {
              if (step === "what_asked" || step === "operation" || step === "infer") {
                const c = loc.checks[step];
                expect(c, `нет вопроса для ${step}`).toBeDefined();
                expect(c!.correctIndex).toBeLessThan(c!.options.length);
              }
              if (step !== "what_asked") expect(loc.hints[step], `нет подсказок для ${step}`).toBeDefined();
            }
            if (task.answer.type === "choice") {
              expect(loc.options?.length).toBeGreaterThanOrEqual(3);
              expect(task.answer.correctIndex).toBeLessThan(loc.options!.length);
            }
          });

          it("ни подсказки, ни вопросы шагов, ни задача-близнец не раскрывают ответ", () => {
            const texts: string[] = [loc.question, loc.twin.context, loc.twin.solution];
            for (const step of HINT_STEPS) texts.push(...(loc.hints[step] ?? []));
            const afterEvidence: string[] = [];
            const wa = loc.checks.what_asked;
            if (wa) texts.push(wa.prompt, ...wa.options);
            for (const key of ["operation", "infer"] as const) {
              const c = loc.checks[key];
              if (c) afterEvidence.push(c.prompt, ...c.options);
            }
            for (const t of texts) {
              const r = checkLeak(t, task, lang);
              expect(r.leak, `утечка (${r.reason}): «${t}»`).toBe(false);
            }
            // вопросы шагов 3 показываются после доказательства: цитировать эталон можно, ответ — нельзя
            for (const t of afterEvidence) {
              const r = checkLeak(t, task, lang, { allowEvidence: true });
              expect(r.leak, `утечка (${r.reason}): «${t}»`).toBe(false);
            }
          });
        });
      }

      it("kk и ru согласованы", () => {
        for (const key of ["what_asked", "operation", "infer", "compute_check"] as const) {
          const kk = task.kk.checks[key];
          const ru = task.ru.checks[key];
          expect(!!kk).toBe(!!ru);
          if (kk && ru) {
            expect(kk.correctIndex).toBe(ru.correctIndex);
            expect(kk.options.length).toBe(ru.options.length);
          }
        }
        expect(task.kk.evidence.length).toBe(task.ru.evidence.length);
        expect(task.kk.options?.length).toBe(task.ru.options?.length);
      });
    });
  }
});
