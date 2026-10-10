import { hosted, hostedSource } from "../features/hosted";
import rawLessons from "../../content/lessons/nce2/catalog.json";
import rawChunks from "../../content/chunks/candidates.json";
import rawExamples from "../../content/chunks/examples.json";
import rawLinks from "../../content/lesson-chunk-links/links.json";
import rawExercises from "../../content/exercises/exercises.json";
import sourceManifest from "../../content/source-manifest/nce2.json";
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
export const manifest = sourceManifest;
export const sources = [
  ...sourceManifest.entries.flatMap((x) =>
    x.sources.map((s) => SourceSchema.parse(s)),
  ),
  ...hosted.flatMap((e) => [
    hostedSource(e, "audio"),
    hostedSource(e, "timed_transcript"),
  ]),
];
