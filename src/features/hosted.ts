import { z } from "zod";
import raw from "../../content/source-manifest/hosted.json";
import voaRaw from "../../content/source-manifest/voa-hosted.json";
import {
  SourceSchema,
  ImportSchema,
  ExternalLessonSchema,
  type LocalImport,
} from "../shared/schema";
import { parseLrc } from "./lrc";
import { digest } from "../storage/db";
const asset = z.object({
  path: z
    .string()
    .regex(/^book[234]\/audio-us\/[^/]+\.(mp3|lrc)$/)
    .refine((p) => !p.includes("..")),
  sizeBytes: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
const entry = z.object({
  lessonId: z.string(),
  book: z.number().int().min(2).max(4),
  number: z.number().int().positive(),
  title: z.string(),
  audio: asset,
  transcript: asset,
});
export const hosted = z.array(entry).parse(raw.entries);
const voaAsset = asset.extend({
  path: z.string().regex(/^voa\/VOA-\d+\/(?:VOA-\d+\.mp3|lesson\.json)$/),
});
const voaEntry = z
  .object({
    lessonId: z.string().regex(/^VOA-\d+$/),
    lesson: ExternalLessonSchema,
    audio: voaAsset.extend({ originalUrl: z.url() }),
    transcript: voaAsset,
  })
  .refine(
    (e) =>
      e.lessonId === e.lesson.id &&
      e.audio.path === `voa/${e.lessonId}/${e.lessonId}.mp3` &&
      e.transcript.path === `voa/${e.lessonId}/lesson.json`,
    "VOA identity mismatch",
  );
export const voaHosted = z.array(voaEntry).parse(voaRaw.entries);
export type HostedEntry = z.infer<typeof entry> | z.infer<typeof voaEntry>;
export const hostedLesson = (id: string) =>
  hosted.find((x) => x.lessonId === id) ||
  voaHosted.find((x) => x.lessonId === id);
export function mediaUrl(path: string) {
  return `${import.meta.env.BASE_URL}media/${path.split("/").map(encodeURIComponent).join("/")}`;
}
export function hostedSource(
  e: HostedEntry,
  kind: "audio" | "timed_transcript",
) {
  const a = kind === "audio" ? e.audio : e.transcript;
  if ("lesson" in e)
    return SourceSchema.parse({
      id: `${e.lessonId}-${kind === "audio" ? "audio" : "text"}`,
      lessonId: e.lessonId,
      kind: kind === "audio" ? "audio" : "transcript",
      originalUrl:
        kind === "audio" ? e.audio.originalUrl : e.lesson.originalUrl,
      relativePath: `resources/${a.path}`,
      accent: "unknown",
      accessMode: "user_repository_hosted",
      rightsStatus: "unverified",
      sha256: a.sha256,
    });
  return SourceSchema.parse({
    id: `repository-${e.lessonId}-${kind}-${a.sha256.slice(0, 12)}`,
    lessonId: e.lessonId,
    kind,
    originRepo: raw.sourceRepo,
    repoRef: raw.sourceRef,
    relativePath: `projects/New-Concept-English/${a.path}`,
    originalUrl: `https://github.com/${raw.sourceRepo}/blob/${raw.sourceRef}/projects/New-Concept-English/${a.path.split("/").map(encodeURIComponent).join("/")}`,
    accent: "us",
    accessMode: "user_repository_hosted",
    rightsStatus: "unverified",
    sha256: a.sha256,
    fileName: a.path.split("/").at(-1),
  });
}
export async function loadHostedTranscript(
  e: HostedEntry,
  signal: AbortSignal,
): Promise<LocalImport> {
  const response = await fetch(mediaUrl(e.transcript.path), { signal });
  if (!response.ok)
    throw new Error(
      `Repository subtitles could not load (${response.status}). Retry when connected.`,
    );
  const bytes = await response.arrayBuffer();
  if (
    bytes.byteLength !== e.transcript.sizeBytes ||
    (await digest(bytes)) !== e.transcript.sha256
  )
    throw new Error(
      "Repository subtitle verification failed. Retry after the deployment finishes.",
    );
  if ("lesson" in e) {
    const data = ImportSchema.parse(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    );
    if (
      data.lessonId !== e.lessonId ||
      data.lesson?.id !== e.lessonId ||
      data.audioName ||
      data.metadata.audioSha256 !== e.audio.sha256
    )
      throw new Error("VOA resource identity mismatch");
    return data;
  }
  const source = hostedSource(e, "timed_transcript");
  const parsed = parseLrc(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    e.lessonId,
    source.id,
  );
  return {
    lessonId: e.lessonId,
    ...parsed,
    sources: [source],
    audioAccent: "us",
  };
}
