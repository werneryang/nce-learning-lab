import { describe, expect, it } from "vitest";
import { emptyState } from "../src/shared/schema";
import type { Chunk, Session, State } from "../src/shared/schema";
import { mergeStates } from "../src/features/merge";
import {
  backupFileName,
  cleanDeviceName,
  guessDeviceName,
} from "../src/features/device";
const t = (minute: number) =>
  `2026-10-10T10:${String(minute).padStart(2, "0")}:00.000Z`;
const session = (
  id: string,
  lessonId: string,
  at: number,
  draft = "",
): Session => ({
  id,
  lessonId,
  mode: "memory_recall",
  scope: "sentence",
  selectedSegmentIds: [],
  targetChunkIds: [],
  userDraft: draft,
  draftVersion: 1,
  startedAt: t(at),
  updatedAt: t(at),
  status: "editing",
  hintCount: 0,
});
const chunk = (id: string, canonical: string, at = 0): Chunk => ({
  id,
  canonical,
  senseKey: "s",
  category: "other",
  definitionEn: "d",
  register: "neutral",
  functionTags: [],
  createdAt: t(at),
  updatedAt: t(at),
});
const with_ = (patch: Partial<State>): State => ({ ...emptyState(), ...patch });
describe("merging backups from other devices", () => {
  it("combines different lessons studied on each device", () => {
    const mac = with_({ sessions: [session("a", "NCE2-L001", 1)] });
    const iphone = with_({ sessions: [session("b", "NCE2-L011", 2)] });
    const { state, summary } = mergeStates(mac, iphone);
    expect(state.sessions.map((s) => s.id).sort()).toEqual(["a", "b"]);
    expect(summary.sessionsAdded).toBe(1);
    expect(summary.sessionsUpdated).toBe(0);
  });
  it("keeps the newer edit of the same practice session", () => {
    const mac = with_({ sessions: [session("a", "NCE2-L001", 1, "old")] });
    const iphone = with_({ sessions: [session("a", "NCE2-L001", 5, "new")] });
    expect(mergeStates(mac, iphone).state.sessions[0].userDraft).toBe("new");
    expect(mergeStates(iphone, mac).state.sessions[0].userDraft).toBe("new");
    expect(mergeStates(mac, iphone).summary.sessionsUpdated).toBe(1);
  });
  it("is safe to merge the same backup twice", () => {
    const mac = with_({ sessions: [session("a", "NCE2-L001", 1)] });
    const iphone = with_({ sessions: [session("b", "NCE2-L011", 2)] });
    const once = mergeStates(mac, iphone).state;
    const twice = mergeStates(once, iphone);
    expect(twice.state).toEqual(once);
    expect(twice.summary.sessionsAdded).toBe(0);
  });
  it("matches a chunk created on both devices and keeps references valid", () => {
    const mine = chunk("user-1", "make up one's mind");
    const theirs = chunk("user-2", "Make up  one's mind", 3);
    const mac = with_({ chunks: [mine] });
    const iphone = with_({
      chunks: [theirs],
      links: [{ lessonId: "NCE2-L011", chunkId: "user-2", importance: 2 }],
      mastery: [
        {
          chunkId: "user-2",
          skill: "writing",
          repetitions: 1,
          lastReviewedAt: t(4),
        },
      ],
      examples: [
        { id: "e2", chunkId: "user-2", text: "x", provenance: "user_created" },
      ],
    });
    const { state } = mergeStates(mac, iphone);
    expect(state.chunks).toHaveLength(1);
    expect(state.chunks[0].id).toBe("user-1");
    expect(state.links[0].chunkId).toBe("user-1");
    expect(state.mastery[0].chunkId).toBe("user-1");
    expect(state.examples[0].chunkId).toBe("user-1");
  });
  it("keeps the most recent review of a chunk skill", () => {
    const c = chunk("CH000001", "get + adjective");
    const review = (at: number, repetitions: number) => ({
      chunkId: "CH000001",
      skill: "recognition" as const,
      repetitions,
      lastReviewedAt: t(at),
    });
    const mac = with_({ chunks: [c], mastery: [review(9, 3)] });
    const iphone = with_({ chunks: [c], mastery: [review(2, 1)] });
    expect(mergeStates(mac, iphone).state.mastery[0].repetitions).toBe(3);
    expect(mergeStates(iphone, mac).state.mastery[0].repetitions).toBe(3);
  });
  it("keeps this device's preferences and local audio names", () => {
    const mac = with_({
      settings: { ...emptyState().settings, chinese: true },
      imports: [
        {
          lessonId: "NCE2-L001",
          sources: [],
          segments: [],
          metadata: {},
          warnings: [],
          audioName: "mine.mp3",
          audioAccent: "uk",
        },
      ],
    });
    const iphone = with_({
      settings: { ...emptyState().settings, chinese: false },
      imports: [
        {
          lessonId: "NCE2-L001",
          sources: [],
          segments: [],
          metadata: {},
          warnings: [],
          audioName: "theirs.mp3",
          audioAccent: "us",
        },
      ],
    });
    const { state } = mergeStates(mac, iphone);
    expect(state.settings.chinese).toBe(true);
    expect(state.imports[0].audioName).toBe("mine.mp3");
  });
  it("does not bring another device's local audio name into this device", () => {
    const iphone = with_({
      imports: [
        {
          lessonId: "NCE2-L005",
          sources: [],
          segments: [],
          metadata: {},
          warnings: [],
          audioName: "theirs.mp3",
          audioAccent: "us",
        },
      ],
    });
    const { state } = mergeStates(emptyState(), iphone);
    expect(state.imports[0].audioName).toBeUndefined();
  });
});
describe("backup file names", () => {
  it("include the device name and local date and time", () => {
    expect(backupFileName("iPhone", new Date(2026, 9, 10, 21, 5))).toBe(
      "nce-learning-backup-iphone-2026-10-10-2105.json",
    );
  });
  it("keep only safe characters, including Chinese", () => {
    expect(cleanDeviceName(" My Mac / 书房 ")).toBe("my-mac-书房");
    expect(cleanDeviceName("///")).toBe("device");
  });
  it("guess a starting name from the browser", () => {
    expect(
      guessDeviceName(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit",
      ),
    ).toBe("iphone");
    expect(
      guessDeviceName("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"),
    ).toBe("mac");
  });
});
