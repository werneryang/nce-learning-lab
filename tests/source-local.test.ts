import { it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { parseLrc } from "../src/features/lrc";
const directory = process.env.NCE_SOURCE_VERIFY_DIR;
it.skipIf(!directory)(
  "parses five private source LRCs without committing their text",
  () => {
    const files = readdirSync(directory!).filter((x) => x.endsWith(".lrc"));
    expect(files).toHaveLength(5);
    for (const [i, file] of files.entries()) {
      const text = readFileSync(`${directory}/${file}`, "utf8");
      const result = parseLrc(
        text,
        `NCE2-L${String(i + 1).padStart(3, "0")}`,
        `source-${i}`,
      );
      expect(result.segments.length).toBeGreaterThan(5);
      expect(result.segments.some((s) => s.role === "intro_question")).toBe(
        true,
      );
      expect(result.segments.every((s) => s.reviewStatus === "pending")).toBe(
        true,
      );
      console.log(
        JSON.stringify({
          lesson: i + 1,
          segments: result.segments.length,
          questions: result.segments.filter((s) => s.role === "intro_question")
            .length,
          warnings: result.warnings.length,
        }),
      );
    }
  },
);
