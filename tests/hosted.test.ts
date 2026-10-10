import { it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  hosted,
  hostedSource,
  loadHostedTranscript,
} from "../src/features/hosted";
import { parseLrc } from "../src/features/lrc";
it("204 repository lessons have unique IDs, paired files and parseable transcripts", () => {
  expect(new Set(hosted.map((e) => e.lessonId)).size).toBe(204);
  for (const [book, count] of [
    [2, 96],
    [3, 60],
    [4, 48],
  ])
    expect(hosted.filter((e) => e.book === book).length).toBe(count);
  for (const e of hosted) {
    const text = readFileSync(
      `projects/New-Concept-English/${e.transcript.path}`,
      "utf8",
    );
    const parsed = parseLrc(
      text,
      e.lessonId,
      hostedSource(e, "timed_transcript").id,
    );
    expect(parsed.segments.length).toBeGreaterThan(0);
    expect(parsed.segments.every((s) => s.reviewStatus === "pending")).toBe(
      true,
    );
  }
});
it("a failed or corrupted hosted transcript is not silently accepted", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = vi.fn(async () => new Response("bad", { status: 503 }));
    await expect(
      loadHostedTranscript(hosted[0], new AbortController().signal),
    ).rejects.toThrow("503");
    globalThis.fetch = vi.fn(async () => new Response("bad"));
    await expect(
      loadHostedTranscript(hosted[0], new AbortController().signal),
    ).rejects.toThrow("verification failed");
  } finally {
    globalThis.fetch = original;
  }
});
