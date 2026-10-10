import { useEffect, useRef, useState } from "react";
import type { State, Rating } from "../shared/schema";
import { uid, now } from "../shared/schema";
import { schedule } from "./schedule";
import { exercises } from "../shared/content";
import { saveMedia, loadMedia } from "../storage/db";
export function Speaking({
  state,
  update,
  lessonId,
}: {
  state: State;
  update: (fn: (s: State) => State) => void;
  lessonId: string;
}) {
  const [answer, setAnswer] = useState("");
  const [rating, setRating] = useState<Rating>("hard");
  const [message, setMessage] = useState("");
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob>();
  const [playUrl, setPlayUrl] = useState("");
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const recorder = useRef<MediaRecorder | undefined>(undefined);
  const stream = useRef<MediaStream | undefined>(undefined);
  const exercise = exercises.find(
    (e) => e.lessonId === lessonId && e.mode === "speaking",
  );
  const chunks = state.chunks.filter((c) =>
    state.links.some((l) => l.lessonId === lessonId && l.chunkId === c.id),
  );
  useEffect(
    () => () => {
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setPlayUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  async function record() {
    try {
      if (recording) {
        recorder.current?.stop();
        setRecording(false);
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error(
          "Recording is unavailable in this browser. Enter your own transcript instead.",
        );
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const rec = new MediaRecorder(stream.current);
      recorder.current = rec;
      const parts: Blob[] = [];
      rec.ondataavailable = (e) => parts.push(e.data);
      rec.onstop = () => {
        setBlob(new Blob(parts, { type: rec.mimeType }));
        stream.current?.getTracks().forEach((t) => t.stop());
        setRecording(false);
      };
      rec.start();
      setRecording(true);
    } catch (e) {
      setMessage(String(e));
    }
  }
  async function save() {
    if (!answer.trim() && !blob) {
      setMessage("Write a transcript or record your response first.");
      return;
    }
    try {
      const id = uid();
      if (blob) await saveMedia(`${id}:speaking`, blob);
      update((s) => {
        const mastery = s.mastery.filter(
          (m) => !(m.skill === "speaking" && targetIds.includes(m.chunkId)),
        );
        return {
          ...s,
          attempts: [
            ...s.attempts,
            {
              id,
              exerciseId: exercise?.id || `${lessonId}-speaking`,
              createdAt: now(),
              responseText: answer,
              localAudioRef: blob ? `${id}:speaking` : undefined,
              rating,
              skill: "speaking",
            },
          ],
          mastery: [
            ...mastery,
            ...chunks
              .filter((c) => targetIds.includes(c.id))
              .map((c) =>
                schedule(
                  c.id,
                  "speaking",
                  rating,
                  s.mastery.find(
                    (m) => m.chunkId === c.id && m.skill === "speaking",
                  ),
                ),
              ),
          ],
        };
      });
      setAnswer("");
      setBlob(undefined);
      setPlayUrl("");
      setMessage(
        "Speaking attempt saved. Your rating is separate from writing; no pronunciation score is inferred.",
      );
    } catch (e) {
      setMessage(String(e));
    }
  }
  return (
    <section className="panel">
      <span className="eyebrow">SPEAK WITHOUT THE SCRIPT</span>
      <h2>A story in your own voice</h2>
      <p>{exercise?.prompt}</p>
      <p className="muted">
        Practice aloud, then record locally or add your own transcript. No
        automatic transcription or pronunciation assessment.
      </p>
      <p className="small">
        Select the chunks you actually practiced; only selected speaking skills
        receive your self-rating.
      </p>
      <div className="lesson-tags">
        {chunks.map((c) => (
          <label className="check" key={c.id}>
            <input
              type="checkbox"
              checked={targetIds.includes(c.id)}
              onChange={(e) =>
                setTargetIds(
                  e.target.checked
                    ? [...targetIds, c.id]
                    : targetIds.filter((id) => id !== c.id),
                )
              }
            />
            {c.canonical}
          </label>
        ))}
      </div>
      <textarea
        aria-label="Speaking transcript"
        placeholder="Your own transcript or reflection…"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
      />
      <div className="button-row">
        <button onClick={() => void record()}>
          {recording ? "Stop recording" : "Record locally"}
        </button>
        <label>
          Speaking self-rating
          <select
            value={rating}
            onChange={(e) => setRating(e.target.value as Rating)}
          >
            {["again", "hard", "good", "easy"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <button
          className="primary"
          disabled={recording}
          onClick={() => void save()}
        >
          Save speaking attempt
        </button>
      </div>
      {playUrl && <audio controls src={playUrl} />}
      <p className="notice" role="status">
        {message ||
          "Microphone access is requested only after you click Record."}
      </p>
      <details>
        <summary>Speaking history</summary>
        {state.attempts
          .filter(
            (a) => a.exerciseId === exercise?.id && a.skill === "speaking",
          )
          .map((a) => (
            <article key={a.id}>
              <p>
                {new Date(a.createdAt).toLocaleString()} · {a.rating}
              </p>
              <pre>{a.responseText}</pre>
              {a.localAudioRef && (
                <button
                  onClick={() => {
                    void loadMedia(a.localAudioRef!)
                      .then((b) => {
                        if (b) setBlob(b);
                        else
                          setMessage(
                            "Recording is not in this browser. Ordinary JSON backups exclude audio.",
                          );
                      })
                      .catch((e) => setMessage(String(e)));
                  }}
                >
                  Listen to recording
                </button>
              )}
            </article>
          ))}
      </details>
    </section>
  );
}
