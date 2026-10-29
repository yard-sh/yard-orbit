import { useSyncExternalStore } from "react";
import type { Limits } from "@shared/constants";

// Any 402 from the API opens the upgrade dialog, wherever it happened.
// A tiny store keeps that decoupled from the component that tripped it.
type State = { open: boolean; limit?: keyof Limits };

let state: State = { open: false };
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

export const openUpgrade = (limit?: keyof Limits) => set({ open: true, limit });
export const closeUpgrade = () => set({ ...state, open: false });

export function useUpgrade(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
