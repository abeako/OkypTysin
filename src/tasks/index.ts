import type { Task } from "../types";
import m1 from "./math-01-bus";
import m2 from "./math-02-electricity";
import m3 from "./math-03-installment";
import m4 from "./math-04-hay";
import m5 from "./math-05-floor";
import m6 from "./math-06-discount";
import r1 from "./read-01-water";
import r2 from "./read-02-syrup";
import r3 from "./read-03-sms";
import r4 from "./read-04-camp";
import r5 from "./read-05-schedule";
import r6 from "./read-06-saiga";

/** Банк задач. Хранится в коде приложения, поэтому доступен без интернета. */
export const TASKS: Task[] = [m1, m2, m3, m4, m5, m6, r1, r2, r3, r4, r5, r6];

export function getTask(id: string): Task | undefined {
  return TASKS.find((t) => t.id === id);
}
