import { useMemo, useRef, useState } from "react";
import type { ChoiceCheck, Lang, StepId, StudentAction, Task } from "../types";
import type { Dict } from "../i18n";
import { segmentContext } from "../lib/segments";
import { checkAnswer, checkEvidence } from "../lib/check";
import { offlineHint } from "../lib/describe";
import { fetchAiHint } from "../hintClient";
import { saveTaskProgress } from "../storage";

interface Props {
  task: Task;
  lang: Lang;
  t: Dict;
  online: boolean;
  hasNext: boolean;
  onExit: () => void;
  onNext: () => void;
}

type Feedback = { kind: "ok" | "err" | "info"; text: string } | null;
interface HintItem {
  level: 1 | 2 | 3;
  text: string;
  source: "ai" | "offline";
  pending?: boolean;
}

export function TaskPlayer({ task, lang, t, online, hasNext, onExit, onNext }: Props) {
  const loc = task[lang];
  const [stepIdx, setStepIdx] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [choice, setChoice] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<"main" | "sense">("main");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [hints, setHints] = useState<HintItem[]>([]);
  const [mistakes, setMistakes] = useState<Partial<Record<StepId, number>>>({});
  const [done, setDone] = useState(false);
  const [early, setEarly] = useState<{ open: boolean; value: string; sent: boolean }>({ open: false, value: "", sent: false });
  const hintReq = useRef(0); // чтобы ответ ИИ для старого шага не попал в новый

  const step = task.steps[stepIdx];
  const evidenceIdx = task.steps.indexOf("select_evidence");
  const evidenceDone = stepIdx > evidenceIdx || done;
  const hintLevel = hints.length;

  const segments = useMemo(
    () =>
      segmentContext(loc.context, task.subject, [
        ...loc.evidence,
        ...(loc.evidenceOptional ?? []),
        ...(loc.distractors ?? []),
      ]),
    [loc, task.subject],
  );
  const selectedTexts = () => segments.filter((s) => s.id !== null && selected.has(s.id)).map((s) => s.text);

  // ---------- подсказки ----------
  function currentAction(): StudentAction | undefined {
    if (step === "select_evidence") return { selected: selectedTexts() };
    if (step === "compute_check" && phase === "main") return input ? { input } : undefined;
    return choice !== null ? { choice } : undefined;
  }

  function requestHint(action = currentAction()) {
    const level = (hintLevel + 1) as 1 | 2 | 3;
    if (level > 3) return;
    if (level === 3) {
      setHints((h) => [...h, { level: 3, text: "", source: "offline" }]);
      return;
    }
    const reqId = ++hintReq.current;
    const index = hintLevel;
    const text = offlineHint(task, lang, step, level);
    setHints((h) => [...h, { level, text, source: "offline", pending: online }]);
    if (!online) return;
    fetchAiHint({ taskId: task.id, lang, step, level, action }).then((ai) => {
      if (reqId !== hintReq.current) return;
      setHints((h) =>
        h.map((item, i) => (i === index ? { ...item, pending: false, ...(ai ? { text: ai, source: "ai" as const } : {}) } : item)),
      );
    });
  }

  function mistake(text: string, action?: StudentAction) {
    setFeedback({ kind: "err", text });
    setMistakes((m) => ({ ...m, [step]: (m[step] ?? 0) + 1 }));
    if (hintLevel < 3) requestHint(action);
  }

  // ---------- переходы ----------
  function finish(finalMistakes = mistakes) {
    setDone(true);
    setFeedback(null);
    saveTaskProgress(task.id, { solved: true, mistakes: finalMistakes });
  }

  function goNext(text: string) {
    hintReq.current++;
    if (stepIdx === task.steps.length - 1) return finish();
    setStepIdx(stepIdx + 1);
    setChoice(null);
    setInput("");
    setPhase("main");
    setHints([]);
    setFeedback({ kind: "ok", text });
  }

  function choiceCheck(): ChoiceCheck | undefined {
    if (step === "answer") return { prompt: loc.question, options: loc.options ?? [], correctIndex: (task.answer as { correctIndex: number }).correctIndex };
    if (step === "compute_check") return phase === "sense" ? loc.checks.compute_check : undefined;
    if (step === "select_evidence") return undefined;
    return loc.checks[step];
  }

  function submit() {
    if (step === "select_evidence") {
      const sel = selectedTexts();
      if (!sel.length) return setFeedback({ kind: "info", text: t.evidenceEmpty });
      const r = checkEvidence(sel, loc.evidence, loc.evidenceOptional, loc.distractors);
      if (r.ok) return goNext(t.evidenceOk);
      return mistake(r.extra.length ? t.evidenceExtra : t.evidenceMissing, { selected: sel });
    }
    if (step === "compute_check" && phase === "main") {
      const r = checkAnswer(task.answer, input);
      if (r === "unparsed") return setFeedback({ kind: "info", text: task.answer.type === "time" ? t.unparsedTime : t.unparsed });
      if (r === "wrong") return mistake(t.wrong, { input });
      if (loc.checks.compute_check) {
        hintReq.current++;
        setPhase("sense");
        setHints([]);
        setChoice(null);
        return setFeedback({ kind: "ok", text: t.answerCorrectNow });
      }
      return finish();
    }
    const c = choiceCheck();
    if (!c || choice === null) return;
    if (choice === c.correctIndex) return goNext(t.correctStep);
    mistake(t.wrong, { choice });
  }

  // ---------- отрисовка ----------
  const proved = (id: number | null) => {
    if (id === null || !evidenceDone || !selected.has(id)) return false;
    return true;
  };

  if (done) {
    const list = task.steps.filter((s) => (mistakes[s] ?? 0) > 0);
    return (
      <div className="screen">
        <TopBar t={t} title={loc.title} onExit={onExit} />
        <section className="card done" data-testid="done">
          <div className="done-icon" aria-hidden>✓</div>
          <h2>{t.doneTitle}</h2>
          <ContextView segments={segments} active={false} selected={selected} proved={proved} onToggle={() => {}} />
          <h3>{t.doneMistakes}</h3>
          {list.length === 0 ? (
            <p>{t.doneNoMistakes}</p>
          ) : (
            <ul className="mistakes">
              {list.map((s) => (
                <li key={s}>
                  {t.stepTitle[s]} — {t.times(mistakes[s]!)}
                </li>
              ))}
            </ul>
          )}
          <div className="row">
            {hasNext && (
              <button className="btn primary" onClick={onNext}>
                {t.nextTask}
              </button>
            )}
            <button className="btn" onClick={onExit}>
              {t.toList}
            </button>
          </div>
        </section>
      </div>
    );
  }

  const c = choiceCheck();
  const isInput = step === "compute_check" && phase === "main";
  const canSubmit = step === "select_evidence" ? true : isInput ? input.trim().length > 0 : choice !== null;

  return (
    <div className="screen">
      <TopBar t={t} title={loc.title} onExit={onExit} />

      <section className="card context">
        <ContextView
          segments={segments}
          active={step === "select_evidence"}
          selected={selected}
          proved={proved}
          onToggle={(id) => {
            const next = new Set(selected);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            setSelected(next);
            setFeedback(null);
          }}
        />
      </section>

      <section className="card question">
        <span className="label">{t.question}</span>
        <p>{loc.question}</p>
      </section>

      <ol className="steps" aria-label="progress">
        {task.steps.map((s, i) => (
          <li key={s} className={i < stepIdx ? "past" : i === stepIdx ? "current" : ""}>
            <span className="dot">{i < stepIdx ? "✓" : i + 1}</span>
            <span className="step-name">{t.stepTitle[s]}</span>
          </li>
        ))}
      </ol>

      <section className="card step" data-testid={`step-${step}`}>
        <span className="label">{t.stepOf(stepIdx + 1, task.steps.length)}</span>
        <h2>{t.stepTitle[step]}</h2>

        {step === "select_evidence" && (
          <>
            <p className="instr">{task.subject === "math" ? t.selectMath : t.selectReading}</p>
            <p className="muted">{t.selectedCount(selected.size)}</p>
          </>
        )}

        {isInput && (
          <label className="answer-input">
            <span>{t.enterAnswer}</span>
            <span className="input-row">
              <input
                data-testid="answer-input"
                value={input}
                inputMode={task.answer.type === "number" ? "decimal" : "text"}
                placeholder={task.answer.type === "time" ? t.timePlaceholder : t.numberPlaceholder}
                onChange={(e) => {
                  setInput(e.target.value);
                  setFeedback(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && canSubmit && submit()}
              />
              {loc.unit && <span className="unit">{loc.unit}</span>}
            </span>
          </label>
        )}

        {c && (
          <>
            {step !== "answer" && <p className="instr">{c.prompt}</p>}
            <div className="choices" role="radiogroup">
              {c.options.map((o, i) => (
                <button
                  key={i}
                  role="radio"
                  aria-checked={choice === i}
                  className={`choice ${choice === i ? "chosen" : ""}`}
                  onClick={() => {
                    setChoice(i);
                    setFeedback(null);
                  }}
                >
                  {o}
                </button>
              ))}
            </div>
          </>
        )}

        {feedback && (
          <p className={`feedback ${feedback.kind}`} role="status">
            {feedback.text}
          </p>
        )}

        <div className="row">
          <button className="btn primary" disabled={!canSubmit} onClick={submit} data-testid="check">
            {t.check}
          </button>
          <button className="btn" disabled={hintLevel >= 3} onClick={() => requestHint()} data-testid="hint">
            {hintLevel >= 3 ? t.noMoreHints : `${t.hint} ${hintLevel + 1}/3`}
          </button>
        </div>
      </section>

      {hints.length > 0 && (
        <section className="hints" data-testid="hints">
          {hints.map((h, i) =>
            h.level === 3 ? (
              <div key={i} className="hint twin" data-testid="twin">
                <span className="label">{t.hintLevel(3)}</span>
                <p className="muted">{t.twinTitle}</p>
                <p className="twin-task">{loc.twin.context}</p>
                <p className="twin-solution">{loc.twin.solution}</p>
                <p className="muted">{t.twinNote}</p>
              </div>
            ) : (
              <div key={i} className="hint" data-source={h.source}>
                <span className="label">
                  {t.hintLevel(h.level)}
                  <span className={`badge ${h.source}`}>{h.source === "ai" ? t.aiBadge : t.offlineBadge}</span>
                </span>
                <p>{h.text}</p>
                {h.pending && <p className="muted small">{t.checking}</p>}
              </div>
            ),
          )}
        </section>
      )}

      {!evidenceDone && (
        <section className="early">
          {!early.open ? (
            <button className="link" onClick={() => setEarly({ ...early, open: true })} data-testid="early-open">
              {t.earlyLink}
            </button>
          ) : (
            <div className="card">
              <h3>{t.earlyTitle}</h3>
              <p className="muted">{t.earlyText}</p>
              {!early.sent ? (
                <div className="input-row">
                  <input
                    data-testid="early-input"
                    value={early.value}
                    placeholder={t.enterAnswer}
                    onChange={(e) => setEarly({ ...early, value: e.target.value })}
                  />
                  <button
                    className="btn"
                    disabled={!early.value.trim()}
                    onClick={() => setEarly({ ...early, sent: true })}
                    data-testid="early-submit"
                  >
                    {t.earlySubmit}
                  </button>
                </div>
              ) : (
                <p className="feedback err" data-testid="early-result">
                  {t.earlyResult}
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function TopBar({ t, title, onExit }: { t: Dict; title: string; onExit: () => void }) {
  return (
    <div className="topbar">
      <button className="link back" onClick={onExit}>
        ← {t.back}
      </button>
      <h1>{title}</h1>
    </div>
  );
}

function ContextView({
  segments,
  active,
  selected,
  proved,
  onToggle,
}: {
  segments: ReturnType<typeof segmentContext>;
  active: boolean;
  selected: Set<number>;
  proved: (id: number | null) => boolean;
  onToggle: (id: number) => void;
}) {
  return (
    <p className={`context-text ${active ? "selecting" : ""}`} data-testid="context">
      {segments.map((s, i) => {
        if (s.id === null) return <span key={i}>{s.text}</span>;
        const id = s.id;
        if (active) {
          return (
            <span
              key={i}
              role="button"
              tabIndex={0}
              aria-pressed={selected.has(id)}
              className={`frag ${selected.has(id) ? "on" : ""}`}
              onClick={() => onToggle(id)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onToggle(id))}
            >
              {s.text}
            </span>
          );
        }
        return (
          <span key={i} className={proved(id) ? "frag proved" : undefined}>
            {s.text}
          </span>
        );
      })}
    </p>
  );
}
