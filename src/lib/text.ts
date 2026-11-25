/** Нормализация текста для сравнения: регистр, ё, кавычки, пробелы, записи чисел и времени. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[   ]/g, " ")
    .replace(/[«»"“”„'’`]/g, "")
    .replace(/[–—−]/g, "-")
    .replace(/(\d) (?=\d{3}(?!\d))/g, "$1") // 4 500 -> 4500
    .replace(/(\d)\s*[:.]\s*(?=\d{2}(?!\d))/g, "$1:") // 11.30 / 11 : 30 -> 11:30
    .replace(/\s+/g, " ")
    .trim();
}

export function words(s: string): string[] {
  return normalizeText(s)
    .split(/[^\p{L}\p{N}:]+/u)
    .filter(Boolean);
}

const ALNUM = /[\p{L}\p{N}]/u;

/** Есть ли needle в hay так, чтобы он не был частью более длинного слова или числа. */
export function includesBounded(hay: string, needle: string): boolean {
  if (!needle) return false;
  let i = hay.indexOf(needle);
  while (i >= 0) {
    const before = hay[i - 1];
    const after = hay[i + needle.length];
    const okBefore = !before || !ALNUM.test(needle[0]) || !(ALNUM.test(before) || before === ":" || (before === "," && /\d/.test(hay[i - 2] ?? "")));
    // После слова разрешены окончания (каз. «жарымда», рус. «двенадцатого»), после числа — нет.
    const last = needle[needle.length - 1];
    const okAfter =
      !after || !ALNUM.test(last) || /\p{L}/u.test(last) || !(ALNUM.test(after) || (/[:,]/.test(after) && /\d/.test(hay[i + needle.length + 1] ?? "")));
    if (okBefore && okAfter) return true;
    i = hay.indexOf(needle, i + 1);
  }
  return false;
}
