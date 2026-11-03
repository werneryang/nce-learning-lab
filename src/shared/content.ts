import { hosted, hostedSource, voaHosted } from "../features/hosted";
import rawLessons from "../../content/lessons/nce2/catalog.json";
import rawChunks from "../../content/chunks/candidates.json";
import rawExamples from "../../content/chunks/examples.json";
import rawLinks from "../../content/lesson-chunk-links/links.json";
import rawExercises from "../../content/exercises/exercises.json";
import rawNceVocabulary from "../../content/vocabulary/nce.json";
import sourceManifest from "../../content/source-manifest/nce2.json";
import { z } from "zod";
import {
  LessonSchema,
  ChunkSchema,
  ExampleSchema,
  LinkSchema,
  ExerciseSchema,
  SourceSchema,
} from "./schema";
export const lessons = hosted.map((e) =>
  LessonSchema.parse(
    rawLessons.find((l) => l.id === e.lessonId) || {
      id: e.lessonId,
      series: "NCE",
      book: e.book,
      number: e.number,
      title: e.title,
      summary:
        "Listen with synchronized subtitles, confirm your practice lines, and write at your own pace.",
      learningObjectives: [
        "Listen and recall selected lines.",
        "Review your own writing only when ready.",
      ],
      tags: ["repository_audio"],
      sourceIds: [
        hostedSource(e, "audio").id,
        hostedSource(e, "timed_transcript").id,
      ],
    },
  ),
);
export const candidates = rawChunks.map((x) => ChunkSchema.parse(x));
export const examples = rawExamples.map((x) => ExampleSchema.parse(x));
export const links = rawLinks.map((x) => LinkSchema.parse(x));
export const exercises = rawExercises.map((x) => ExerciseSchema.parse(x));
// Project-authored study words for each NCE lesson, keyed by lesson ID.
export const nceVocabulary = z
  .record(z.string(), z.array(z.string().min(1).max(2000)))
  .parse(rawNceVocabulary);
export const manifest = sourceManifest;
export const sources = [
  ...sourceManifest.entries.flatMap((x) =>
    x.sources.map((s) => SourceSchema.parse(s)),
  ),
  ...[...hosted, ...voaHosted].flatMap((e) => [
    hostedSource(e, "audio"),
    hostedSource(e, "timed_transcript"),
  ]),
];

// Hosted VOA and optional private imports share IDs without duplicating courses.
// Neither collection mutates the NCE catalog.
export function allLessons(state: import("./schema").State) {
  const external = new Map(voaHosted.map((e) => [e.lessonId, e.lesson]));
  for (const im of state.imports)
    if (im.lesson) external.set(im.lessonId, im.lesson);
  return [
    ...lessons,
    ...Array.from(external.values(), (lesson) => ({
      ...lesson,
      book: undefined,
      number: undefined,
    })),
  ];
}
