import { openDB } from "idb";
import { StateSchema, emptyState } from "../shared/schema";
import type { State } from "../shared/schema";
const db = () =>
  openDB("nce-learning-lab", 1, {
    upgrade(database) {
      database.createObjectStore("state");
      database.createObjectStore("media");
    },
  });
let writeQueue = Promise.resolve();
export async function loadState() {
  const database = await db();
  const state = await database.get("state", "current");
  return state ? StateSchema.parse(state) : emptyState();
}
export function saveState(state: State) {
  const snapshot = StateSchema.parse(structuredClone(state));
  const write = writeQueue
    .catch(() => {})
    .then(async () => {
      const database = await db();
      await database.put("state", snapshot, "current");
    });
  writeQueue = write;
  return write;
}
export async function saveMedia(key: string, blob: Blob) {
  const database = await db();
  // ArrayBuffer storage avoids WebKit failures serializing imported File/Blob objects.
  await database.put(
    "media",
    { bytes: await blob.arrayBuffer(), type: blob.type },
    key,
  );
}
export async function loadMedia(key: string): Promise<Blob | undefined> {
  const database = await db();
  const stored = await database.get("media", key);
  if (!stored) return undefined;
  if (stored instanceof Blob) return stored;
  if (!(stored.bytes instanceof ArrayBuffer) || typeof stored.type !== "string")
    throw new Error("Stored media is invalid; please re-import it.");
  return new Blob([stored.bytes], { type: stored.type });
}
export async function deleteMedia(key: string) {
  const database = await db();
  await database.delete("media", key);
}
export async function clearPrivateData() {
  await writeQueue.catch(() => {});
  const database = await db();
  const tx = database.transaction(["state", "media"], "readwrite");
  await tx.objectStore("state").clear();
  await tx.objectStore("media").clear();
  await tx.done;
}
export async function digest(value: string | ArrayBuffer) {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function exportBackup(state: State) {
  const data = StateSchema.parse(state);
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    mediaIncluded: false,
    data,
    checksum: await digest(JSON.stringify(data)),
  };
}
export async function readBackup(input: string): Promise<State> {
  if (input.length > 10_000_000) throw new Error("Backup exceeds 10 MB.");
  const value = JSON.parse(input);
  if (value.schemaVersion !== 1 || value.mediaIncluded !== false)
    throw new Error("Unsupported backup version or media format.");
  if ((await digest(JSON.stringify(value.data))) !== value.checksum)
    throw new Error("Checksum mismatch. Backup was changed or damaged.");
  return StateSchema.parse(value.data);
}
export async function storageInfo() {
  return navigator.storage?.estimate ? navigator.storage.estimate() : {};
}
export function replaceStateAndClearMedia(state: State) {
  const snapshot = StateSchema.parse(structuredClone(state));
  const write = writeQueue
    .catch(() => {})
    .then(async () => {
      const database = await db();
      const tx = database.transaction(["state", "media"], "readwrite");
      await tx.objectStore("media").clear();
      await tx.objectStore("state").put(snapshot, "current");
      await tx.done;
    });
  writeQueue = write;
  return write;
}
