import { useCallback, useEffect, useRef, useState } from "react";
import { emptyState } from "../shared/schema";
import type { State } from "../shared/schema";
import { loadState, saveState } from "./db";
export function useLearning() {
  const [state, setState] = useState<State>(emptyState);
  const ref = useRef(state);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Loading local data");
  const [storageError, setStorageError] = useState("");
  useEffect(() => {
    let alive = true;
    loadState()
      .then((data) => {
        if (alive) {
          ref.current = data;
          setState(data);
          setReady(true);
          setStatus("Saved locally");
        }
      })
      .catch((e) => {
        if (alive) {
          setStorageError(
            `Cannot load private storage: ${String(e)}. Reload or use Settings to recover.`,
          );
          setStatus("Save failed");
          setReady(true);
        }
      });
    return () => {
      alive = false;
    };
  }, []);
  const update = useCallback((fn: (state: State) => State) => {
    const next = fn(ref.current);
    ref.current = next;
    setState(next);
    setStatus("Saving");
  }, []);
  const flush = useCallback(async () => {
    if (storageError) return false;
    const snapshot = ref.current;
    try {
      await saveState(snapshot);
      if (ref.current === snapshot) setStatus("Saved locally");
      return true;
    } catch (e) {
      setStatus("Save failed");
      setStorageError(String(e));
      return false;
    }
  }, [storageError]);
  useEffect(() => {
    if (!ready || storageError) return;
    const timer = setTimeout(() => {
      void flush();
    }, 700);
    return () => clearTimeout(timer);
  }, [state, ready, flush, storageError]);
  useEffect(() => {
    const visibility = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const pagehide = () => {
      void flush();
    };
    window.addEventListener("pagehide", pagehide);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pagehide", pagehide);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [flush]);
  return {
    state,
    ref,
    update,
    ready,
    status,
    flush,
    storageError,
    setStorageError,
  };
}
