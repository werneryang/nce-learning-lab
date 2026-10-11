import { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Eye,
  EyeOff,
  Upload,
  Headphones,
} from "lucide-react";
import type { LocalImport, Segment, State } from "../shared/schema";
import { uid, now } from "../shared/schema";
import { parseLrc, activeSegment, loopBounds } from "./lrc";
import { saveMedia, loadMedia, deleteMedia, digest } from "../storage/db";
import { sources } from "../shared/content";
import { hostedLesson, loadHostedTranscript, mediaUrl } from "./hosted";
type Props = {
  lessonId: string;
  data?: LocalImport;
  settings: State["settings"];
  update: (fn: (s: State) => State) => void;
  selected: string[];
  onSelect: (ids: string[]) => void;
  memoryLocked: boolean;
  onAudioAvailable: (available: boolean) => void;
};
const stamp = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
export function Player({
  lessonId,
  data,
  settings,
  update,
  selected,
  onSelect,
  memoryLocked,
  onAudioAvailable,
}: Props) {
  const audio = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState("");
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [mediaState, setMediaState] = useState("empty");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [loopId, setLoopId] = useState("");
  const [loopLesson, setLoopLesson] = useState(false);
  const [sourceReview, setSourceReview] = useState(false);
  const [allowReplay, setAllowReplay] = useState(false);
  const [reload, setReload] = useState(0);
  const [accent, setAccent] = useState<"us" | "uk" | "unknown">("us");
  const repository = hostedLesson(lessonId);
  const [transcriptError, setTranscriptError] = useState("");
  const [transcriptReload, setTranscriptReload] = useState(0);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const segments = data?.segments || [];
  useEffect(() => {
    if (!repository || data?.segments.length) return;
    const controller = new AbortController();
    setLoadingTranscript(true);
    setTranscriptError("");
    loadHostedTranscript(repository, controller.signal)
      .then((loaded) => {
        if (controller.signal.aborted) return;
        update((s) => {
          const current = s.imports.find((im) => im.lessonId === lessonId);
          if (current?.segments.length) return s; // A local replacement or reviewed transcript wins.
          return {
            ...s,
            imports: [
              ...s.imports.filter((im) => im.lessonId !== lessonId),
              {
                ...loaded,
                ...current,
                segments: loaded.segments,
                metadata: loaded.metadata,
                warnings: loaded.warnings,
                sources: [
                  ...(current?.sources || []).filter(
                    (source) => source.kind !== "timed_transcript",
                  ),
                  ...loaded.sources,
                ],
              },
            ],
          };
        });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setTranscriptError(
            `Subtitles could not load. Check your connection. ${String(e)}`,
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingTranscript(false);
      });
    return () => controller.abort();
  }, [lessonId, repository, data?.segments.length, transcriptReload, update]);
  const active = activeSegment(segments, time * 1000);
  const audioDisabled =
    !url ||
    !duration ||
    mediaState === "failed" ||
    (memoryLocked && !allowReplay);
  useEffect(() => {
    setAllowReplay(false);
  }, [memoryLocked, lessonId]);
  useEffect(() => {
    onAudioAvailable(!!url && duration > 0 && mediaState !== "failed");
    return () => onAudioAvailable(false);
  }, [url, duration, mediaState, onAudioAvailable]);
  useEffect(() => {
    let current = "";
    let alive = true;
    setTime(0);
    setDuration(0);
    setLoopId("");
    setLoopLesson(false);
    setUrl("");
    setMediaState("empty");
    setError("");
    setSourceReview(false);
    if (repository && !data?.audioName) {
      setUrl(mediaUrl(repository.audio.path));
      setMediaState("loading");
      const element = audio.current;
      return () => {
        alive = false;
        element?.pause();
      };
    }
    loadMedia(`${lessonId}:audio`)
      .then((blob) => {
        if (!alive) return;
        if (blob) {
          current = URL.createObjectURL(blob);
          setUrl(current);
          setMediaState("ready");
        } else if (repository) {
          setUrl(mediaUrl(repository.audio.path));
          setMediaState("loading");
          setError(
            "Your local replacement is unavailable. Using repository audio; check that it matches your subtitles.",
          );
        } else if (data?.audioName)
          setError("Your local audio is unavailable. Choose the file again.");
      })
      .catch((e) => {
        if (alive) setError(String(e));
      });
    return () => {
      alive = false;
      if (current) URL.revokeObjectURL(current);
    };
  }, [lessonId, data?.audioName, reload, repository]);
  useEffect(() => {
    if (memoryLocked && !allowReplay) audio.current?.pause();
  }, [memoryLocked, allowReplay]);
  function patch(fn: (im: LocalImport) => LocalImport) {
    update((s) => {
      const current = s.imports.find((x) => x.lessonId === lessonId) || {
        lessonId,
        sources: [],
        segments: [],
        metadata: {},
        warnings: [],
        audioAccent: "unknown" as const,
      };
      const next = fn(current);
      return {
        ...s,
        imports: [...s.imports.filter((x) => x.lessonId !== lessonId), next],
      };
    });
  }
  function readAudioDuration() {
    const element = audio.current;
    const d = element?.duration;
    // Some media engines report no usable duration until a later durationchange.
    // Never replace a previously verified duration with a transient 0/NaN/Infinity.
    if (
      !element ||
      !url ||
      element.currentSrc !== new URL(url, location.href).href ||
      element.readyState < 1 ||
      !Number.isFinite(d) ||
      !d ||
      d <= 0
    )
      return;
    setDuration(d);
    setMediaState((current) =>
      current === "empty" || current === "loading" ? "ready" : current,
    );
    if (data?.audioDuration !== d) patch((im) => ({ ...im, audioDuration: d }));
  }
  useEffect(() => {
    if (!url || duration > 0 || mediaState === "failed") return;
    // Reconcile real media state when an engine omits or delivers readiness events early.
    // This checks local DOM metadata only; it never plays audio or requests tutor help.
    readAudioDuration();
    const timer = setInterval(readAudioDuration, 200);
    return () => clearInterval(timer);
  }, [url, duration, mediaState, data?.audioDuration]);
  async function importLrc(file: File) {
    setImporting(true);
    setError("");
    try {
      const sourceId = `local-lrc-${uid()}`;
      const input = await file.text();
      const parsed = parseLrc(input, lessonId, sourceId);
      const hash = await digest(input);
      setTranscriptError("");
      patch((im) => ({
        ...im,
        ...parsed,
        sources: [
          ...im.sources.filter((x) => x.kind !== "timed_transcript"),
          {
            id: sourceId,
            lessonId,
            kind: "timed_transcript",
            accessMode: "user_local_import",
            rightsStatus: "unverified",
            sha256: hash,
            fileName: file.name,
            importedAt: now(),
          },
        ],
      }));
      onSelect([]);
      setSourceReview(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setImporting(false);
    }
  }
  async function importAudio(file: File) {
    setImporting(true);
    setError("");
    try {
      if (!/\.mp3$/i.test(file.name)) throw new Error("Select an MP3 file.");
      if (file.size > 100_000_000)
        throw new Error("Audio exceeds 100 MB. Use a smaller MP3.");
      const testUrl = URL.createObjectURL(file);
      try {
        await new Promise<void>((resolve, reject) => {
          const test = new Audio();
          const cleanup = () => {
            clearTimeout(timer);
            test.onloadedmetadata = null;
            test.onerror = null;
            test.pause();
            test.removeAttribute("src");
            test.load();
          };
          const timer = setTimeout(() => {
            cleanup();
            reject(
              new Error("Audio metadata could not load. Re-export your MP3."),
            );
          }, 10000);
          test.onloadedmetadata = () => {
            const valid = Number.isFinite(test.duration) && test.duration > 0;
            cleanup();
            if (!valid) reject(new Error("Invalid audio duration."));
            else resolve();
          };
          test.onerror = () => {
            cleanup();
            reject(
              new Error(
                "This browser cannot decode the MP3. Re-export or choose another file.",
              ),
            );
          };
          test.src = testUrl;
        });
      } finally {
        URL.revokeObjectURL(testUrl);
      }
      await saveMedia(`${lessonId}:audio`, file);
      const hash = await digest(await file.arrayBuffer());
      patch((im) => ({
        ...im,
        audioName: file.name,
        audioAccent: accent,
        sources: [
          ...im.sources.filter((x) => x.kind !== "audio"),
          {
            id: `local-audio-${uid()}`,
            lessonId,
            kind: "audio",
            accessMode: "user_local_import",
            rightsStatus: "unverified",
            accent,
            sha256: hash,
            fileName: file.name,
            importedAt: now(),
          },
        ],
      }));
      setReload((x) => x + 1);
    } catch (e) {
      setError(String(e));
    } finally {
      setImporting(false);
    }
  }
  async function play() {
    const el = audio.current;
    if (!el || audioDisabled) return;
    try {
      if (el.paused) {
        await el.play();
      } else el.pause();
    } catch (e) {
      setError(
        `Playback could not start. Tap Play again or re-import the MP3. ${String(e)}`,
      );
      setMediaState("failed");
    }
  }
  function seek(t: number) {
    if (audio.current && !audioDisabled)
      audio.current.currentTime = Math.max(0, Math.min(duration, t));
  }
  function tick() {
    const el = audio.current;
    if (!el) return;
    const loop = segments.find((s) => s.id === loopId);
    const bounds = loop && loopBounds(loop, el.duration);
    if (bounds && el.currentTime >= bounds[1]) el.currentTime = bounds[0];
    setTime(el.currentTime);
  }
  function toggleLoop() {
    if (loopId) {
      setLoopId("");
      return;
    }
    const segment = active || segments.find((s) => selected.includes(s.id));
    if (!segment) {
      setError("Select or play a subtitle line first.");
      return;
    }
    const bounds = loopBounds(segment, duration);
    if (!bounds) {
      setError(
        "This line has no safe loop boundary. Review timestamps or import audio.",
      );
      return;
    }
    setLoopLesson(false);
    setLoopId(segment.id);
    seek(bounds[0]);
  }
  async function toggleLessonLoop() {
    setLoopId("");
    if (loopLesson) {
      setLoopLesson(false); // Playback continues; it just stops repeating.
      return;
    }
    setLoopLesson(true);
    const el = audio.current;
    if (!el || audioDisabled) return;
    // Start the whole lesson from the beginning, as the button promises.
    el.loop = true;
    el.currentTime = 0;
    if (!el.paused) return;
    try {
      await el.play();
    } catch (e) {
      setError(
        `Playback could not start. Tap Play again or re-import the MP3. ${String(e)}`,
      );
      setMediaState("failed");
    }
  }
  function reviewSegment(id: string, role: Segment["role"], confirmed = false) {
    patch((im) => ({
      ...im,
      segments: im.segments.map((s) =>
        s.id === id
          ? {
              ...s,
              role,
              reviewStatus: confirmed
                ? role === "lesson_body"
                  ? "confirmed"
                  : "excluded"
                : "pending",
            }
          : s,
      ),
    }));
  }
  const outOfBounds =
    duration > 0 && segments.some((s) => s.startMs / 1000 >= duration);
  const lessonSources = sources.filter((s) => s.lessonId === lessonId);
  return (
    <section className="panel player-panel" aria-label="Audio and transcript">
      <div className="section-heading">
        <span className="eyebrow">
          <Headphones size={16} /> LISTEN & NOTICE
        </span>
        <span className="badge">
          {!data?.audioName && repository
            ? "US · repository source"
            : data?.audioAccent === "us"
              ? "US · user selected"
              : data?.audioAccent === "uk"
                ? "UK · user selected"
                : "Accent not verified"}
        </span>
      </div>
      <h2>Your listening space</h2>
      <p className="muted">
        Repository audio and subtitles load here automatically. Press Play to
        listen.
      </p>
      <details
        className="source-manager"
        open={!repository && !data?.audioName && !segments.length}
      >
        <summary>
          <Upload size={16} /> Optional local files & sources
        </summary>
        <div className="import-grid">
          <label className="file-button">
            Import MP3
            <input
              aria-label="Import MP3"
              type="file"
              accept=".mp3,audio/mpeg"
              disabled={importing}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importAudio(f);
                e.target.value = "";
              }}
            />
          </label>
          <label className="file-button">
            Import LRC
            <input
              aria-label="Import LRC"
              type="file"
              accept=".lrc,text/plain"
              disabled={importing}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importLrc(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <label>
          Accent of your next audio import
          <select
            value={accent}
            onChange={(e) => setAccent(e.target.value as typeof accent)}
          >
            <option value="us">American English (US)</option>
            <option value="uk">British English (UK)</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <p className="small">
          Only select files you have the right to use. Re-importing replaces
          this lesson’s matching resource, never uploads it. Accent is your
          label, not an automatic voice assessment.
        </p>
        {lessonSources.map((s) => (
          <p className="source-path" key={s.id}>
            <a href={s.originalUrl} target="_blank" rel="noreferrer">
              {s.relativePath?.split("/").at(-1)}
            </a>{" "}
            ·{" "}
            {s.accessMode === "user_repository_hosted"
              ? "repository resource"
              : "reference only"}{" "}
            · rights unverified
          </p>
        ))}
        <p className="small">
          Audio:{" "}
          {data?.audioName || (repository ? "repository audio" : "unavailable")}{" "}
          · Timed lines: {segments.length}
        </p>
        <div className="button-row">
          <button
            disabled={!data?.audioName}
            onClick={() => {
              void deleteMedia(`${lessonId}:audio`)
                .then(() => {
                  patch((im) => ({
                    ...im,
                    audioName: undefined,
                    sources: im.sources.filter((s) => s.kind !== "audio"),
                  }));
                  setReload((x) => x + 1);
                })
                .catch((e) => setError(String(e)));
            }}
          >
            Use repository audio
          </button>
          <button
            disabled={!segments.length}
            onClick={() => {
              patch((im) => ({
                ...im,
                segments: [],
                metadata: {},
                warnings: [],
                sources: im.sources.filter(
                  (s) => s.kind !== "timed_transcript",
                ),
              }));
              onSelect([]);
            }}
          >
            Reload repository subtitles
          </button>
        </div>
      </details>
      {importing && <p role="status">Checking and saving your file…</p>}
      {loadingTranscript && !segments.length && (
        <p role="status">Loading repository subtitles…</p>
      )}
      {transcriptError && (
        <p className="notice error" role="alert">
          {transcriptError}{" "}
          <button onClick={() => setTranscriptReload((x) => x + 1)}>
            Retry subtitles
          </button>
        </p>
      )}
      {error && repository && (
        <button
          onClick={() => {
            if (repository && !data?.audioName) {
              setError("");
              setMediaState("loading");
              audio.current?.load();
            } else setReload((x) => x + 1);
          }}
        >
          Retry audio
        </button>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {outOfBounds && (
        <p className="notice">
          Some timestamps exceed the audio duration. Re-match the MP3/LRC before
          practicing those lines.
        </p>
      )}
      <audio
        controls={!!url && (!memoryLocked || allowReplay)}
        ref={audio}
        src={url || undefined}
        loop={loopLesson}
        data-media-state={mediaState}
        data-known-duration={duration}
        data-memory-locked={memoryLocked && !allowReplay}
        preload="metadata"
        onLoadedMetadata={readAudioDuration}
        onDurationChange={readAudioDuration}
        onLoadedData={readAudioDuration}
        onCanPlay={readAudioDuration}
        onTimeUpdate={tick}
        onPlay={() => setMediaState("playing")}
        onPause={() => setMediaState("paused")}
        onEnded={() => {
          const seg = segments.find((s) => s.id === loopId);
          if (seg && audio.current) {
            const bounds = loopBounds(seg, audio.current.duration);
            if (bounds) {
              audio.current.currentTime = bounds[0];
              void audio.current.play().catch(() => setMediaState("failed"));
              return;
            }
          }
          setMediaState("ended");
        }}
        onError={() => {
          if (url) {
            setMediaState("failed");
            setError(
              "Audio could not load or decode. Check your connection and retry.",
            );
          }
        }}
      />
      {memoryLocked && (
        <label className="check">
          <input
            type="checkbox"
            checked={allowReplay}
            onChange={(e) => setAllowReplay(e.target.checked)}
          />{" "}
          Allow replay during memory recall
        </label>
      )}
      <div className="play-controls">
        <button
          className="icon-button"
          aria-label="Back 5 seconds"
          disabled={audioDisabled}
          onClick={() => seek(time - 5)}
        >
          <SkipBack size={18} />
        </button>
        <button
          className="play-button"
          aria-label={mediaState === "playing" ? "Pause" : "Play"}
          disabled={audioDisabled || mediaState === "failed"}
          onClick={() => void play()}
        >
          {mediaState === "playing" ? <Pause /> : <Play />}
        </button>
        <button
          className="icon-button"
          aria-label="Forward 5 seconds"
          disabled={audioDisabled}
          onClick={() => seek(time + 5)}
        >
          <SkipForward size={18} />
        </button>
        <span className="time-readout">
          {stamp(time)} / {stamp(duration)}
        </span>
        <select
          aria-label="Playback speed"
          defaultValue="1"
          onChange={(e) => {
            if (audio.current)
              audio.current.playbackRate = Number(e.target.value);
          }}
        >
          {["0.5", "0.75", "1", "1.25", "1.5", "2"].map((rate) => (
            <option key={rate} value={rate}>
              {rate}×
            </option>
          ))}
        </select>
      </div>
      <input
        className="seek"
        aria-label="Audio progress"
        type="range"
        min="0"
        max={duration || 1}
        step="0.01"
        value={Math.min(time, duration || 1)}
        disabled={audioDisabled}
        onChange={(e) => seek(Number(e.target.value))}
      />
      <div className="button-row">
        <button
          aria-pressed={settings.subtitleVisible}
          onClick={() =>
            update((s) => ({
              ...s,
              settings: {
                ...s.settings,
                subtitleVisible: !s.settings.subtitleVisible,
              },
            }))
          }
        >
          {settings.subtitleVisible ? <EyeOff size={16} /> : <Eye size={16} />}{" "}
          {settings.subtitleVisible ? "Hide subtitles" : "Show subtitles"}
        </button>
        <button
          disabled={audioDisabled || !segments.length}
          aria-pressed={!!loopId}
          onClick={toggleLoop}
        >
          <Repeat size={16} />
          {loopId ? "Stop loop" : "Loop line"}
        </button>
        <button
          disabled={audioDisabled}
          aria-pressed={loopLesson}
          onClick={() => void toggleLessonLoop()}
        >
          <Repeat size={16} />
          {loopLesson ? "Stop lesson loop" : "Loop lesson"}
        </button>
      </div>
      <label className="check small">
        <input
          type="checkbox"
          checked={settings.currentLineOnly}
          onChange={(e) =>
            update((s) => ({
              ...s,
              settings: { ...s.settings, currentLineOnly: e.target.checked },
            }))
          }
        />{" "}
        Current line only
      </label>
      {!segments.length ? (
        <div className="empty-state">
          Subtitles are not available yet. Retry loading them or choose an
          optional local LRC.
        </div>
      ) : settings.subtitleVisible ? (
        <div className="transcript" aria-label="Transcript">
          {segments
            .filter((s) => !settings.currentLineOnly || s.id === active?.id)
            .map((s) => (
              <div
                className={`transcript-row ${s.id === active?.id ? "active" : ""} ${selected.includes(s.id) ? "selected" : ""}`}
                key={s.id}
                data-testid="transcript-row"
              >
                <label className="segment-check">
                  <input
                    aria-label={`Select line ${s.sourceLine}`}
                    type="checkbox"
                    checked={selected.includes(s.id)}
                    onChange={(e) =>
                      onSelect(
                        e.target.checked
                          ? [...selected, s.id]
                          : selected.filter((id) => id !== s.id),
                      )
                    }
                  />
                </label>
                <button
                  disabled={audioDisabled}
                  onClick={() => seek(s.startMs / 1000)}
                >
                  <span className="line-time">{stamp(s.startMs / 1000)}</span>
                  <span>{s.text}</span>
                </button>
                <span className="line-role">
                  {s.reviewStatus === "confirmed"
                    ? "body"
                    : s.role === "intro_question"
                      ? "question"
                      : "unreviewed"}
                </span>
              </div>
            ))}
        </div>
      ) : (
        <div className="empty-state" data-testid="subtitles-hidden">
          Subtitles hidden. Keep your attention on what you hear.
        </div>
      )}
      {segments.length > 0 && (
        <>
          <button
            className="text-button"
            aria-expanded={sourceReview}
            onClick={() => setSourceReview((x) => !x)}
          >
            {sourceReview ? "Close" : "Open"} source & body review ·{" "}
            {
              segments.filter(
                (s) =>
                  s.reviewStatus === "confirmed" && s.role === "lesson_body",
              ).length
            }{" "}
            confirmed
          </button>
          {sourceReview && (
            <div className="source-review">
              <p className="small">
                Only confirmed lesson-body lines become a dictation reference.
                Questions and narration stay separate. Selecting “body” and
                clicking Confirm is your review decision.
              </p>
              {data?.warnings.map((w, i) => (
                <p className="notice small" key={i}>
                  {w}
                </p>
              ))}
              {segments.map((s) => (
                <div className="review-line" key={s.id}>
                  <p>
                    <span className="small muted">
                      Source line {s.sourceLine} · {stamp(s.startMs / 1000)}
                    </span>
                    <br />
                    {s.text}
                  </p>
                  <select
                    aria-label={`Role line ${s.sourceLine}`}
                    value={s.role}
                    onChange={(e) =>
                      reviewSegment(s.id, e.target.value as Segment["role"])
                    }
                  >
                    <option value="unreviewed">Unreviewed</option>
                    <option value="lesson_body">Lesson body</option>
                    <option value="intro_question">Intro question</option>
                    <option value="other">Other</option>
                  </select>
                  <button
                    onClick={() => reviewSegment(s.id, s.role, true)}
                    disabled={s.role === "unreviewed"}
                  >
                    {s.reviewStatus === "pending" ? "Confirm" : "Confirmed"}
                  </button>
                </div>
              ))}
              <button
                disabled={!selected.length}
                onClick={() =>
                  patch((im) => ({
                    ...im,
                    segments: im.segments.map((s) =>
                      selected.includes(s.id)
                        ? {
                            ...s,
                            role: "lesson_body",
                            reviewStatus: "confirmed",
                          }
                        : s,
                    ),
                  }))
                }
              >
                Confirm selected lines as body
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
