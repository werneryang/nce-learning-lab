import { useState } from "react";
import type { State } from "./shared/schema";
import { addVoaImports, prepareVoaPackage } from "./features/voa";
import { saveMissingVoaMedia } from "./storage/db";
export function VoaImport({
  state,
  update,
  flush,
}: {
  state: State;
  update: (fn: (s: State) => State) => void;
  flush: () => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function importFiles(files: File[]) {
    setBusy(true);
    setMessage("");
    try {
      const manifests = files.filter((f) => f.name === "library.json");
      if (manifests.length !== 1 || manifests[0].size > 5_000_000)
        throw new Error(
          "Select one library.json and its MP3 files (maximum 20 articles). ",
        );
      const prepared = await prepareVoaPackage(
        await manifests[0].text(),
        files,
      );
      addVoaImports(
        state,
        prepared.map((p) => p.item),
      ); // Validate before any media writes.
      await saveMissingVoaMedia(
        prepared.map((p) => ({
          key: `${p.item.lessonId}:audio`,
          blob: p.audio,
        })),
      );
      update((s) =>
        addVoaImports(
          s,
          prepared.map((p) => p.item),
        ),
      );
      if (!(await flush()))
        throw new Error(
          "Could not save course records. Keep this page open and check Settings storage status.",
        );
      setMessage(
        `VOA import saved locally: ${prepared.length} articles checked. Existing courses and practice preserved. Choose VOA in Collection.`,
      );
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel" aria-label="Import VOA courses">
      <h2>VOA · your local listening library</h2>
      <p>
        Import a downloader folder, or select library.json and its MP3 files
        together. NCE courses stay separate. Nothing is uploaded.
      </p>
      <div className="button-row">
        <label className="file-button">
          Import VOA folder
          <input
            type="file"
            aria-label="Import VOA folder"
            multiple
            {...{ webkitdirectory: "" }}
            disabled={busy}
            onChange={(e) => {
              void importFiles(Array.from(e.target.files || []));
              e.target.value = "";
            }}
          />
        </label>
        <label className="file-button">
          Select VOA files
          <input
            type="file"
            aria-label="Select VOA files"
            multiple
            accept=".json,.mp3"
            disabled={busy}
            onChange={(e) => {
              void importFiles(Array.from(e.target.files || []));
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {busy && <p role="status">Checking files and saving locally…</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
