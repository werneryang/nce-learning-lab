import { useEffect, useState } from "react";
import type { State } from "../shared/schema";
import { emptyState } from "../shared/schema";
import {
  exportBackup,
  readBackup,
  clearPrivateData,
  storageInfo,
  replaceStateAndClearMedia,
} from "../storage/db";
import { manifest } from "../shared/content";
import { addSummary, emptySummary, mergeStates } from "./merge";
import type { MergeSummary } from "./merge";
import {
  backupFileName,
  cleanDeviceName,
  loadDeviceName,
  saveDeviceName,
} from "./device";
type MergePlan = {
  files: { name: string; sessions: number }[];
  backups: State[];
  summary: MergeSummary;
};
function describe(summary: MergeSummary) {
  const parts = [
    [summary.sessionsAdded, "new practice session"],
    [summary.sessionsUpdated, "updated practice session"],
    [summary.chunksAdded, "new chunk"],
    [summary.mistakesAdded, "new mistake"],
    [summary.attemptsAdded, "new attempt"],
  ] as const;
  const text = parts
    .filter(([n]) => n > 0)
    .map(([n, label]) => `${n} ${label}${n === 1 ? "" : "s"}`)
    .join(", ");
  return text || "nothing new — this device already has these records";
}
export function Settings({
  state,
  update,
  flush,
  onStorageRecover,
}: {
  state: State;
  update: (fn: (s: State) => State) => void;
  flush: () => Promise<boolean>;
  onStorageRecover: () => void;
}) {
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [restore, setRestore] = useState<State>();
  const [deviceName, setDeviceName] = useState(loadDeviceName);
  const [merge, setMerge] = useState<MergePlan>();
  const [usage, setUsage] = useState<{ usage?: number; quota?: number }>({});
  useEffect(() => {
    void storageInfo()
      .then(setUsage)
      .catch(() => {});
  }, []);
  async function backup() {
    try {
      await flush();
      const backup = await exportBackup(state);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(backup, null, 2)], {
          type: "application/json",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = backupFileName(deviceName);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(
        "Backup downloaded. It includes imported text and private history, but excludes all audio. Keep it private.",
      );
    } catch (e) {
      setMessage(String(e));
    }
  }
  async function readForMerge(files: File[]) {
    try {
      setRestore(undefined);
      const backups: State[] = [];
      let merged = state;
      let summary = emptySummary();
      for (const file of files) {
        if (file.size > 10_000_000)
          throw new Error(`${file.name} exceeds 10 MB.`);
        const backup = await readBackup(await file.text()).catch((e) => {
          throw new Error(
            `${file.name}: ${e instanceof Error ? e.message : e}`,
          );
        });
        backups.push(backup);
        const result = mergeStates(merged, backup);
        merged = result.state;
        summary = addSummary(summary, result.summary);
      }
      setMerge({
        files: files.map((f, i) => ({
          name: f.name,
          sessions: backups[i].sessions.length,
        })),
        backups,
        summary,
      });
      setMessage("");
    } catch (e) {
      setMerge(undefined);
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }
  async function applyMerge(plan: MergePlan) {
    try {
      // Merge into the latest state, in case it changed since the preview.
      let merged = state;
      let summary = emptySummary();
      for (const backup of plan.backups) {
        const result = mergeStates(merged, backup);
        merged = result.state;
        summary = addSummary(summary, result.summary);
      }
      update(() => merged);
      if (!(await flush())) throw new Error("Merged, but saving failed.");
      setMerge(undefined);
      setMessage(
        `Merged ${plan.files.length} backup${plan.files.length === 1 ? "" : "s"}: ${describe(summary)}.`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }
  async function read(file: File) {
    try {
      if (file.size > 10_000_000) throw new Error("Backup exceeds 10 MB.");
      setRestore(await readBackup(await file.text()));
      setMessage(
        "Checksum and schema verified. Restore will replace current records; stored audio will be cleared to avoid incorrect file pairings; repository audio remains available; choose any local replacement again. Export first if you need the current records.",
      );
    } catch (e) {
      setMessage(String(e));
    }
  }
  return (
    <section className="panel">
      <span className="eyebrow">YOUR DATA, YOUR DEVICE</span>
      <h2>Settings & backup</h2>
      <p className="muted">
        IndexedDB stores your learning data and imported media in this browser.
        Clearing browser data can remove it. Mac and iPhone do not synchronize
        on their own: export on one, then merge that file on the other.
      </p>
      <p className="small">
        Storage:{" "}
        {usage.usage === undefined
          ? "estimate unavailable"
          : `${(usage.usage / 1e6).toFixed(1)} MB used`}{" "}
        {usage.quota !== undefined && `of ${(usage.quota / 1e6).toFixed(0)} MB`}
        . Private browsing and eviction can shorten retention.
      </p>
      <label className="device-name">
        This device&apos;s name{" "}
        <input
          aria-label="Device name"
          value={deviceName}
          maxLength={40}
          onChange={(e) => setDeviceName(e.target.value)}
          onBlur={() => {
            const clean = cleanDeviceName(deviceName);
            setDeviceName(clean);
            saveDeviceName(clean);
          }}
        />
      </label>
      <p className="small">
        Exports are named like <code>{backupFileName(deviceName)}</code>, so
        each device&apos;s files are easy to tell apart in iCloud Drive.
      </p>
      <div className="button-row">
        <button
          className="primary"
          onClick={() => {
            saveDeviceName(deviceName);
            void backup();
          }}
        >
          Export learning JSON
        </button>
        <label className="file-button">
          Merge backups
          <input
            aria-label="Merge backups"
            type="file"
            multiple
            accept=".json,application/json"
            onChange={(e) => {
              const files = [...(e.target.files || [])];
              if (files.length) void readForMerge(files);
              e.target.value = "";
            }}
          />
        </label>
        <label className="file-button">
          Replace with backup
          <input
            aria-label="Replace with backup"
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setMerge(undefined);
              if (f) void read(f);
              e.target.value = "";
            }}
          />
        </label>
        <button
          onClick={() => {
            void navigator.storage
              ?.persist?.()
              .then((ok) =>
                setMessage(
                  ok
                    ? "Persistent storage granted. Still keep independent backups."
                    : "Browser did not grant persistence; keep regular backups.",
                ),
              );
          }}
        >
          Request persistent storage
        </button>
      </div>
      <p className="small">
        JSON contains drafts, confirmed transcript text, sources, chunks,
        mistakes, attempts, tutor history and preferences. MP3 and speaking
        recordings are excluded. <strong>Merge backups</strong> adds records
        from other devices&apos; exports (select several at once) and keeps the
        newer edit when both have the same record; this device&apos;s
        preferences and local audio stay. Deleted records come back if another
        backup still has them. <strong>Replace with backup</strong> swaps all
        records for one backup.
      </p>
      {merge && (
        <div className="notice">
          <p>
            Checked {merge.files.length} backup
            {merge.files.length === 1 ? "" : "s"}:
          </p>
          <ul>
            {merge.files.map((f) => (
              <li key={f.name}>
                {f.name} · {f.sessions} sessions
              </li>
            ))}
          </ul>
          <p>Merging adds {describe(merge.summary)}.</p>
          <div className="button-row">
            <button className="primary" onClick={() => void applyMerge(merge)}>
              Merge into this device
            </button>
            <button onClick={() => setMerge(undefined)}>Cancel merge</button>
          </div>
        </div>
      )}
      {restore && (
        <div className="notice">
          <p>
            {restore.sessions.length} sessions · {restore.chunks.length} chunks
            · {restore.mistakes.length} mistakes
          </p>
          <div className="button-row">
            <button
              onClick={() => {
                void replaceStateAndClearMedia(restore)
                  .then(() => {
                    update(() => restore);
                    onStorageRecover();
                    setRestore(undefined);
                    setMessage(
                      "Restored and persisted. Repository audio is available; local replacements may need choosing again.",
                    );
                  })
                  .catch((e) => setMessage(String(e)));
              }}
            >
              Replace records with verified backup
            </button>
            <button onClick={() => setRestore(undefined)}>
              Cancel restore
            </button>
          </div>
        </div>
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={state.settings.chinese}
          onChange={(e) =>
            update((s) => ({
              ...s,
              settings: { ...s.settings, chinese: e.target.checked },
            }))
          }
        />{" "}
        Show Chinese explanations for chunks
      </label>
      <details>
        <summary>AI, privacy & copyright</summary>
        <p>
          <strong>AI Tutor not configured.</strong> No backend, API credentials,
          model billing or cloud account is configured. Local rule feedback is
          limited; semantic equivalence and naturalness remain unassessed.
          Manual ChatGPT sharing is your choice.
        </p>
        <p>
          Repository MP3/LRC resources load automatically from this site. PDFs
          are not deployed. Drafts and learning history stay in this browser.
          Subtitle text is rendered as plain text, never instructions or
          executable HTML.
        </p>
        <p>
          Source repository:{" "}
          <a
            href="https://github.com/tangx/New-Concept-English"
            target="_blank"
            rel="noreferrer"
          >
            tangx/New-Concept-English
          </a>
          . Fixed commit: <code>{manifest.repoRef}</code>. Paths verified;
          rights remain unverified. No textbook or recordings are distributed
          here.
        </p>
        <p>
          Only code, catalog metadata and original educational notes are public.
          Public server requests can still contain ordinary hosting access
          metadata; learning content is kept on your device.
        </p>
      </details>
      <div className="danger-zone">
        <h3>Delete private data</h3>
        <p>
          Removes all drafts, imported text, audio, recordings and learning
          history in this browser. Export a backup first if needed.
        </p>
        <button onClick={() => setConfirmDelete(true)}>
          Delete all local data
        </button>
        {confirmDelete && (
          <div className="notice">
            <p>This deletion cannot be undone without your backup.</p>
            <button
              onClick={() => {
                void clearPrivateData()
                  .then(() => {
                    update(() => emptyState());
                    onStorageRecover();
                    setConfirmDelete(false);
                    setMessage(
                      "All private browser records and media deleted.",
                    );
                  })
                  .catch((e) => setMessage(String(e)));
              }}
            >
              Confirm delete all
            </button>
            <button onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        )}
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
