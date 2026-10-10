import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  Sun,
  Library as LibraryIcon,
  Mic,
  ChartNoAxesColumn,
  Settings as SettingsIcon,
  NotebookPen,
  ArrowUpRight,
  Leaf,
} from "lucide-react";
import { useLearning } from "./storage/useLearning";
import { lessons } from "./shared/content";
import type { Mode, Rating, Skill } from "./shared/schema";
import { now, uid } from "./shared/schema";
import { Player } from "./features/Player";
import { Practice } from "./features/Practice";
import { Library } from "./features/Library";
import { Speaking } from "./features/Speaking";
import { Settings } from "./features/Settings";
import { dueQueue, schedule } from "./features/schedule";
import { removeMistake } from "./features/records";
const nav = [
  ["today", "Today", Sun],
  ["lessons", "Lessons", BookOpen],
  ["library", "Chunks", LibraryIcon],
  ["speaking", "Speaking", Mic],
  ["mistakes", "Mistakes", NotebookPen],
  ["progress", "Progress", ChartNoAxesColumn],
  ["settings", "Settings", SettingsIcon],
] as const;
export default function App() {
  const {
    state,
    ref,
    update,
    ready,
    status,
    flush,
    storageError,
    setStorageError,
  } = useLearning();
  const [page, setPage] = useState(
    () => location.hash.slice(1).split("/")[0] || "today",
  );
  const [lessonId, setLessonId] = useState(lessons[0].id);
  const [selected, setSelected] = useState<string[]>([]);
  const [practiceMode, setPracticeMode] = useState<Mode>();
  const [audioAvailable, setAudioAvailable] = useState(false);
  const [mistakeSearch, setMistakeSearch] = useState("");
  const [mistakeCategory, setMistakeCategory] = useState("");
  const [todayAnswer, setTodayAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [todayMessage, setTodayMessage] = useState("");
  const [manualSkill, setManualSkill] = useState<Skill>("recognition");
  const modeChanged = useCallback(
    (m: Mode | undefined) => setPracticeMode(m),
    [],
  );
  useEffect(() => {
    if (ready) {
      const hash = location.hash.slice(1).split("/")[1];
      const recent = hash || ref.current.recentLessonId;
      if (recent && lessons.some((l) => l.id === recent)) setLessonId(recent);
    }
  }, [ready, ref]);
  useEffect(() => {
    const changed = () => {
      const [p, id] = location.hash.slice(1).split("/");
      setPage(p || "today");
      if (lessons.some((l) => l.id === id)) {
        setLessonId(id);
        setSelected([]);
      }
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  const lesson = lessons.find((l) => l.id === lessonId) || lessons[0];
  const queue = dueQueue(state.mastery);
  const queueCard = queue[0];
  const queueChunk = state.chunks.find((c) => c.id === queueCard?.chunkId);
  function navigate(p: string) {
    void flush();
    location.hash = `${p}${p === "lesson" ? "/" + lessonId : ""}`;
    setPage(p);
  }
  function openLesson(id: string) {
    void flush();
    setLessonId(id);
    setSelected([]);
    setPracticeMode(undefined);
    update((s) => ({ ...s, recentLessonId: id }));
    location.hash = `lesson/${id}`;
    setPage("lesson");
  }
  function rate(
    chunkId: string,
    skill: Skill,
    rating: Rating,
    response = todayAnswer,
  ) {
    if (!response.trim()) {
      setTodayMessage(
        "Attempt a meaning, sentence or spoken reflection before rating.",
      );
      return;
    }
    update((s) => ({
      ...s,
      mastery: [
        ...s.mastery.filter(
          (m) => !(m.chunkId === chunkId && m.skill === skill),
        ),
        schedule(
          chunkId,
          skill,
          rating,
          s.mastery.find((m) => m.chunkId === chunkId && m.skill === skill),
        ),
      ],
      attempts: [
        ...s.attempts,
        {
          id: uid(),
          exerciseId: `review:${chunkId}:${skill}`,
          createdAt: now(),
          responseText: response,
          rating,
          skill,
        },
      ],
    }));
    setRevealed(false);
    setTodayAnswer("");
    setTodayMessage("Self-rating saved for this skill only.");
  }
  if (!ready)
    return <div className="loading">Opening your private learning space…</div>;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <a className="brand" href="#today">
          <span className="brand-symbol">
            <Leaf size={24} />
          </span>
          <span>
            NCE<span className="brand-sub">LEARNING LAB</span>
          </span>
        </a>
        <p className="sidebar-note">
          Small practice.
          <br />
          Lasting expression.
        </p>
        <nav aria-label="Main navigation">
          {nav.map(([key, label, Icon]) => (
            <a
              key={key}
              href={`#${key}`}
              className={
                page === key || (key === "lessons" && page === "lesson")
                  ? "nav-active"
                  : ""
              }
              onClick={() => void flush()}
            >
              <Icon size={19} />
              <span>{label}</span>
              {key === "today" && queue.length > 0 && (
                <span className="nav-count">{queue.length}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="status-dot" /> Local-first learning
          <p>Your words stay yours.</p>
        </div>
      </aside>
      <div className="content-shell">
        <header className="topbar">
          <span>YOUR PERSONAL ENGLISH STUDIO</span>
          <span className="local-status" role="status">
            <span
              className={`status-dot ${status === "Save failed" ? "failed" : ""}`}
            />
            {status}
          </span>
        </header>
        <main id="main" tabIndex={-1}>
          {storageError && (
            <div className="notice error" role="alert">
              {storageError}
              <button onClick={() => navigate("settings")}>
                Backup / recovery
              </button>
            </div>
          )}
          {page === "today" && (
            <>
              <div className="page-heading">
                <span className="eyebrow">ONE SMALL STEP, EVERY DAY</span>
                <h1>
                  Make English
                  <br />
                  <em>part of your voice.</em>
                </h1>
                <p>Listen closely. Write freely. Return to what matters.</p>
              </div>
              <div className="today-grid">
                <section className="hero-card">
                  <div>
                    <span className="eyebrow">
                      CONTINUE YOUR JOURNEY · BOOK 02
                    </span>
                    <h2>{lesson.title}</h2>
                    <p>{lesson.summary}</p>
                    <button
                      className="light-button"
                      onClick={() => openLesson(lessonId)}
                    >
                      Open Lesson {lesson.number}
                      <ArrowUpRight size={18} />
                    </button>
                  </div>
                  <span className="hero-number">
                    {String(lesson.number).padStart(2, "0")}
                  </span>
                </section>
                <section className="panel review-summary">
                  <span className="eyebrow">READY FOR RECALL</span>
                  <strong className="big-number">
                    {queue.length.toString().padStart(2, "0")}
                  </strong>
                  <p>skill cards due today</p>
                  <span className="small">
                    Recognition · Writing · Speaking
                  </span>
                </section>
              </div>
              <div className="stats-row">
                <div>
                  <strong>{state.chunks.length}</strong>
                  <span>Expressions accepted</span>
                </div>
                <div>
                  <strong>{state.attempts.length}</strong>
                  <span>Active attempts</span>
                </div>
                <div>
                  <strong>
                    {
                      state.sessions.filter((s) => s.status === "completed")
                        .length
                    }
                  </strong>
                  <span>Writing sessions completed</span>
                </div>
              </div>
              <section className="panel">
                <span className="eyebrow">RETRIEVE BEFORE YOU REVEAL</span>
                <h2>Today’s review</h2>
                {queueCard && queueChunk ? (
                  <>
                    <p className="badge">{queueCard.skill}</p>
                    <h3>{queueChunk.canonical}</h3>
                    <p>
                      {queueCard.skill === "recognition"
                        ? "Explain the meaning in your own words."
                        : queueCard.skill === "writing"
                          ? "Write an original sentence using this expression."
                          : "Say a short response aloud, then note how it went."}
                    </p>
                    <textarea
                      aria-label="Review response"
                      value={todayAnswer}
                      onChange={(e) => setTodayAnswer(e.target.value)}
                    />
                    <button onClick={() => setRevealed(true)}>
                      Reveal explanation
                    </button>
                    {revealed && <p>{queueChunk.definitionEn}</p>}
                    <div className="button-row">
                      {(["again", "hard", "good", "easy"] as const).map((r) => (
                        <button
                          key={r}
                          disabled={!revealed}
                          onClick={() =>
                            rate(queueChunk.id, queueCard.skill, r)
                          }
                        >
                          {r[0].toUpperCase() + r.slice(1)}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="muted">
                    Nothing due yet. Accept a chunk, complete a practice, and
                    give your own skill rating to begin.
                  </p>
                )}
                {todayMessage && <p className="notice">{todayMessage}</p>}
              </section>
            </>
          )}
          {page === "lessons" && (
            <>
              <div className="page-heading">
                <span className="eyebrow">BOOK 02 · PRACTICE & PROGRESS</span>
                <h1>
                  Five lessons.
                  <br />
                  <em>One growing voice.</em>
                </h1>
                <p>Your own audio, thoughtful practice, original notes.</p>
              </div>
              <div className="lesson-grid">
                {lessons.map((l) => (
                  <button
                    className="lesson-card"
                    key={l.id}
                    onClick={() => openLesson(l.id)}
                  >
                    <span className="lesson-number">
                      {String(l.number).padStart(2, "0")}
                    </span>
                    <span className="eyebrow">LESSON {l.number}</span>
                    <h2>{l.title}</h2>
                    <p>{l.summary}</p>
                    <div className="lesson-card-footer">
                      <span>
                        {state.imports.some(
                          (im) => im.lessonId === l.id && im.segments.length,
                        )
                          ? "Transcript imported"
                          : "Bring your MP3 + LRC"}
                      </span>
                      <ArrowUpRight size={20} />
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
          {page === "lesson" && (
            <>
              <div className="breadcrumb">
                <a href="#lessons">Book 02</a>
                <span>/</span>Lesson {lesson.number}
              </div>
              <div className="lesson-heading">
                <div>
                  <span className="eyebrow">
                    LESSON {String(lesson.number).padStart(2, "0")} · LISTEN →
                    WRITE → REFLECT
                  </span>
                  <h1>{lesson.title}</h1>
                  <p>{lesson.summary}</p>
                </div>
                <select
                  aria-label="Choose lesson"
                  value={lessonId}
                  onChange={(e) => openLesson(e.target.value)}
                >
                  {lessons.map((l) => (
                    <option key={l.id} value={l.id}>
                      Lesson {l.number} · {l.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="lesson-workspace">
                <Player
                  key={lessonId}
                  lessonId={lessonId}
                  data={state.imports.find((im) => im.lessonId === lessonId)}
                  settings={state.settings}
                  update={update}
                  selected={selected}
                  onSelect={setSelected}
                  memoryLocked={practiceMode === "memory_recall"}
                  onAudioAvailable={setAudioAvailable}
                />
                <Practice
                  key={`practice-${lessonId}`}
                  lessonId={lessonId}
                  state={state}
                  stateRef={ref}
                  update={update}
                  selected={selected}
                  onMode={modeChanged}
                  save={flush}
                  saveStatus={status}
                  canListen={audioAvailable}
                />
              </div>
              <Library
                state={state}
                update={update}
                lessonId={lessonId}
                selected={selected}
              />
            </>
          )}
          {page === "library" && (
            <>
              <div className="page-heading">
                <span className="eyebrow">
                  BUILD CONNECTIONS ACROSS LESSONS
                </span>
                <h1>
                  Expressions
                  <br />
                  <em>you can use.</em>
                </h1>
              </div>
              <Library state={state} update={update} />
            </>
          )}
          {page === "speaking" && (
            <>
              <div className="page-heading">
                <span className="eyebrow">FROM RECOGNITION TO REAL SPEECH</span>
                <h1>
                  Find your
                  <br />
                  <em>speaking rhythm.</em>
                </h1>
                <select
                  aria-label="Speaking lesson"
                  value={lessonId}
                  onChange={(e) => setLessonId(e.target.value)}
                >
                  {lessons.map((l) => (
                    <option key={l.id} value={l.id}>
                      Lesson {l.number} · {l.title}
                    </option>
                  ))}
                </select>
              </div>
              <Speaking
                key={lessonId}
                state={state}
                update={update}
                lessonId={lessonId}
              />
            </>
          )}
          {page === "mistakes" && (
            <>
              <div className="page-heading">
                <span className="eyebrow">A RECORD OF YOUR NEXT STEPS</span>
                <h1>
                  Learn from
                  <br />
                  <em>what was difficult.</em>
                </h1>
                <p>
                  Saved by you. A text difference is not automatically a
                  language error.
                </p>
              </div>
              <section className="panel">
                <div className="filters">
                  <input
                    aria-label="Search mistakes"
                    placeholder="Search text, explanation or chunk…"
                    value={mistakeSearch}
                    onChange={(e) => setMistakeSearch(e.target.value)}
                  />
                  <select
                    aria-label="Filter mistake category"
                    value={mistakeCategory}
                    onChange={(e) => setMistakeCategory(e.target.value)}
                  >
                    <option value="">All categories</option>
                    {[
                      "grammar",
                      "collocation",
                      "meaning",
                      "word_order",
                      "fluency",
                      "pronunciation",
                      "other",
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                {state.mistakes
                  .filter(
                    (m) =>
                      (!mistakeCategory || m.category === mistakeCategory) &&
                      (
                        m.explanation +
                        " " +
                        m.learnerText +
                        " " +
                        state.chunks.find((c) => c.id === m.chunkId)?.canonical
                      )
                        .toLowerCase()
                        .includes(mistakeSearch.toLowerCase()),
                  )
                  .map((m) => (
                    <article className="mistake-card" key={m.id}>
                      <span className="small muted">
                        {new Date(m.createdAt).toLocaleString()} ·{" "}
                        {m.resolved ? "resolved" : "to revisit"}
                      </span>
                      <label>
                        Category
                        <select
                          value={m.category}
                          onChange={(e) =>
                            update((s) => ({
                              ...s,
                              mistakes: s.mistakes.map((x) =>
                                x.id === m.id
                                  ? {
                                      ...x,
                                      category: e.target
                                        .value as typeof m.category,
                                    }
                                  : x,
                              ),
                            }))
                          }
                        >
                          {[
                            "grammar",
                            "collocation",
                            "meaning",
                            "word_order",
                            "fluency",
                            "pronunciation",
                            "other",
                          ].map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </label>
                      <pre>{m.learnerText}</pre>
                      <label>
                        Explanation
                        <textarea
                          value={m.explanation}
                          onChange={(e) =>
                            update((s) => ({
                              ...s,
                              mistakes: s.mistakes.map((x) =>
                                x.id === m.id
                                  ? { ...x, explanation: e.target.value }
                                  : x,
                              ),
                            }))
                          }
                        />
                      </label>
                      <label>
                        Corrected example
                        <input
                          value={m.correctedExample || ""}
                          onChange={(e) =>
                            update((s) => ({
                              ...s,
                              mistakes: s.mistakes.map((x) =>
                                x.id === m.id
                                  ? { ...x, correctedExample: e.target.value }
                                  : x,
                              ),
                            }))
                          }
                        />
                      </label>
                      <label>
                        Related chunk
                        <select
                          value={m.chunkId || ""}
                          onChange={(e) =>
                            update((s) => ({
                              ...s,
                              mistakes: s.mistakes.map((x) =>
                                x.id === m.id
                                  ? {
                                      ...x,
                                      chunkId: e.target.value || undefined,
                                    }
                                  : x,
                              ),
                            }))
                          }
                        >
                          <option value="">None</option>
                          {state.chunks.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.canonical}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="button-row">
                        <button
                          onClick={() =>
                            update((s) => ({
                              ...s,
                              mistakes: s.mistakes.map((x) =>
                                x.id === m.id
                                  ? { ...x, resolved: !x.resolved }
                                  : x,
                              ),
                            }))
                          }
                        >
                          {m.resolved ? "Reopen" : "Mark resolved"}
                        </button>
                        <button
                          onClick={() => update((s) => removeMistake(s, m.id))}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                {!state.mistakes.length && (
                  <div className="empty-state">
                    After Review, save a difference or a supported issue that
                    you want to revisit.
                  </div>
                )}
              </section>
            </>
          )}
          {page === "progress" && (
            <>
              <div className="page-heading">
                <span className="eyebrow">THREE SKILLS, THREE PATHS</span>
                <h1>
                  Recognition.
                  <br />
                  <em>Writing. Speaking.</em>
                </h1>
                <p>
                  Self-ratings are learning records, not AI proficiency scores.
                </p>
              </div>
              <section className="panel progress-table">
                <table>
                  <thead>
                    <tr>
                      <th>Chunk</th>
                      <th>Recognition</th>
                      <th>Writing</th>
                      <th>Speaking</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.chunks.map((c) => (
                      <tr key={c.id}>
                        <th>{c.canonical}</th>
                        {(["recognition", "writing", "speaking"] as const).map(
                          (skill) => {
                            const m = state.mastery.find(
                              (x) => x.chunkId === c.id && x.skill === skill,
                            );
                            return (
                              <td key={skill}>
                                {m ? (
                                  <>
                                    <strong>{m.lastRating}</strong>
                                    <br />
                                    <span className="small">
                                      {m.repetitions} successful reviews
                                      <br />
                                      Due{" "}
                                      {m.dueAt
                                        ? new Date(m.dueAt).toLocaleDateString()
                                        : "unscheduled"}
                                    </span>
                                  </>
                                ) : (
                                  "Unrated"
                                )}
                              </td>
                            );
                          },
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!state.chunks.length && (
                  <p className="muted">Accept chunks to begin.</p>
                )}
              </section>
              <section className="panel">
                <h2>Manual skill practice</h2>
                <p className="muted">
                  For an unrated or not-yet-due expression, attempt a recall
                  before self-rating.
                </p>
                <label>
                  Skill
                  <select
                    value={manualSkill}
                    onChange={(e) => setManualSkill(e.target.value as Skill)}
                  >
                    {["recognition", "writing", "speaking"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <textarea
                  aria-label="Manual skill response"
                  value={todayAnswer}
                  onChange={(e) => setTodayAnswer(e.target.value)}
                  placeholder="Explain, write a new example, or reflect on your spoken response."
                />
                {state.chunks.map((c) => (
                  <div className="manual-rating" key={c.id}>
                    <strong>{c.canonical}</strong>
                    <div className="button-row">
                      {(["again", "hard", "good", "easy"] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => rate(c.id, manualSkill, r)}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {todayMessage && <p className="notice">{todayMessage}</p>}
              </section>
            </>
          )}
          {page === "settings" && (
            <>
              <div className="page-heading">
                <span className="eyebrow">KEEP YOUR LEARNING CLOSE</span>
                <h1>
                  Your private
                  <br />
                  <em>learning archive.</em>
                </h1>
              </div>
              <Settings
                state={state}
                update={update}
                flush={flush}
                onStorageRecover={() => setStorageError("")}
              />
            </>
          )}
          {![
            "today",
            "lessons",
            "lesson",
            "library",
            "speaking",
            "mistakes",
            "progress",
            "settings",
          ].includes(page) && (
            <section className="panel">
              <h1>Page not found</h1>
              <a href="#today">Return to Today</a>
            </section>
          )}
        </main>
        <footer className="app-footer">
          <span>NCE LEARNING LAB</span>
          <p>Practice deliberately. Let your voice grow.</p>
          <a
            href="https://github.com/werneryang/nce-learning-lab"
            target="_blank"
            rel="noreferrer"
          >
            Project & sources ↗
          </a>
        </footer>
      </div>
    </div>
  );
}
