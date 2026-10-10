import { z } from "zod";
import raw from "../../content/source-manifest/hosted.json";
import { SourceSchema, type LocalImport } from "../shared/schema";
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
export type HostedEntry = z.infer<typeof entry>;
export const hostedLesson = (id: string) =>
  hosted.find((x) => x.lessonId === id);
export function mediaUrl(path: string) {
  return `${import.meta.env.BASE_URL}media/${path.split("/").map(encodeURIComponent).join("/")}`;
}
export function hostedSource(
  e: HostedEntry,
  kind: "audio" | "timed_transcript",
) {
  const a = kind === "audio" ? e.audio : e.transcript;
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
