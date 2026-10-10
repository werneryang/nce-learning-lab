import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { Session } from "@supabase/supabase-js";
import { StateSchema } from "../shared/schema";
import type { State } from "../shared/schema";
import { loadSyncMeta, saveSyncMeta } from "../storage/db";
import { cloudConfigured } from "./config";
import { fetchRemote, insertRemote, updateRemote, watchSession } from "./cloud";
import type { RemoteRow } from "./cloud";
import { fingerprint, isBlank, planSync } from "./plan";
export type SyncStatus =
  | "off" // not configured for this site
  | "signed_out"
  | "syncing"
  | "synced"
  | "conflict"
  | "offline"
  | "error";
export type Resolution = "cloud" | "device";
const pushDelayMs = 3000;
export function useCloudSync({
  ready,
  state,
  ref,
  update,
  flush,
}: {
  ready: boolean;
  state: State;
  ref: MutableRefObject<State>;
  update: (fn: (s: State) => State) => void;
  flush: () => Promise<boolean>;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SyncStatus>(
    cloudConfigured ? "signed_out" : "off",
  );
  const [message, setMessage] = useState("");
  const [lastSynced, setLastSynced] = useState("");
  const [conflict, setConflict] = useState<RemoteRow>();
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const conflictRef = useRef(conflict);
  conflictRef.current = conflict;
  const running = useRef(false);
  const again = useRef(false);
  const pendingChoice = useRef<Resolution>(undefined);
  useEffect(() => {
    if (!cloudConfigured) return;
    let stop: (() => void) | undefined;
    let alive = true;
    watchSession((s) => {
      if (!alive) return;
      setSession(s);
      if (!s) setStatus("signed_out");
    })
      .then((unsubscribe) => {
        if (alive) stop = unsubscribe;
        else unsubscribe();
      })
      .catch((e) => {
        setStatus("error");
        setMessage(String(e));
      });
    return () => {
      alive = false;
      stop?.();
    };
  }, []);
  const sync = useCallback(
    async (resolution?: Resolution) => {
      const user = sessionRef.current?.user;
      if (!user || !ready) return;
      if (conflictRef.current && !resolution) return; // waits for the user's choice
      if (running.current) {
        if (resolution) pendingChoice.current = resolution;
        else again.current = true;
        return;
      }
      running.current = true;
      setStatus("syncing");
      try {
        await flush();
        let meta = await loadSyncMeta();
        if (meta?.userId !== user.id) meta = undefined; // new device or account
        const local = StateSchema.parse(ref.current);
        const localHash = await fingerprint(local);
        const dirty = meta ? localHash !== meta.syncedHash : !isBlank(local);
        const remote = await fetchRemote(user.id);
        let remoteState: State | undefined;
        if (remote) {
          const parsed = StateSchema.safeParse(remote.state);
          if (!parsed.success && resolution !== "device")
            throw new Error(
              "The cloud copy failed validation, so it was not applied. Choose “Keep this device's copy” to replace it.",
            );
          remoteState = parsed.success ? parsed.data : undefined;
        }
        let plan = planSync({
          remote: remote && {
            revision: remote.revision,
            blank: !remoteState || isBlank(remoteState),
          },
          baseRevision: meta?.baseRevision ?? 0,
          dirty,
          localBlank: isBlank(local),
        });
        if (resolution === "cloud") plan = remote ? "apply" : "upload";
        if (resolution === "device") plan = remote ? "push" : "upload";
        const record = async (revision: number, hash: string) => {
          const syncedAt = new Date().toISOString();
          await saveSyncMeta({
            userId: user.id,
            baseRevision: revision,
            syncedHash: hash,
            syncedAt,
          });
          setLastSynced(syncedAt);
        };
        if (plan === "conflict") {
          setConflict(remote!);
          setStatus("conflict");
          return;
        }
        if (plan === "apply") {
          // Never overwrite edits made while the cloud copy was downloading.
          if ((await fingerprint(ref.current)) !== localHash) {
            again.current = true;
            return;
          }
          update(() => remoteState!);
          await flush();
          await record(remote!.revision, await fingerprint(remoteState!));
        } else if (plan === "upload" || plan === "push") {
          const saved =
            plan === "upload"
              ? await insertRemote(user.id, local)
              : await updateRemote(user.id, local, remote!.revision);
          if (saved === "conflict") {
            // Another device wrote first; re-read and decide again.
            again.current = true;
            return;
          }
          await record(saved.revision, localHash);
        } else if (meta) setLastSynced(meta.syncedAt);
        setConflict(undefined);
        setStatus("synced");
        setMessage("");
      } catch (e) {
        setStatus(navigator.onLine ? "error" : "offline");
        setMessage(e instanceof Error ? e.message : String(e));
      } finally {
        running.current = false;
        const choice = pendingChoice.current;
        pendingChoice.current = undefined;
        if (choice) void sync(choice);
        else if (again.current) {
          again.current = false;
          setTimeout(() => void sync(), 500);
        }
      }
    },
    [ready, flush, ref, update],
  );
  const userId = session?.user.id;
  useEffect(() => {
    if (userId && ready) void sync();
  }, [userId, ready, sync]);
  useEffect(() => {
    if (!userId || !ready) return;
    const timer = setTimeout(() => void sync(), pushDelayMs);
    return () => clearTimeout(timer);
  }, [state, userId, ready, sync]);
  useEffect(() => {
    if (!userId) return;
    const run = () => void sync();
    // Pick up changes from other devices when returning, push before leaving.
    document.addEventListener("visibilitychange", run);
    window.addEventListener("online", run);
    return () => {
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("online", run);
    };
  }, [userId, sync]);
  return {
    configured: cloudConfigured,
    email: session?.user.email,
    signedIn: !!session,
    status,
    message,
    lastSynced,
    conflict,
    syncNow: () => sync(),
    resolve: (choice: Resolution) => sync(choice),
  };
}
export type CloudSync = ReturnType<typeof useCloudSync>;
