import { useEffect, useState } from "react";
import type { Lang, Subject } from "./types";
import { DICT } from "./i18n";
import { TASKS, getTask } from "./tasks";
import { loadLang, loadProgress, saveLang } from "./storage";
import { TaskPlayer } from "./components/TaskPlayer";

function useOnline() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function App() {
  const [lang, setLang] = useState<Lang>(loadLang);
  const [subject, setSubject] = useState<Subject>("math");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState(loadProgress);
  const online = useOnline();
  const t = DICT[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
    saveLang(lang);
  }, [lang]);

  const task = taskId ? getTask(taskId) : undefined;
  const list = TASKS.filter((x) => x.subject === subject);

  function exit() {
    setTaskId(null);
    setProgress(loadProgress());
    window.scrollTo(0, 0);
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand" onClick={exit} role="link">
          <span className="logo">Дәлел</span>
          <span className="tagline">{t.appTagline}</span>
        </div>
        <div className="lang" role="group" aria-label="Тіл / Язык">
          <button aria-pressed={lang === "kk"} onClick={() => setLang("kk")}>
            ҚАЗ
          </button>
          <button aria-pressed={lang === "ru"} onClick={() => setLang("ru")}>
            РУС
          </button>
        </div>
      </header>
      <div className={`net ${online ? "on" : "off"}`} data-testid="net">
        {online ? t.online : t.offline}
      </div>

      <main>
        {task ? (
          <TaskPlayer
            key={`${task.id}-${lang}`}
            task={task}
            lang={lang}
            t={t}
            online={online}
            hasNext={TASKS.indexOf(task) < TASKS.length - 1}
            onExit={exit}
            onNext={() => {
              const next = TASKS[TASKS.indexOf(task) + 1];
              setSubject(next.subject);
              setTaskId(next.id);
              setProgress(loadProgress());
              window.scrollTo(0, 0);
            }}
          />
        ) : (
          <div className="screen">
            <div className="tabs" role="tablist">
              {(["math", "reading"] as Subject[]).map((s) => (
                <button key={s} role="tab" aria-selected={subject === s} onClick={() => setSubject(s)}>
                  {s === "math" ? t.math : t.reading}
                </button>
              ))}
            </div>
            <ul className="task-list">
              {list.map((x) => (
                <li key={x.id}>
                  <button
                    className="task-card"
                    data-testid={`task-${x.id}`}
                    onClick={() => {
                      setTaskId(x.id);
                      window.scrollTo(0, 0);
                    }}
                  >
                    <span className="task-title">{x[lang].title}</span>
                    <span className="task-meta">
                      {t.grade(x.grade)} · {t.skill[x.skill]}
                    </span>
                    {progress[x.id]?.solved && <span className="solved">✓ {t.solved}</span>}
                  </button>
                </li>
              ))}
            </ul>
            <p className="footer-note">{t.footer}</p>
          </div>
        )}
      </main>
    </div>
  );
}
