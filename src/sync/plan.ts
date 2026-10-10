import { StateSchema } from "../shared/schema";
import type { State } from "../shared/schema";
import { digest } from "../storage/db";
/** True when a state holds no learning records (preferences don't count). */
export function isBlank(state: State) {
  return (
    !state.imports.length &&
    !state.sessions.length &&
    !state.turns.length &&
    !state.attempts.length &&
    !state.chunks.length &&
    !state.links.length &&
    !state.examples.length &&
    !state.mastery.length &&
    !state.mistakes.length &&
    !state.rejectedCandidates.length
  );
}
/** Stable content hash: parsing normalizes key order from Postgres jsonb. */
export function fingerprint(state: unknown) {
  return digest(JSON.stringify(StateSchema.parse(state)));
}
export type Plan =
  | "none" // nothing to do
  | "upload" // no cloud copy yet: create it from this device
  | "push" // this device changed and the cloud copy is the one we last saw
  | "apply" // the cloud copy is newer and this device has no unsynced changes
  | "conflict"; // both changed since the last sync: the user must choose
export function planSync(input: {
  remote: { revision: number; blank: boolean } | null;
  baseRevision: number; // cloud revision this device last synced with (0 = never)
  dirty: boolean; // this device has changes the cloud has not seen
  localBlank: boolean;
}): Plan {
  const { remote, baseRevision, dirty, localBlank } = input;
  if (!remote) return localBlank ? "none" : "upload";
  if (remote.revision === baseRevision) return dirty ? "push" : "none";
  if (!dirty) return "apply";
  // An empty cloud copy has nothing to lose, so it is not a real conflict.
  return remote.blank ? "push" : "conflict";
}
