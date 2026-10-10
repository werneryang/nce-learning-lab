import type { State } from "../shared/schema";
export function removeSession(state: State, sessionId: string): State {
  const attemptIds = new Set(
    state.attempts
      .filter((a) => a.practiceSessionId === sessionId)
      .map((a) => a.id),
  );
  return {
    ...state,
    sessions: state.sessions.filter((s) => s.id !== sessionId),
    turns: state.turns.filter((t) => t.sessionId !== sessionId),
    attempts: state.attempts.filter((a) => !attemptIds.has(a.id)),
    mistakes: state.mistakes.filter((m) => !attemptIds.has(m.attemptId)),
  };
}
export function removeMistake(state: State, mistakeId: string): State {
  return {
    ...state,
    mistakes: state.mistakes.filter((m) => m.id !== mistakeId),
    attempts: state.attempts.map((a) => ({
      ...a,
      mistakeIds: a.mistakeIds?.filter((id) => id !== mistakeId),
    })),
  };
}
