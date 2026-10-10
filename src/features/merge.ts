import { StateSchema } from "../shared/schema";
import type { LocalImport, State } from "../shared/schema";
import { chunkKey } from "./chunks";
export type MergeSummary = {
  sessionsAdded: number;
  sessionsUpdated: number;
  chunksAdded: number;
  mistakesAdded: number;
  attemptsAdded: number;
  lessonsAdded: number;
};
export const emptySummary = (): MergeSummary => ({
  sessionsAdded: 0,
  sessionsUpdated: 0,
  chunksAdded: 0,
  mistakesAdded: 0,
  attemptsAdded: 0,
  lessonsAdded: 0,
});
/**
 * Merges records from another device's backup into this device's state.
 * Records are matched by ID (or natural key); the newer edit of a record wins.
 * This device keeps its own preferences and local audio. Deletions are not
 * tracked, so a record deleted here returns if the other backup still has it.
 */
export function mergeStates(local: State, incoming: State) {
  const summary = emptySummary();
  // Two devices can create the same user-defined chunk under different IDs.
  const remap = new Map<string, string>();
  for (const c of incoming.chunks) {
    const twin = local.chunks.find((x) => chunkKey(x) === chunkKey(c));
    if (twin && twin.id !== c.id) remap.set(c.id, twin.id);
  }
  const chunk = (id: string) => remap.get(id) ?? id;
  const other: State = {
    ...incoming,
    chunks: incoming.chunks.map((c) => ({ ...c, id: chunk(c.id) })),
    links: incoming.links.map((l) => ({ ...l, chunkId: chunk(l.chunkId) })),
    mastery: incoming.mastery.map((m) => ({ ...m, chunkId: chunk(m.chunkId) })),
    examples: incoming.examples.map((e) => ({
      ...e,
      chunkId: chunk(e.chunkId),
    })),
    mistakes: incoming.mistakes.map((m) =>
      m.chunkId ? { ...m, chunkId: chunk(m.chunkId) } : m,
    ),
    sessions: incoming.sessions.map((s) => ({
      ...s,
      targetChunkIds: s.targetChunkIds.map(chunk),
    })),
    turns: incoming.turns.map((t) => ({
      ...t,
      feedback: {
        ...t.feedback,
        issues: t.feedback.issues.map((i) =>
          i.relatedChunkIds
            ? { ...i, relatedChunkIds: i.relatedChunkIds.map(chunk) }
            : i,
        ),
      },
    })),
  };
  function byKey<T>(
    mine: T[],
    theirs: T[],
    key: (x: T) => string,
    pick: (mine: T, theirs: T) => T = (m) => m,
    onAdd?: () => void,
  ) {
    const out = new Map(mine.map((x) => [key(x), x]));
    for (const t of theirs) {
      const k = key(t);
      const m = out.get(k);
      if (m === undefined) {
        out.set(k, t);
        onAdd?.();
      } else out.set(k, pick(m, t));
    }
    return [...out.values()];
  }
  const newer = <T extends { updatedAt: string }>(m: T, t: T) =>
    t.updatedAt > m.updatedAt ? t : m;
  const merged: State = {
    ...local,
    sessions: byKey(
      local.sessions,
      other.sessions,
      (s) => s.id,
      (m, t) => {
        const pick = newer(m, t);
        if (pick !== m) summary.sessionsUpdated++;
        return pick;
      },
      () => summary.sessionsAdded++,
    ),
    turns: byKey(local.turns, other.turns, (t) => t.id),
    attempts: byKey(
      local.attempts,
      other.attempts,
      (a) => a.id,
      undefined,
      () => summary.attemptsAdded++,
    ),
    chunks: byKey(
      local.chunks,
      other.chunks,
      (c) => c.id,
      newer,
      () => summary.chunksAdded++,
    ),
    links: byKey(local.links, other.links, (l) => `${l.lessonId}:${l.chunkId}`),
    examples: dedupeExamples(
      byKey(local.examples, other.examples, (e) => e.id),
    ),
    mastery: byKey(
      local.mastery,
      other.mastery,
      (m) => `${m.chunkId}:${m.skill}`,
      (m, t) => ((t.lastReviewedAt ?? "") > (m.lastReviewedAt ?? "") ? t : m),
    ),
    mistakes: byKey(
      local.mistakes,
      other.mistakes,
      (m) => m.id,
      (m, t) => ({ ...m, resolved: m.resolved || t.resolved }),
      () => summary.mistakesAdded++,
    ),
    imports: byKey(
      local.imports,
      other.imports,
      (im) => im.lessonId,
      pickImport,
      () => summary.lessonsAdded++,
    ).map((im) => {
      // Local audio files exist only on the device that imported them.
      const mine = local.imports.find((x) => x.lessonId === im.lessonId);
      return {
        ...im,
        audioName: mine?.audioName,
        audioDuration: mine?.audioDuration,
        audioAccent: mine?.audioAccent ?? im.audioAccent,
      };
    }),
    rejectedCandidates: [
      ...new Set([...local.rejectedCandidates, ...other.rejectedCandidates]),
    ],
  };
  return { state: StateSchema.parse(merged), summary };
}
/** Prefers the transcript with more reviewed lines; ties keep this device's. */
function pickImport(mine: LocalImport, theirs: LocalImport) {
  const reviewed = (im: LocalImport) =>
    im.segments.filter((s) => s.reviewStatus !== "pending").length;
  return reviewed(theirs) > reviewed(mine) ? theirs : mine;
}
function dedupeExamples(examples: State["examples"]) {
  const seen = new Set<string>();
  return examples.filter((e) => {
    const k = `${e.chunkId}\n${e.text}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
export function addSummary(a: MergeSummary, b: MergeSummary): MergeSummary {
  return {
    sessionsAdded: a.sessionsAdded + b.sessionsAdded,
    sessionsUpdated: a.sessionsUpdated + b.sessionsUpdated,
    chunksAdded: a.chunksAdded + b.chunksAdded,
    mistakesAdded: a.mistakesAdded + b.mistakesAdded,
    attemptsAdded: a.attemptsAdded + b.attemptsAdded,
    lessonsAdded: a.lessonsAdded + b.lessonsAdded,
  };
}
