import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { cloudConfigured, supabaseKey, supabaseUrl } from "./config";
let client: Promise<SupabaseClient> | undefined;
/** Loaded on demand so the app never contacts Supabase unless sync is set up. */
function cloud() {
  if (!cloudConfigured) throw new Error("Cloud sync is not configured.");
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: "nce-learning-lab-auth",
      },
    }),
  );
  return client;
}
export async function watchSession(onChange: (s: Session | null) => void) {
  const auth = (await cloud()).auth;
  const { data } = await auth.getSession();
  onChange(data.session);
  const { data: sub } = auth.onAuthStateChange((_event, session) =>
    onChange(session),
  );
  return () => sub.subscription.unsubscribe();
}
/** Emails a one-time code. A code (not a link) also works in an iPhone home-screen app. */
export async function sendCode(email: string) {
  const { error } = await (await cloud()).auth.signInWithOtp({ email });
  if (error) throw new Error(error.message);
}
export async function verifyCode(email: string, token: string) {
  const { error } = await (
    await cloud()
  ).auth.verifyOtp({ email, token, type: "email" });
  if (error) throw new Error(error.message);
}
export async function signOut() {
  const { error } = await (await cloud()).auth.signOut();
  if (error) throw new Error(error.message);
}
const table = "learning_state";
const columns = "revision,state,updated_at";
export type RemoteRow = {
  revision: number;
  state: unknown;
  updated_at: string;
};
export async function fetchRemote(userId: string) {
  const { data, error } = await (
    await cloud()
  )
    .from(table)
    .select(columns)
    .eq("user_id", userId)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0] as RemoteRow | undefined) ?? null;
}
/** Creates the cloud copy; "conflict" if another device created it first. */
export async function insertRemote(userId: string, state: unknown) {
  const { data, error } = await (
    await cloud()
  )
    .from(table)
    .insert({ user_id: userId, state, revision: 1 })
    .select(columns);
  if (error) {
    if (error.code === "23505") return "conflict" as const;
    throw new Error(error.message);
  }
  return data[0] as RemoteRow;
}
/** Replaces the cloud copy only if it is still at `expected` (optimistic lock). */
export async function updateRemote(
  userId: string,
  state: unknown,
  expected: number,
) {
  const { data, error } = await (
    await cloud()
  )
    .from(table)
    .update({
      state,
      revision: expected + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("revision", expected)
    .select(columns);
  if (error) throw new Error(error.message);
  if (!data?.length) return "conflict" as const;
  return data[0] as RemoteRow;
}
