# Cloud sync (optional)

Cloud sync keeps the learning state (drafts, confirmed subtitle lines, chunks, mistakes, attempts, mastery, preferences) in step across devices signed in to the same account. Audio — imported MP3s and speaking recordings — is never uploaded. Without signing in, the app behaves exactly as before and never contacts the sync server.

## How it works

- Storage: one Supabase table, `learning_state`, with one row per account holding the whole state as JSON plus a `revision` number. Row Level Security limits every row to its owner (`supabase/schema.sql`).
- Sign-in: email one-time code (not a magic link), so it also works inside an iPhone home-screen app, where links open in Safari instead.
- IndexedDB stays the primary store. Sync runs about 3 seconds after changes, when the page becomes visible or hidden, when the network returns, and on “Sync now”.
- Each device remembers the cloud revision it last synced and a hash of the state it synced. From these it decides:
  - cloud unchanged, device changed → upload (only if the cloud is still at that revision; otherwise re-check);
  - cloud changed, device unchanged → download and replace local state;
  - both changed → stop and ask: “Use cloud copy” or “Keep this device's copy”. Nothing is merged or discarded silently.
- A device with no records adopts an existing cloud copy; an empty cloud copy is simply overwritten.
- Deleting local data while signed in keeps the cloud copy, which downloads again. Restoring a backup replaces local state and is then uploaded.

## One-time Supabase setup

1. SQL Editor → run `supabase/schema.sql`.
2. Authentication → Sign In / Providers → Email: enabled.
3. Authentication → Email Templates → Magic Link: include `{{ .Token }}` in the message so the email shows the code.
4. Project Settings → API: put the Project URL and the publishable (or legacy anon) key in `src/sync/config.ts`. Both are public by design; access is enforced by Row Level Security.
5. After signing in on your devices, consider Authentication → Sign In / Providers → turn off “Allow new users to sign up”, so no one else can create an account in the project.

## Tests

`tests/sync.test.ts` covers the sync decisions and hash stability. `tests/e2e/sync.spec.ts` runs two browser contexts against a mocked Supabase API: upload, download, a change travelling back, a conflict resolved by the user, and no network calls when signed out.
