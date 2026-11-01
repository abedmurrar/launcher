"use client";

import { useCallback, useSyncExternalStore } from "react";

export type View = "running" | "commands" | "groups";

export type Selection =
  | { kind: "command"; id: number }
  | { kind: "group"; id: number }
  | { kind: "new-command" }
  | { kind: "new-group" }
  | null;

export interface NavState {
  view: View;
  selection: Selection;
}

const VIEWS: View[] = ["running", "commands", "groups"];

/**
 * Hash format: #/commands, #/commands/c/12, #/groups/g/3, #/commands/new, #/groups/new.
 * Kept in the URL so the back button, reloads and links work.
 */
export function parseHash(hash: string): NavState {
  const [viewPart, a, b] = hash.replace(/^#\/?/, "").split("/");
  const view: View = VIEWS.includes(viewPart as View) ? (viewPart as View) : "commands";
  let selection: Selection = null;
  if (a === "new") selection = view === "groups" ? { kind: "new-group" } : { kind: "new-command" };
  else if ((a === "c" || a === "g") && /^\d+$/.test(b ?? "")) {
    selection = { kind: a === "c" ? "command" : "group", id: Number(b) };
  }
  return { view, selection };
}

export function toHash({ view, selection }: NavState): string {
  if (!selection) return `#/${view}`;
  if (selection.kind === "new-command" || selection.kind === "new-group") return `#/${view}/new`;
  return `#/${view}/${selection.kind === "command" ? "c" : "g"}/${selection.id}`;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function useNav() {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => ""
  );
  const state = parseHash(hash);

  const navigate = useCallback((next: NavState, opts: { replace?: boolean } = {}) => {
    const target = toHash(next);
    if (target === window.location.hash) return;
    if (opts.replace) {
      history.replaceState(null, "", target);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } else {
      window.location.hash = target;
    }
  }, []);

  return { ...state, navigate };
}
