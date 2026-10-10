import type { Segment } from "../shared/schema";
export function parseLrc(
  input: string,
  lessonId: string,
  sourceId: string,
): {
  segments: Segment[];
  metadata: Record<string, string>;
  warnings: string[];
} {
  if (input.length > 100000)
    throw new Error("LRC exceeds 100 KB. Split the file before importing.");
  if (input.includes("\uFFFD"))
    throw new Error("Text encoding is damaged. Please save the LRC as UTF-8.");
  const metadata: Record<string, string> = {};
  const warnings: string[] = [];
  const segments: Segment[] = [];
  let previous = -1;
  const lines = input.replace(/^\uFEFF/, "").split(/\r?\n/);
  lines.forEach((line, lineIndex) => {
    const meta = /^\[(ti|ar|al|by|offset|re|ve):([^\]]*)\]$/i.exec(line.trim());
    if (meta) {
      metadata[meta[1].toLowerCase()] = meta[2];
      return;
    }
    const tags = [...line.matchAll(/\[(\d+):(\d{2})(?:\.(\d{1,3}))?\]/g)];
    if (!line.trim()) return;
    if (!tags.length) {
      warnings.push(
        `Line ${lineIndex + 1}: no valid timestamp; kept out of practice.`,
      );
      return;
    }
    const text = line.replace(/\[(\d+):(\d{2})(?:\.(\d{1,3}))?\]/g, "").trim();
    if (!text) return;
    for (const [tag, minutes, seconds, fraction] of tags) {
      if (Number(seconds) > 59) {
        warnings.push(
          `Line ${lineIndex + 1}: invalid seconds in ${tag}; skipped.`,
        );
        continue;
      }
      const offset = Number(metadata.offset || 0);
      if (!Number.isFinite(offset)) {
        warnings.push("Invalid LRC offset; ignored.");
      }
      const startMs =
        Number(minutes) * 60000 +
        Number(seconds) * 1000 +
        Number((fraction || "0").padEnd(3, "0")) +
        (Number.isFinite(offset) ? offset : 0);
      if (startMs < 0) {
        warnings.push(
          `Line ${lineIndex + 1}: negative time after offset; skipped.`,
        );
        continue;
      }
      if (startMs <= previous)
        warnings.push(
          `Line ${lineIndex + 1}: duplicate or out-of-order timestamp; inspect before confirmation.`,
        );
      previous = startMs;
      const question =
        /\?$/.test(text) ||
        /^(listen.*question|why |what |who |how |when |where )/i.test(text);
      const other = /^(lesson\s*\d|new concept|listen to)/i.test(text);
      segments.push({
        id: `${sourceId}-${lineIndex + 1}-${segments.length}`,
        lessonId,
        sourceId,
        startMs,
        text,
        sourceLine: lineIndex + 1,
        role: question ? "intro_question" : other ? "other" : "unreviewed",
        reviewStatus: "pending",
      });
    }
  });
  // Preserve sourceLine for inspection; explicitly report sorting instead of hiding it.
  if (segments.some((x, i) => i > 0 && x.startMs < segments[i - 1].startMs))
    warnings.push(
      "Playback order sorted by timestamp; original source line numbers retained.",
    );
  segments.sort((a, b) => a.startMs - b.startMs);
  segments.forEach((s, i) => {
    const next = segments.slice(i + 1).find((n) => n.startMs > s.startMs);
    if (next) s.endMs = next.startMs;
  });
  if (!segments.length)
    throw new Error("No timed text found. Use [mm:ss.xx] text lines.");
  return { segments, metadata, warnings };
}
export function activeSegment(segments: Segment[], timeMs: number) {
  return segments.filter((s) => s.startMs <= timeMs).at(-1);
}
export function loopBounds(
  segment: Segment,
  duration: number,
): [number, number] | undefined {
  const start = segment.startMs / 1000;
  const end =
    Math.min(
      duration,
      segment.endMs === undefined ? duration : segment.endMs / 1000,
    ) - 0.04;
  return Number.isFinite(end) && end - start >= 0.15 ? [start, end] : undefined;
}
export function confirmedBody(segments: Segment[]) {
  return segments.filter(
    (s) => s.role === "lesson_body" && s.reviewStatus === "confirmed",
  );
}
