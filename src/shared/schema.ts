import { z } from "zod";
const id = z.string().min(1).max(180);
const iso = z.iso.datetime();
const text = z.string().max(100000);
export const ModeSchema = z.enum([
  "listening_dictation",
  "memory_recall",
  "guided_rewriting",
]);
export const SkillSchema = z.enum(["recognition", "writing", "speaking"]);
export const RatingSchema = z.enum(["again", "hard", "good", "easy"]);
export const SourceSchema = z.object({
  id,
  lessonId: id,
  kind: z.enum(["reference_pdf", "audio", "timed_transcript", "original_note"]),
  originRepo: z.string().optional(),
  repoRef: z.string().optional(),
  relativePath: z.string().optional(),
  originalUrl: z.string().optional(),
  accent: z.enum(["us", "uk", "unknown"]).optional(),
  accessMode: z.enum([
    "external_reference",
    "user_local_import",
    "licensed_hosted",
  ]),
  rightsStatus: z.enum(["unverified", "permitted", "restricted"]),
  verifiedAt: z.string().optional(),
  sha256: z.string().optional(),
  fileName: z.string().optional(),
  importedAt: iso.optional(),
});
export const LessonSchema = z.object({
  id,
  series: z.literal("NCE"),
  book: z.number().int().min(1).max(4),
  number: z.number().int().positive(),
  title: z.string(),
  summary: z.string(),
  learningObjectives: z.array(z.string()),
  tags: z.array(z.string()),
  sourceIds: z.array(id),
});
export const SegmentSchema = z.object({
  id,
  lessonId: id,
  sourceId: id,
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative().optional(),
  text,
  role: z.enum(["intro_question", "lesson_body", "other", "unreviewed"]),
  reviewStatus: z.enum(["pending", "confirmed", "excluded"]),
  sourceLine: z.number().int().positive(),
});
export const ChunkSchema = z.object({
  id,
  canonical: z.string().min(1).max(200),
  senseKey: z.string().min(1).max(120),
  category: z.enum([
    "idiom",
    "collocation",
    "phrasal_verb",
    "sentence_pattern",
    "discourse_marker",
    "other",
  ]),
  definitionEn: z.string().min(1).max(2000),
  explanationZh: z.string().optional(),
  register: z.enum(["informal", "neutral", "formal", "varies"]),
  functionTags: z.array(z.string()),
  createdAt: iso,
  updatedAt: iso,
});
export const LinkSchema = z.object({
  lessonId: id,
  chunkId: id,
  segmentIds: z.array(id).optional(),
  importance: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  learningNote: z.string().optional(),
});
export const ExampleSchema = z.object({
  id,
  chunkId: id,
  text,
  provenance: z.enum(["project_original", "user_created", "licensed_excerpt"]),
  scenario: z.string().optional(),
  sourceId: id.optional(),
});
export const ExerciseSchema = z.object({
  id,
  lessonId: id.optional(),
  targetChunkIds: z.array(id),
  mode: z.enum(["writing", "speaking", "comprehension", "listening", "recall"]),
  prompt: text,
  rubric: text.optional(),
  authoredBy: z.enum(["project", "user", "ai"]),
});
export const DifferenceSchema = z.object({
  id,
  kind: z.enum(["missing", "extra", "substitution", "order", "punctuation"]),
  referenceRange: z.tuple([z.number(), z.number()]).optional(),
  learnerRange: z.tuple([z.number(), z.number()]).optional(),
  referenceText: text.optional(),
  learnerText: text.optional(),
  strictMatch: z.boolean(),
});
export const FeedbackSchema = z.object({
  mode: ModeSchema,
  overallMessage: text,
  issues: z
    .array(
      z.object({
        category: z.enum([
          "missing",
          "spelling",
          "grammar",
          "tense",
          "article",
          "word_order",
          "collocation",
          "meaning",
          "naturalness",
          "punctuation",
          "other",
        ]),
        severity: z.enum(["error", "acceptable_variation", "style_suggestion"]),
        learnerSpan: text.optional(),
        explanation: text,
        hint: text.optional(),
        suggestedRevision: text.optional(),
        relatedChunkIds: z.array(id).optional(),
      }),
    )
    .max(100),
  strengths: z.array(text),
  nextStep: text.optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
});
export const SessionSchema = z.object({
  id,
  lessonId: id,
  mode: ModeSchema,
  scope: z.enum(["sentence", "paragraph", "full_lesson"]),
  selectedSegmentIds: z.array(id),
  targetChunkIds: z.array(id),
  userDraft: text,
  draftVersion: z.number().int().nonnegative(),
  startedAt: iso,
  updatedAt: iso,
  submittedAt: iso.optional(),
  status: z.enum([
    "editing",
    "review_requested",
    "reviewed",
    "revising",
    "completed",
  ]),
  hintCount: z.number().int().nonnegative(),
  referenceFingerprint: z.string().optional(),
  learnerNotes: text.optional(),
});
export const TurnSchema = z.object({
  id,
  sessionId: id,
  action: z.enum(["hint", "review", "explain", "recheck"]),
  createdAt: iso,
  draftVersion: z.number().int().nonnegative(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  learnerQuestion: text.optional(),
  feedback: FeedbackSchema,
  engine: z.enum(["ai_backend", "local_rules", "manual_chatgpt"]),
  draftSnapshot: text,
  differences: z.array(DifferenceSchema),
  fidelity: z
    .object({
      wer: z.number().nonnegative(),
      errors: z.number().int().nonnegative(),
      referenceWords: z.number().int().nonnegative(),
      exact: z.boolean(),
      ignorePunctuation: z.boolean(),
    })
    .optional(),
});
export const AttemptSchema = z.object({
  id,
  exerciseId: id,
  createdAt: iso,
  responseText: text.optional(),
  localAudioRef: id.optional(),
  rating: RatingSchema.optional(),
  feedback: text.optional(),
  mistakeIds: z.array(id).optional(),
  practiceSessionId: id.optional(),
  revisionNumber: z.number().int().optional(),
  skill: SkillSchema,
});
export const MasterySchema = z.object({
  chunkId: id,
  skill: SkillSchema,
  dueAt: iso.optional(),
  lastReviewedAt: iso.optional(),
  intervalDays: z.number().nonnegative().optional(),
  repetitions: z.number().int().nonnegative(),
  lastRating: RatingSchema.optional(),
});
export const MistakeSchema = z.object({
  id,
  attemptId: id,
  chunkId: id.optional(),
  category: z.enum([
    "grammar",
    "collocation",
    "meaning",
    "word_order",
    "fluency",
    "pronunciation",
    "other",
  ]),
  explanation: text,
  correctedExample: text.optional(),
  learnerText: text.optional(),
  createdAt: iso,
  resolved: z.boolean().default(false),
});
export const ImportSchema = z.object({
  lessonId: id,
  sources: z.array(SourceSchema),
  segments: z.array(SegmentSchema),
  metadata: z.record(z.string(), z.string()),
  warnings: z.array(z.string()),
  audioName: z.string().optional(),
  audioAccent: z.enum(["us", "uk", "unknown"]).default("unknown"),
  audioDuration: z.number().nonnegative().optional(),
});
export const StateSchema = z
  .object({
    schemaVersion: z.literal(1),
    imports: z.array(ImportSchema),
    sessions: z.array(SessionSchema),
    turns: z.array(TurnSchema),
    attempts: z.array(AttemptSchema),
    chunks: z.array(ChunkSchema),
    links: z.array(LinkSchema),
    examples: z.array(ExampleSchema),
    mastery: z.array(MasterySchema),
    mistakes: z.array(MistakeSchema),
    rejectedCandidates: z.array(id),
    settings: z.object({
      subtitleVisible: z.boolean(),
      currentLineOnly: z.boolean(),
      ignorePunctuation: z.boolean(),
      chinese: z.boolean(),
    }),
    recentLessonId: id.optional(),
  })
  .superRefine((s, ctx) => {
    const unique = (keys: string[], label: string) => {
      if (new Set(keys).size !== keys.length)
        ctx.addIssue({ code: "custom", message: `Duplicate ${label}` });
    };
    for (const field of [
      "sessions",
      "turns",
      "attempts",
      "chunks",
      "mistakes",
      "examples",
    ] as const)
      unique(
        s[field].map((x) => x.id),
        field,
      );
    unique(
      s.imports.map((x) => x.lessonId),
      "imports",
    );
    unique(
      s.mastery.map((x) => `${x.chunkId}:${x.skill}`),
      "mastery",
    );
    unique(
      s.links.map((x) => `${x.lessonId}:${x.chunkId}`),
      "links",
    );
    unique(
      s.chunks.map(
        (x) =>
          `${x.canonical.trim().toLowerCase().replace(/\s+/g, " ")}:${x.senseKey.trim().toLowerCase()}`,
      ),
      "chunk senses",
    );
    const chunks = new Set(s.chunks.map((x) => x.id));
    const sessions = new Set(s.sessions.map((x) => x.id));
    const attempts = new Set(s.attempts.map((x) => x.id));
    for (const x of [...s.links, ...s.mastery, ...s.examples])
      if (!chunks.has(x.chunkId))
        ctx.addIssue({ code: "custom", message: "Unknown chunk reference" });
    for (const x of s.turns)
      if (!sessions.has(x.sessionId))
        ctx.addIssue({ code: "custom", message: "Unknown session reference" });
    for (const x of s.mistakes)
      if (!attempts.has(x.attemptId) || (x.chunkId && !chunks.has(x.chunkId)))
        ctx.addIssue({ code: "custom", message: "Unknown mistake reference" });
    for (const x of s.attempts)
      if (x.practiceSessionId && !sessions.has(x.practiceSessionId))
        ctx.addIssue({ code: "custom", message: "Unknown attempt session" });
    for (const im of s.imports) {
      const sources = new Set(im.sources.map((x) => x.id));
      unique(
        im.segments.map((x) => x.id),
        "segments",
      );
      unique(
        im.sources.map((x) => x.id),
        "sources",
      );
      let previous = -1;
      for (const seg of im.segments) {
        if (
          !sources.has(seg.sourceId) ||
          seg.lessonId !== im.lessonId ||
          seg.startMs < previous ||
          (seg.endMs !== undefined && seg.endMs < seg.startMs)
        )
          ctx.addIssue({
            code: "custom",
            message: "Invalid transcript provenance or timing",
          });
        previous = seg.startMs;
      }
    }
  });
export type State = z.infer<typeof StateSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type Segment = z.infer<typeof SegmentSchema>;
export type Chunk = z.infer<typeof ChunkSchema>;
export type Feedback = z.infer<typeof FeedbackSchema>;
export type Turn = z.infer<typeof TurnSchema>;
export type Mode = z.infer<typeof ModeSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type Rating = z.infer<typeof RatingSchema>;
export type Mastery = z.infer<typeof MasterySchema>;
export type Difference = z.infer<typeof DifferenceSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
export type LocalImport = z.infer<typeof ImportSchema>;
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function emptyState(): State {
  return {
    schemaVersion: 1,
    imports: [],
    sessions: [],
    turns: [],
    attempts: [],
    chunks: [],
    links: [],
    examples: [],
    mastery: [],
    mistakes: [],
    rejectedCandidates: [],
    settings: {
      subtitleVisible: true,
      currentLineOnly: false,
      ignorePunctuation: true,
      chinese: false,
    },
  };
}
