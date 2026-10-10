import { useState } from "react";
import { sendCode, signOut, verifyCode } from "../sync/cloud";
import type { CloudSync } from "../sync/useCloudSync";
export const syncLabels = {
  off: "Cloud sync off",
  signed_out: "Not signed in",
  syncing: "Syncing",
  synced: "Synced",
  conflict: "Sync conflict",
  offline: "Offline · will sync later",
  error: "Sync failed",
} as const;
export function ConflictChoice({ sync }: { sync: CloudSync }) {
  if (!sync.conflict) return null;
  return (
    <div className="notice" role="alert">
      <p>
        <strong>Both copies changed.</strong> The cloud copy was updated on
        another device ({new Date(sync.conflict.updated_at).toLocaleString()})
        while this device also has unsynced changes. Choose which one to keep;
        the other is replaced. Export learning JSON first if you want to keep
        both.
      </p>
      <div className="button-row">
        <button onClick={() => void sync.resolve("cloud")}>
          Use cloud copy
        </button>
        <button onClick={() => void sync.resolve("device")}>
          Keep this device&apos;s copy
        </button>
      </div>
    </div>
  );
}
export function CloudSyncPanel({ sync }: { sync: CloudSync }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setNote("");
    try {
      await action();
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="cloud-sync">
      <h3>Cloud sync</h3>
      {!sync.configured ? (
        <p className="small">
          Cloud sync is not set up for this site. Learning data stays in this
          browser only.
        </p>
      ) : !sync.signedIn ? (
        <>
          <p className="small">
            Sign in with your email to keep drafts and learning history in sync
            across devices. Audio files are never uploaded.
          </p>
          {!codeSent ? (
            <form
              className="button-row"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await sendCode(email.trim());
                  setCodeSent(true);
                  setNote("Code sent. Check your email.");
                });
              }}
            >
              <input
                aria-label="Email for cloud sync"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button className="primary" disabled={busy}>
                Email me a code
              </button>
            </form>
          ) : (
            <form
              className="button-row"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await verifyCode(email.trim(), code.trim());
                  setCodeSent(false);
                  setCode("");
                });
              }}
            >
              <input
                aria-label="Sign-in code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                pattern="[0-9]{6,10}"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button className="primary" disabled={busy}>
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setCodeSent(false);
                  setCode("");
                  setNote("");
                }}
              >
                Use a different email
              </button>
            </form>
          )}
        </>
      ) : (
        <>
          <p className="small" role="status" aria-label="Cloud sync status">
            Signed in as <strong>{sync.email}</strong> ·{" "}
            {syncLabels[sync.status]}
            {sync.lastSynced &&
              ` · last synced ${new Date(sync.lastSynced).toLocaleString()}`}
          </p>
          {sync.message && <p className="notice error">{sync.message}</p>}
          <ConflictChoice sync={sync} />
          <div className="button-row">
            <button
              disabled={busy || sync.status === "conflict"}
              onClick={() => void sync.syncNow()}
            >
              Sync now
            </button>
            <button disabled={busy} onClick={() => void run(signOut)}>
              Sign out
            </button>
          </div>
          <p className="small">
            Synced: drafts, confirmed subtitle lines, chunks, mistakes, attempts
            and preferences. Not synced: imported or recorded audio. Signing out
            keeps this device&apos;s copy.
          </p>
        </>
      )}
      {note && (
        <p className="notice" role="status">
          {note}
        </p>
      )}
    </div>
  );
}
