import { describe, expect, it } from "vitest";
import { checkLeak } from "../src/lib/leak";
import { getTask } from "../src/tasks";

const bus = getTask("math-01-bus")!;
const light = getTask("math-02-electricity")!;
const water = getTask("read-01-water")!;
const syrup = getTask("read-02-syrup")!;
const schedule = getTask("read-05-schedule")!;

const leaks = (t: string, task = bus, lang: "ru" | "kk" = "ru") => checkLeak(t, task, lang).leak;

describe("фильтр утечки: время", () => {
  it.each([
    "Автобус приедет в 11:30.",
    "Получится 11.30",
    "Ответ: 11 ч 30 мин",
    "в 11 часов 30 минут",
    "примерно в половина двенадцатого",
    "Будет 11 : 30, успеет",
  ])("ловит «%s»", (t) => expect(leaks(t)).toBe(true));

  it("ловит казахские записи", () => {
    expect(leaks("Автобус 11 сағ 30 мин-та жетеді", bus, "kk")).toBe(true);
    expect(leaks("он бір жарымда", bus, "kk")).toBe(true);
  });

  it.each([
    "Прибавь к 7:40 сначала часы, потом минуты.",
    "Сравни время прибытия с 12:00.",
    "Ответ будет между 11:00 и 12:00? Проверь сам.",
    "Помни, что в часе 60 минут.",
  ])("пропускает «%s»", (t) => expect(leaks(t)).toBe(false));
});

describe("фильтр утечки: число", () => {
  it.each(["Заплатить нужно 5500 ₸", "Получится 5 500 тенге", "это 5,5 тыс. ₸", "Ответ 5 500"])(
    "ловит «%s»",
    (t) => expect(leaks(t, light)).toBe(true),
  );
  it.each(["Из 4 732 вычти 4 512.", "Умножь разницу на 25 ₸.", "Сколько кВт·ч за месяц?"])(
    "пропускает «%s»",
    (t) => expect(leaks(t, light)).toBe(false),
  );
});

describe("фильтр утечки: чтение", () => {
  it("ловит текст правильного варианта", () => {
    expect(leaks("Правильно: у здания школы № 2 с 12:00 до 17:00", water)).toBe(true);
  });
  it("ловит номер правильного варианта", () => {
    expect(leaks("Выбери вариант 2", water)).toBe(true);
    expect(leaks("Второй вариант верный", water)).toBe(true);
    expect(leaks("Дұрысы — 2-нұсқа", water, "kk")).toBe(true);
    expect(leaks("Ответ — 4-й вариант", syrup)).toBe(true);
  });
  it("ловит дословное предложение-доказательство", () => {
    expect(leaks("Смотри: подвоз питьевой воды организован у здания школы", water)).toBe(true);
    expect(leaks("Там написано: ауыз су 2-мектеп ғимаратының жанына тасымалданады", water, "kk")).toBe(true);
  });
  it("короткий ответ-время не путается с другим временем", () => {
    expect(leaks("Рейс в 16:30 приезжает слишком поздно", schedule)).toBe(false);
    expect(leaks("Садись на 6:30", schedule)).toBe(true);
  });
  it("пропускает нормальную подсказку", () => {
    expect(leaks("Найди предложение, где сказано, где можно получить воду.", water)).toBe(false);
  });
});
