import { beforeEach, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { emptyState, StateSchema } from "../src/shared/schema";
import { allLessons, lessons } from "../src/shared/content";
import { activeSegment, loopBounds } from "../src/features/lrc";
import { addVoaImports, prepareVoaPackage } from "../src/features/voa";
import { mergeStates } from "../src/features/merge";
import {
  clearPrivateData,
  digest,
  exportBackup,
  readBackup,
  loadMedia,
  saveMedia,
  saveMissingVoaMedia,
} from "../src/storage/db";
const audio = new File(["original fixture bytes"], "VOA-123.mp3");
async function fixture() {
  return {
    format: "nce-voa-package",
    version: 1,
    entries: [
      {
        lesson: {
          id: "VOA-123",
          series: "VOA",
          title: "Original test article",
          summary: "Test",
          originalUrl: "https://learningenglish.voanews.com/a/123.html",
          publishedAt: "2025-03-10",
          attribution: "Project original test fixture",
          vocabulary: ["example — a demonstration"],
          pairingStatus: "page_linked_unreviewed",
        },
        paragraphs: [
          "This is an original test paragraph.",
          "Another paragraph for study.",
        ],
        audio: {
          file: audio.name,
          sha256: await digest(await audio.arrayBuffer()),
          bytes: audio.size,
          url: "https://voa-audio.voanews.eu/test.mp3",
        },
      },
    ],
  };
}
beforeEach(clearPrivateData);
it("adds a separate course without changing 204 NCE courses or learning records", async () => {
  const prepared = await prepareVoaPackage(JSON.stringify(await fixture()), [
    audio,
  ]);
  const state = emptyState();
  state.recentLessonId = "NCE2-L001";
  const before = JSON.stringify(lessons);
  const next = addVoaImports(
    state,
    prepared.map((p) => p.item),
  );
  expect(allLessons(next)).toHaveLength(215);
  expect(JSON.stringify(lessons)).toBe(before);
  expect(lessons).toHaveLength(204);
  expect(next.recentLessonId).toBe("NCE2-L001");
  expect(next.sessions).toEqual(state.sessions);
  const seg = next.imports[0].segments[0];
  expect(seg.startMs).toBeUndefined();
  expect(activeSegment([seg], 9999)).toBeUndefined();
  expect(loopBounds(seg, 100)).toBeUndefined();
  expect(seg.reviewStatus).toBe("pending");
});
it("rejects NCE identities, mismatched files and unexpected source hosts", async () => {
  const pkg = await fixture();
  pkg.entries[0].lesson.id = "NCE2-L001";
  await expect(
    prepareVoaPackage(JSON.stringify(pkg), [audio]),
  ).rejects.toThrow();
  const valid = await fixture();
  await expect(
    prepareVoaPackage(JSON.stringify(valid), [new File(["bad"], audio.name)]),
  ).rejects.toThrow("checksum");
  valid.entries[0].lesson.originalUrl = "javascript:alert(1)";
  await expect(
    prepareVoaPackage(JSON.stringify(valid), [audio]),
  ).rejects.toThrow();
});
it("reimport preserves confirmations; backup restore and merge retain course metadata", async () => {
  const [p] = await prepareVoaPackage(JSON.stringify(await fixture()), [audio]);
  const state = addVoaImports(emptyState(), [p.item]);
  state.imports[0].segments[0].reviewStatus = "confirmed";
  state.imports[0].segments[0].role = "lesson_body";
  const next = addVoaImports(state, [p.item]);
  expect(next.imports).toEqual(state.imports);
  const backup = await exportBackup(next);
  expect(backup.schemaVersion).toBe(2); // Earlier app rejects instead of silently dropping VOA.
  const restored = await readBackup(JSON.stringify(backup));
  expect(restored).toEqual(next);
  const merged = mergeStates(emptyState(), restored).state;
  expect(allLessons(merged)).toHaveLength(215);
  expect(merged.imports[0].audioName).toBeUndefined();
  expect(addVoaImports(merged, [p.item]).imports[0].audioName).toBe(audio.name);
  expect((await exportBackup(emptyState())).schemaVersion).toBe(1);
});
it("writes only absent VOA media and never overwrites NCE or a local replacement", async () => {
  await saveMedia("NCE2-L001:audio", new Blob(["nce"]));
  await saveMedia("VOA-123:audio", new Blob(["replacement"]));
  await saveMissingVoaMedia([{ key: "VOA-123:audio", blob: audio }]);
  expect(await (await loadMedia("VOA-123:audio"))?.text()).toBe("replacement");
  await expect(
    saveMissingVoaMedia([{ key: "NCE2-L001:audio", blob: audio }]),
  ).rejects.toThrow();
  expect(await (await loadMedia("NCE2-L001:audio"))?.text()).toBe("nce");
});
it("rejects invalid external metadata and conflicting audio versions", async () => {
  const [p] = await prepareVoaPackage(JSON.stringify(await fixture()), [audio]);
  const state = addVoaImports(emptyState(), [p.item]);
  const changed = structuredClone(p.item);
  changed.metadata.audioSha256 = "different";
  expect(() => addVoaImports(state, [changed])).toThrow(
    "existing course preserved",
  );
  const incoming = emptyState();
  incoming.imports = [changed];
  changed.segments[0].reviewStatus = "confirmed";
  expect(
    mergeStates(state, incoming).state.imports[0].metadata.audioSha256,
  ).toBe(state.imports[0].metadata.audioSha256);
  state.imports[0].lesson!.id = "VOA-456";
  expect(() => StateSchema.parse(state)).toThrow("identity");
});
