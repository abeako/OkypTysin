import { describe, expect, it } from "vitest";
import { addMinutes, checkAnswer, checkEvidence, parseNumber, parseTime } from "../src/lib/check";
import { segmentContext } from "../src/lib/segments";

describe("разбор ввода", () => {
  it("числа", () => {
    expect(parseNumber("5 500")).toBe(5500);
    expect(parseNumber("5500 ₸")).toBe(5500);
    expect(parseNumber("2,5")).toBe(2.5);
    expect(parseNumber("15 т")).toBe(15);
    expect(parseNumber("не знаю")).toBeNull();
  });
  it("время", () => {
    expect(parseTime("11:30")).toBe(690);
    expect(parseTime("11.30")).toBe(690);
    expect(parseTime("11 ч 30 мин")).toBe(690);
    expect(parseTime("11 сағ 30 мин")).toBe(690);
    expect(parseTime("11")).toBe(660);
    expect(parseTime("25:00")).toBeNull();
  });
  it("сложение времени", () => {
    expect(addMinutes("7:40", 230)).toBe("11:30");
    expect(addMinutes("23:30", 60)).toBe("0:30");
  });
});

describe("проверка ответа", () => {
  it("время", () => {
    const a = { type: "time" as const, value: "11:30" };
    expect(checkAnswer(a, "11.30")).toBe("correct");
    expect(checkAnswer(a, "10:90")).toBe("unparsed");
    expect(checkAnswer(a, "11:10")).toBe("wrong");
    expect(checkAnswer(a, "абв")).toBe("unparsed");
  });
  it("число с допуском", () => {
    expect(checkAnswer({ type: "number", value: 15, tolerance: 0.001 }, "15,0")).toBe("correct");
    expect(checkAnswer({ type: "number", value: 5500 }, "5 500")).toBe("correct");
    expect(checkAnswer({ type: "number", value: 5500 }, "117 800")).toBe("wrong");
  });
  it("выбор", () => {
    expect(checkAnswer({ type: "choice", correctIndex: 1 }, 1)).toBe("correct");
    expect(checkAnswer({ type: "choice", correctIndex: 1 }, 0)).toBe("wrong");
  });
});

describe("проверка доказательства", () => {
  const ev = ["7:40", "3 ч 50 мин", "12:00"];
  it("верно только при полном наборе без лишнего", () => {
    expect(checkEvidence(["7:40", "3 ч 50 мин", "12:00"], ev).ok).toBe(true);
    expect(checkEvidence(["7:40", "3 ч 50 мин"], ev)).toMatchObject({ ok: false, missing: 1 });
    expect(checkEvidence([...ev, "4 500 ₸"], ev, [], ["4 500 ₸"])).toMatchObject({ ok: false, distractorPicked: true });
  });
  it("необязательные фрагменты разрешены", () => {
    expect(checkEvidence(["A", "B"], ["A"], ["B"]).ok).toBe(true);
    expect(checkEvidence(["A", "C"], ["A"], ["B"]).ok).toBe(false);
  });
});

describe("разбиение текста", () => {
  it("математика: числа выделяются, текст сохраняется", () => {
    const ctx = "Автобус отправляется в 7:40 и едет 3 ч 50 мин. Билет стоит 4 500 ₸, а ещё 2 кг.";
    const segs = segmentContext(ctx, "math", ["7:40", "3 ч 50 мин"]);
    expect(segs.map((s) => s.text).join("")).toBe(ctx);
    const tappable = segs.filter((s) => s.id !== null).map((s) => s.text);
    expect(tappable).toEqual(["7:40", "3 ч 50 мин", "4 500 ₸", "2"]);
  });
  it("чтение: предложения и строки", () => {
    const ctx = "Заголовок\nПервое предложение. Второе!\nТретье?";
    const segs = segmentContext(ctx, "reading", ["Второе!"]);
    expect(segs.map((s) => s.text).join("")).toBe(ctx);
    expect(segs.filter((s) => s.id !== null).map((s) => s.text)).toEqual([
      "Заголовок",
      "Первое предложение.",
      "Второе!",
      "Третье?",
    ]);
  });
});
