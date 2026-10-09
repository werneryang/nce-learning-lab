import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto";
import {
  parseLrc,
  confirmedBody,
  activeSegment,
  loopBounds,
} from "../src/features/lrc";
import { compareText } from "../src/features/diff";
import { schedule, dueQueue } from "../src/features/schedule";
import { LocalTutor, BackendTutor, manualPrompt } from "../src/features/tutor";
import {
  emptyState,
  StateSchema,
  FeedbackSchema,
  now,
} from "../src/shared/schema";
import type { Session } from "../src/shared/schema";
import { acceptChunk, mergeChunks } from "../src/features/chunks";
import { candidates, lessons } from "../src/shared/content";
import {
  exportBackup,
  readBackup,
  saveState,
  loadState,
  clearPrivateData,
  saveMedia,
  loadMedia,
} from "../src/storage/db";
const session = (draft = "I was about to leaving."): Session => ({
  id: "s1",
  lessonId: "NCE2-L001",
  mode: "memory_recall",
  scope: "sentence",
  selectedSegmentIds: [],
  targetChunkIds: [],
  userDraft: draft,
  draftVersion: 4,
  startedAt: now(),
  updatedAt: now(),
  status: "editing",
  hintCount: 0,
});
describe("LRC and playback boundaries", () => {
  it("parses metadata without making question or body decisions", () => {
    const x = parseLrc(
      "[ti:Original test]\n[00:00.10]Why did the visitor wait?\n[00:01.250]An original sentence.",
      "L",
      "S",
    );
    expect(x.metadata.ti).toBe("Original test");
    expect(x.segments.map((s) => s.role)).toEqual([
      "intro_question",
      "unreviewed",
    ]);
    expect(confirmedBody(x.segments)).toEqual([]);
    expect(x.segments[1].startMs).toBe(1250);
  });
  it("expands multiple timestamps and retains source lines", () => {
    const x = parseLrc("[00:02.10][00:03.234]你好 — original text", "L", "S");
    expect(x.segments.map((s) => s.startMs)).toEqual([2100, 3234]);
    expect(x.segments.every((s) => s.sourceLine === 1)).toBe(true);
  });
  it("warns for repeated and unsorted timestamps", () => {
    const x = parseLrc(
      "[00:02.00]One.\n[00:01.00]Two.\n[00:01.00]Three.",
      "L",
      "S",
    );
    expect(x.warnings.length).toBe(3);
    expect(x.segments.map((s) => s.sourceLine)).toEqual([2, 3, 1]);
  });
  it("rejects bad seconds and untimed text without crash", () => {
    expect(() => parseLrc("[00:99.00]Broken", "L", "S")).toThrow(
      "No timed text",
    );
    const x = parseLrc("Note\n[00:01.00]Original", "L", "S");
    expect(x.warnings).toHaveLength(1);
  });
  it("reports damaged encoding", () =>
    expect(() => parseLrc("[00:01.00]\uFFFD", "L", "S")).toThrow("encoding"));
  it("handles offset, fractions and CRLF", () => {
    const x = parseLrc("[offset:50]\r\n[01:02.1]Original.", "L", "S");
    expect(x.segments[0].startMs).toBe(62150);
  });
  it("finds active line and safe loop end", () => {
    const x = parseLrc("[00:01.00]One.\n[00:03.00]Two.", "L", "S").segments;
    expect(activeSegment(x, 500)).toBeUndefined();
    expect(activeSegment(x, 1800)?.text).toBe("One.");
    expect(loopBounds(x[0], 5)).toEqual([1, 2.96]);
    expect(loopBounds({ ...x[0], endMs: 1001 }, 5)).toBeUndefined();
    expect(loopBounds(x[1], 5)).toEqual([3, 4.96]);
  });
  it("keeps hostile text as data", () =>
    expect(
      parseLrc("[00:01.00]<img src=x onerror=alert(1)>", "L", "S").segments[0]
        .text,
    ).toContain("<img"));
});
describe("original fidelity", () => {
  it("matches with case and punctuation tolerance", () =>
    expect(compareText("We left.", "we left!").fidelity.exact).toBe(true));
  it("detects punctuation when selected", () =>
    expect(compareText("We left.", "We left!", false).differences[0].kind).toBe(
      "punctuation",
    ));
  it("detects missing", () =>
    expect(compareText("we went home", "we home").differences[0].kind).toBe(
      "missing",
    ));
  it("detects extras", () =>
    expect(
      compareText("we went home", "we quickly went home").differences[0].kind,
    ).toBe("extra"));
  it("detects substitution", () =>
    expect(compareText("a red door", "a blue door").differences[0].kind).toBe(
      "substitution",
    ));
  it("classifies reordered tokens without changing edit distance", () => {
    const x = compareText("the bright red door", "the red bright door");
    expect(x.differences.every((d) => d.kind === "order")).toBe(true);
    expect(x.fidelity.errors).toBe(2);
  });
  it("does not diagnose alternatives as grammar errors", async () => {
    const s = session("ignored me");
    const result = await new LocalTutor().request({
      session: s,
      reference: "did not pay any attention",
      ignorePunctuation: true,
      action: "review",
    });
    expect(result.feedback.issues).toHaveLength(0);
    expect(result.feedback.overallMessage).toContain(
      "Different wording may be valid",
    );
  });
  it("WER denominator is reference words and can exceed 100%", () => {
    const x = compareText("hello", "one two three four");
    expect(x.fidelity.referenceWords).toBe(1);
    expect(x.fidelity.wer).toBe(4);
  });
  it("handles Unicode apostrophes", () =>
    expect(compareText("It’s fine", "it's fine").fidelity.exact).toBe(true));
  it("bounds large inputs", () =>
    expect(() => compareText("word ".repeat(2001), "word")).toThrow("2,000"));
  it("compares 1,000-word drafts with bounded time", () => {
    const before = performance.now();
    const x = compareText("alpha ".repeat(1000), "beta ".repeat(1000));
    expect(x.fidelity.errors).toBe(1000);
    expect(performance.now() - before).toBeLessThan(1500);
  });
});
describe("tutor and explicit operations", () => {
  it("provides three graduated local hints", async () => {
    const adapter = new LocalTutor();
    const messages = [];
    for (const level of [1, 2, 3] as const) {
      const x = await adapter.request({
        session: session(),
        reference: "A reference sentence.",
        ignorePunctuation: true,
        action: "hint",
        level,
      });
      messages.push(x.feedback.overallMessage);
      expect(x.engine).toBe("local_rules");
      expect(x.feedback.overallMessage).not.toContain("A reference sentence.");
    }
    expect(new Set(messages).size).toBe(3);
  });
  it("uses limited supported rules and no word-match score for rewriting", async () => {
    const x = await new LocalTutor().request({
      session: {
        ...session("A perfectly different account."),
        mode: "guided_rewriting",
      },
      reference: "Original wording.",
      ignorePunctuation: true,
      action: "review",
    });
    expect(x.feedback.overallMessage).toContain("not scored");
    expect(x.feedback.issues).toHaveLength(0);
  });
  it("requires HTTPS for remote adapter", () =>
    expect(() => new BackendTutor("http://example.com")).toThrow("HTTPS"));
  it("honors cancellation", async () => {
    const c = new AbortController();
    c.abort();
    await expect(
      new LocalTutor().request(
        {
          session: session(),
          reference: "",
          ignorePunctuation: true,
          action: "hint",
        },
        c.signal,
      ),
    ).rejects.toThrow("Cancelled");
  });
  it("validates remote feedback without executing HTML", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          mode: "memory_recall",
          overallMessage: "<script>alert(1)</script>",
          issues: [],
          strengths: [],
        }),
      ),
    );
    const x = await new BackendTutor("https://example.com").request({
      session: session(),
      reference: "reference",
      ignorePunctuation: true,
      action: "review",
    });
    expect(x.feedback.overallMessage).toContain("<script>");
    expect(fetcher).toHaveBeenCalledOnce();
    fetcher.mockRestore();
  });
  it("rejects malformed remote JSON feedback", () =>
    expect(() => FeedbackSchema.parse({ overallMessage: "ok" })).toThrow());
  it("manual sharing excludes reference by default", () => {
    expect(
      manualPrompt("memory_recall", "draft", "private reference", false),
    ).not.toContain("private reference");
    expect(
      manualPrompt("memory_recall", "draft", "private reference", true),
    ).toContain("private reference");
  });
});
describe("chunks and independent skill schedules", () => {
  it("links same sense across lessons without duplication or mastery reset", () => {
    const s = acceptChunk(emptyState(), candidates[0], "NCE2-L001");
    s.mastery = [schedule(candidates[0].id, "writing", "good")];
    const next = acceptChunk(s, candidates[0], "NCE2-L004");
    expect(next.chunks).toHaveLength(1);
    expect(next.links).toHaveLength(2);
    expect(next.mastery).toEqual(s.mastery);
  });
  it("keeps distinct senses separate", () => {
    let s = acceptChunk(emptyState(), candidates[0], "NCE2-L001");
    s = acceptChunk(
      s,
      { ...candidates[0], id: "different", senseKey: "different_sense" },
      "NCE2-L001",
    );
    expect(s.chunks).toHaveLength(2);
  });
  it("allows reviewed merge and preserves target mastery", () => {
    let s = acceptChunk(emptyState(), candidates[0], "NCE2-L001");
    s = acceptChunk(
      s,
      { ...candidates[0], id: "other", canonical: "become + adjective" },
      "NCE2-L004",
    );
    s.mastery = [schedule(candidates[0].id, "writing", "easy")];
    const next = mergeChunks(s, "other", candidates[0].id);
    expect(next.chunks).toHaveLength(1);
    expect(next.mastery).toEqual(s.mastery);
    expect(StateSchema.safeParse(next).success).toBe(true);
  });
  it("forbids accidental different-sense merge", () => {
    let s = acceptChunk(emptyState(), candidates[0], "NCE2-L001");
    s = acceptChunk(
      s,
      { ...candidates[0], id: "other", senseKey: "different_sense" },
      "NCE2-L004",
    );
    expect(() => mergeChunks(s, "other", candidates[0].id)).toThrow(
      "Different senses",
    );
  });
  it("Writing and Speaking remain independent", () => {
    const writing = schedule("c", "writing", "easy");
    const speaking = schedule("c", "speaking", "hard");
    expect(writing.intervalDays).toBe(2);
    expect(speaking.intervalDays).toBe(1);
    expect(writing.skill).not.toBe(speaking.skill);
  });
  it("good advances 1,3,7,14,30 days", () => {
    let previous;
    const intervals = [];
    for (let i = 0; i < 5; i++) {
      previous = schedule("c", "writing", "good", previous);
      intervals.push(previous.intervalDays);
    }
    expect(intervals).toEqual([1, 3, 7, 14, 30]);
  });
  it("again repeats soon and resets successful repetitions", () => {
    const at = new Date("2026-10-09T12:00:00Z");
    const x = schedule(
      "c",
      "writing",
      "again",
      schedule("c", "writing", "good"),
      at,
    );
    expect(x.repetitions).toBe(0);
    expect(x.dueAt).toBe("2026-10-09T12:10:00.000Z");
  });
  it("due queue excludes future cards", () => {
    const at = new Date("2026-10-09T12:00:00Z");
    const past = schedule(
      "c",
      "writing",
      "again",
      undefined,
      new Date("2026-10-08T12:00:00Z"),
    );
    const future = schedule("c", "speaking", "easy", undefined, at);
    expect(dueQueue([past, future], at)).toEqual([past]);
  });
});
describe("private storage and versioned backup", () => {
  beforeEach(async () => {
    await clearPrivateData();
  });
  it("persists state and media independently", async () => {
    const s = emptyState();
    s.sessions = [session("draft")];
    await saveState(s);
    await saveMedia("test:audio", new Blob(["private media"]));
    expect(await loadState()).toEqual(s);
    expect(await (await loadMedia("test:audio"))?.text()).toBe("private media");
  });
  it("backup round trip excludes MP3 while keeping private records", async () => {
    const s = acceptChunk(emptyState(), candidates[0], "NCE2-L001");
    s.sessions = [session()];
    s.attempts = [
      {
        id: "a",
        exerciseId: "e",
        practiceSessionId: "s1",
        createdAt: now(),
        responseText: "draft",
        skill: "writing",
      },
    ];
    s.mistakes = [
      {
        id: "m",
        attemptId: "a",
        category: "grammar",
        explanation: "note",
        createdAt: now(),
        resolved: false,
      },
    ];
    const backup = await exportBackup(s);
    await saveMedia("x", new Blob(["private binary"]));
    const recovered = await readBackup(JSON.stringify(backup));
    expect(recovered).toEqual(s);
    expect(JSON.stringify(backup)).not.toContain("private binary");
    expect(backup.mediaIncluded).toBe(false);
  });
  it("rejects checksum tampering", async () => {
    const b = await exportBackup(emptyState());
    b.data.settings.chinese = true;
    await expect(readBackup(JSON.stringify(b))).rejects.toThrow("Checksum");
  });
  it("rejects unknown schema versions", async () => {
    const b = await exportBackup(emptyState());
    await expect(
      readBackup(JSON.stringify({ ...b, schemaVersion: 2 })),
    ).rejects.toThrow("version");
  });
  it("schema catches duplicate mastery", () => {
    const s = acceptChunk(emptyState(), candidates[0], "NCE2-L001");
    s.mastery = [
      schedule(candidates[0].id, "writing", "good"),
      schedule(candidates[0].id, "writing", "hard"),
    ];
    expect(StateSchema.safeParse(s).success).toBe(false);
  });
  it("schema catches unknown transcript source", () => {
    const s = emptyState();
    s.imports = [
      {
        lessonId: "L",
        sources: [],
        segments: parseLrc("[00:01.00]Original", "L", "unknown").segments,
        metadata: {},
        warnings: [],
        audioAccent: "unknown",
      },
    ];
    expect(StateSchema.safeParse(s).success).toBe(false);
  });
  it("serializes consecutive writes and clears audio on deletion", async () => {
    const a = emptyState(),
      b = emptyState();
    a.settings.chinese = true;
    b.settings.chinese = false;
    await Promise.all([saveState(a), saveState(b)]);
    expect((await loadState()).settings.chinese).toBe(false);
    await saveMedia("x", new Blob(["audio"]));
    await clearPrivateData();
    expect(await loadMedia("x")).toBeUndefined();
    expect(await loadState()).toEqual(emptyState());
  });
  it("catalog lesson keys are unique", () =>
    expect(
      new Set(lessons.map((l) => `${l.series}-${l.book}-${l.number}`)).size,
    ).toBe(lessons.length));
});

it("restore atomically replaces records and clears mismatched old audio", async () => {
  const { replaceStateAndClearMedia } = await import("../src/storage/db");
  const original = emptyState();
  original.settings.chinese = true;
  await saveState(original);
  await saveMedia("old", new Blob(["old audio"]));
  const recovered = emptyState();
  recovered.sessions = [session("restored draft")];
  await replaceStateAndClearMedia(recovered);
  expect(await loadState()).toEqual(recovered);
  expect(await loadMedia("old")).toBeUndefined();
});
