import { useState } from "react";
import type { Chunk, State } from "../shared/schema";
import { uid, now } from "../shared/schema";
import { candidates, links, examples, allLessons } from "../shared/content";
import { acceptChunk, mergeChunks, chunkKey } from "./chunks";
type Props = {
  state: State;
  update: (fn: (s: State) => State) => void;
  lessonId?: string;
  selected?: string[];
};
export function Library({ state, update, lessonId, selected = [] }: Props) {
  const lessons = allLessons(state);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [editing, setEditing] = useState<Chunk>();
  const [mergeTarget, setMergeTarget] = useState("");
  const [message, setMessage] = useState("");
  const proposalIds = links
    .filter((l) => !lessonId || l.lessonId === lessonId)
    .map((l) => l.chunkId);
  const pending = candidates.filter(
    (c) =>
      proposalIds.includes(c.id) &&
      !state.rejectedCandidates.includes(c.id) &&
      (!state.chunks.some((x) => chunkKey(x) === chunkKey(c)) ||
        (!!lessonId &&
          !state.links.some(
            (l) =>
              l.lessonId === lessonId &&
              l.chunkId ===
                state.chunks.find((x) => chunkKey(x) === chunkKey(c))?.id,
          ))),
  );
  const saved = state.chunks.filter(
    (c) =>
      (!lessonId ||
        state.links.some(
          (l) => l.chunkId === c.id && l.lessonId === lessonId,
        )) &&
      (!category || c.category === category) &&
      (c.canonical + " " + c.definitionEn + " " + c.explanationZh)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  function accept(c: Chunk) {
    update((s) =>
      acceptChunk(
        s,
        c,
        lessonId ||
          links.find((l) => l.chunkId === c.id)?.lessonId ||
          lessons[0].id,
        selected,
        examples.find((x) => x.chunkId === c.id)?.text,
      ),
    );
    setMessage("Accepted locally. Skill mastery remains unchanged.");
  }
  function saveEdit() {
    if (!editing) return;
    try {
      if (
        !editing.canonical.trim() ||
        !editing.senseKey.trim() ||
        !editing.definitionEn.trim()
      )
        throw new Error("Expression, sense and definition are required.");
      update((s) => {
        if (
          s.chunks.some(
            (c) => c.id !== editing.id && chunkKey(c) === chunkKey(editing),
          )
        )
          throw new Error(
            "This expression and sense already exists. Use Merge instead.",
          );
        return {
          ...s,
          chunks: s.chunks.some((c) => c.id === editing.id)
            ? s.chunks.map((c) =>
                c.id === editing.id ? { ...editing, updatedAt: now() } : c,
              )
            : [...s.chunks, { ...editing, updatedAt: now() }],
          links:
            lessonId &&
            !s.links.some(
              (l) => l.chunkId === editing.id && l.lessonId === lessonId,
            )
              ? [
                  ...s.links,
                  {
                    lessonId,
                    chunkId: editing.id,
                    segmentIds: selected,
                    importance: 2,
                  },
                ]
              : s.links,
        };
      });
      setEditing(undefined);
    } catch (e) {
      setMessage(String(e));
    }
  }
  return (
    <section className="panel library">
      <div className="section-heading">
        <span className="eyebrow">CHUNKS, NOT ISOLATED WORDS</span>
        <span className="badge">{saved.length} accepted</span>
      </div>
      <h2>
        {lessonId ? "Choose what stays with you" : "Your expression library"}
      </h2>
      <p className="muted">
        Original notes and examples. Each expression keeps a distinct meaning;
        you decide what to learn.
      </p>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {pending.length > 0 && (
        <details open={!!lessonId}>
          <summary>{pending.length} candidates to review</summary>
          <div className="chunk-grid">
            {pending.map((c) => (
              <article className="chunk-card candidate" key={c.id}>
                <span className="eyebrow">
                  {c.category.replaceAll("_", " ")}
                </span>
                <h3>{c.canonical}</h3>
                <p>{c.definitionEn}</p>
                {state.settings.chinese && <p>{c.explanationZh}</p>}
                <p className="example">
                  {examples.find((x) => x.chunkId === c.id)?.text}
                </p>
                <p className="small">
                  Sense: {c.senseKey} · {c.register}
                </p>
                <div className="button-row">
                  <button className="primary" onClick={() => accept(c)}>
                    {state.chunks.some((x) => chunkKey(x) === chunkKey(c))
                      ? "Link this lesson"
                      : "Accept"}
                  </button>
                  <button onClick={() => setEditing(structuredClone(c))}>
                    Edit first
                  </button>
                  <button
                    onClick={() =>
                      update((s) => ({
                        ...s,
                        rejectedCandidates: [...s.rejectedCandidates, c.id],
                      }))
                    }
                  >
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        </details>
      )}
      <div className="filters">
        <input
          aria-label="Search chunks"
          placeholder="Search expressions or meanings…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Chunk category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {[
            "idiom",
            "collocation",
            "phrasal_verb",
            "sentence_pattern",
            "discourse_marker",
            "other",
          ].map((c) => (
            <option key={c} value={c}>
              {c.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <button
          onClick={() =>
            setEditing({
              id: `user-${uid()}`,
              canonical: "",
              senseKey: "",
              category: "collocation",
              definitionEn: "",
              register: "neutral",
              functionTags: [],
              createdAt: now(),
              updatedAt: now(),
            })
          }
        >
          Add your own
        </button>
      </div>
      {editing && (
        <div className="edit-card">
          <h3>Edit expression</h3>
          <label>
            Expression
            <input
              value={editing.canonical}
              maxLength={200}
              onChange={(e) =>
                setEditing({ ...editing, canonical: e.target.value })
              }
            />
          </label>
          <label>
            Sense key
            <input
              value={editing.senseKey}
              maxLength={120}
              onChange={(e) =>
                setEditing({ ...editing, senseKey: e.target.value })
              }
            />
          </label>
          <label>
            Definition
            <textarea
              value={editing.definitionEn}
              onChange={(e) =>
                setEditing({ ...editing, definitionEn: e.target.value })
              }
            />
          </label>
          <label>
            Category
            <select
              value={editing.category}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  category: e.target.value as Chunk["category"],
                })
              }
            >
              {[
                "idiom",
                "collocation",
                "phrasal_verb",
                "sentence_pattern",
                "discourse_marker",
                "other",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <div className="button-row">
            <button className="primary" onClick={saveEdit}>
              Save expression
            </button>
            <button onClick={() => setEditing(undefined)}>Cancel</button>
          </div>
          {state.chunks.some((c) => c.id === editing.id) && (
            <div className="button-row">
              <select
                aria-label="Merge target"
                value={mergeTarget}
                onChange={(e) => setMergeTarget(e.target.value)}
              >
                <option value="">Merge into existing same-sense card</option>
                {state.chunks
                  .filter(
                    (c) =>
                      c.id !== editing.id && c.senseKey === editing.senseKey,
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.canonical}
                    </option>
                  ))}
              </select>
              <button
                disabled={!mergeTarget}
                onClick={() => {
                  try {
                    update((s) => mergeChunks(s, editing.id, mergeTarget));
                    setEditing(undefined);
                    setMergeTarget("");
                    setMessage("Merged. Existing target mastery is retained.");
                  } catch (e) {
                    setMessage(String(e));
                  }
                }}
              >
                Merge
              </button>
            </div>
          )}
        </div>
      )}
      <div className="chunk-grid">
        {saved.map((c) => (
          <article className="chunk-card" key={c.id}>
            <span className="eyebrow">{c.category.replaceAll("_", " ")}</span>
            <h3>{c.canonical}</h3>
            <p>{c.definitionEn}</p>
            {state.settings.chinese && <p>{c.explanationZh}</p>}
            {state.examples
              .filter((x) => x.chunkId === c.id)
              .map((x) => (
                <p className="example" key={x.id}>
                  {x.text}
                </p>
              ))}
            <p className="small">
              {c.senseKey} · {c.register}
            </p>
            <div className="lesson-tags">
              {state.links
                .filter((l) => l.chunkId === c.id)
                .map((l) => (
                  <span className="badge" key={l.lessonId}>
                    Lesson{" "}
                    {lessons.find((x) => x.id === l.lessonId)?.number ||
                      l.lessonId}
                  </span>
                ))}
            </div>
            <button onClick={() => setEditing(structuredClone(c))}>
              Edit / merge
            </button>
          </article>
        ))}
      </div>
      {!saved.length && (
        <div className="empty-state">
          Accept a candidate or add your own expression. Each skill will develop
          on its own schedule.
        </div>
      )}
      {state.rejectedCandidates.length > 0 && (
        <button
          className="text-button"
          onClick={() => update((s) => ({ ...s, rejectedCandidates: [] }))}
        >
          Restore rejected candidates
        </button>
      )}
    </section>
  );
}
