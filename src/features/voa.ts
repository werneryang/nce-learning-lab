import { z } from "zod";
import {
  ExternalLessonSchema,
  ImportSchema,
  StateSchema,
  type State,
  type LocalImport,
} from "../shared/schema";
import { digest } from "../storage/db";
const Entry = z.object({
  lesson: ExternalLessonSchema,
  paragraphs: z.array(z.string().min(1).max(10000)).min(1).max(500),
  audio: z.object({
    file: z.string().regex(/^VOA-\d+\.mp3$/),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z.number().int().positive().max(50_000_000),
    url: z.url().refine((s) => {
      const u = new URL(s);
      return u.protocol === "https:" && u.hostname === "voa-audio.voanews.eu";
    }),
  }),
});
export const VoaPackageSchema = z
  .object({
    format: z.literal("nce-voa-package"),
    version: z.literal(1),
    entries: z.array(Entry).min(1).max(20),
  })
  .superRefine((p, ctx) => {
    if (new Set(p.entries.map((e) => e.lesson.id)).size !== p.entries.length)
      ctx.addIssue({ code: "custom", message: "Duplicate VOA article IDs" });
    for (const e of p.entries)
      if (e.audio.file !== `${e.lesson.id}.mp3`)
        ctx.addIssue({ code: "custom", message: "Audio identity mismatch" });
  });
export async function prepareVoaPackage(input: string, files: File[]) {
  if (input.length > 5_000_000) throw new Error("VOA package exceeds 5 MB.");
  const pkg = VoaPackageSchema.parse(JSON.parse(input));
  const prepared: { item: LocalImport; audio: File }[] = [];
  for (const e of pkg.entries) {
    const matches = files.filter((f) => f.name === e.audio.file);
    if (matches.length !== 1)
      throw new Error(`Select exactly one ${e.audio.file} with library.json.`);
    const audio = matches[0];
    if (
      audio.size !== e.audio.bytes ||
      (await digest(await audio.arrayBuffer())) !== e.audio.sha256
    )
      throw new Error(`Audio checksum mismatch: ${e.audio.file}`);
    const lessonId = e.lesson.id;
    const sourceId = `${lessonId}-text`;
    prepared.push({
      audio,
      item: ImportSchema.parse({
        lesson: e.lesson,
        lessonId,
        sources: [
          {
            id: sourceId,
            lessonId,
            kind: "transcript",
            originalUrl: e.lesson.originalUrl,
            accessMode: "user_local_import",
            rightsStatus: "unverified",
          },
          {
            id: `${lessonId}-audio`,
            lessonId,
            kind: "audio",
            originalUrl: e.audio.url,
            accessMode: "user_local_import",
            rightsStatus: "unverified",
            sha256: e.audio.sha256,
          },
        ],
        segments: e.paragraphs.map((text, i) => ({
          id: `${sourceId}-${i + 1}`,
          lessonId,
          sourceId,
          text,
          sourceLine: i + 1,
          role: "unreviewed",
          reviewStatus: "pending",
        })),
        metadata: { audioSha256: e.audio.sha256 },
        warnings: [
          "Article-linked audio. Content pairing has not been reviewed; no timing alignment.",
        ],
        audioName: e.audio.file,
        audioAccent: "unknown",
      }),
    });
  }
  return prepared;
}
export function addVoaImports(state: State, items: LocalImport[]): State {
  const imports = [...state.imports];
  for (const item of items) {
    if (
      !item.lesson ||
      item.lessonId !== item.lesson.id ||
      !/^VOA-\d+$/.test(item.lessonId)
    )
      throw new Error("Only independent VOA courses can be imported.");
    const index = imports.findIndex((im) => im.lessonId === item.lessonId);
    if (index < 0) imports.push(item);
    else {
      const existing = imports[index];
      if (existing.metadata.audioSha256 !== item.metadata.audioSha256)
        throw new Error(
          `Different audio version for ${item.lessonId}; existing course preserved.`,
        );
      // Restore missing audio after backup import, without replacing reviewed text or sources.
      imports[index] = {
        ...existing,
        audioName: existing.audioName || item.audioName,
      };
    }
  }
  return StateSchema.parse({ ...state, imports });
}
