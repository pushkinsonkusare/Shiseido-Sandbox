import { useSyncExternalStore } from "react";

/**
 * "Recent Searches" history for the search overlay.
 *
 * One mixed list, newest first, of two kinds of entry:
 *
 *  - `keyword`   → a classic search. Clicking re-runs it on the PLP.
 *                  Rendered with the history (clock) icon.
 *  - `assistant` → something the shopper asked the AI advisor from
 *                  search (Ask AI, a "Shop with assistant" prompt, a
 *                  promo chip). Clicking re-asks the advisor with the
 *                  original prompt. Rendered with the sparkle icon.
 *
 * Persisted to localStorage so a returning guest (same browser) still
 * sees their history after a refresh or a new visit. Seeded with a demo
 * mix on first visit so the dropdown never opens empty.
 */
export type RecentSearchKind = "keyword" | "assistant";

export type RecentSearch = {
  /** Visible label rendered in the dropdown row. */
  label: string;
  kind: RecentSearchKind;
  /** Full advisor prompt for `assistant` entries (defaults to label). */
  prompt?: string;
  /** Epoch ms of the last time it was searched/asked. */
  at: number;
};

const STORAGE_KEY = "shiseido.recentSearches.v1";
const MAX_RECENT = 10;

const SEED: ReadonlyArray<Omit<RecentSearch, "at">> = [
  { label: "Ultimune Power Infusing Serum", kind: "keyword" },
  {
    label: "Pack a carry-on skincare routine",
    kind: "assistant",
    prompt:
      "Help me pack a carry-on friendly skincare routine for travel, with travel sizes and a sunscreen",
  },
  { label: "Serum for dark spots", kind: "keyword" },
  { label: "Vital Perfection eye cream", kind: "keyword" },
  {
    label: "Fix dry, tight skin for good",
    kind: "assistant",
    prompt: "Help me fix dry, tight skin with a hydrating routine",
  },
  { label: "Sunscreen for oily skin", kind: "keyword" },
  {
    label: "Ultimune vs Benefiance: which suits me?",
    kind: "assistant",
    prompt: "Compare Ultimune vs Benefiance and help me decide which suits my skin",
  },
  { label: "Anti-aging moisturizer under $90", kind: "keyword" },
  { label: "Benefiance day cream", kind: "keyword" },
  { label: "Refillable skincare", kind: "keyword" },
];

function seeded(): RecentSearch[] {
  const now = Date.now();
  return SEED.map((s, i) => ({ ...s, at: now - (i + 1) * 60_000 }));
}

function isEntry(v: unknown): v is RecentSearch {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.label === "string" &&
    (r.kind === "keyword" || r.kind === "assistant") &&
    typeof r.at === "number"
  );
}

function read(): RecentSearch[] {
  if (typeof window === "undefined") return seeded();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seeded();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return seeded();
    return parsed.filter(isEntry).slice(0, MAX_RECENT);
  } catch {
    return seeded();
  }
}

let snapshot: RecentSearch[] = read();
const listeners = new Set<() => void>();

function commit(next: RecentSearch[]) {
  snapshot = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode / quota: keep the in-memory history for this session.
  }
  listeners.forEach((l) => l());
}

/** Add (or bump to the top) a search or advisor ask. */
export function recordRecentSearch(entry: {
  label: string;
  kind: RecentSearchKind;
  prompt?: string;
}) {
  const label = entry.label.trim().replace(/\s+/g, " ");
  if (!label) return;
  const key = label.toLowerCase();
  const next: RecentSearch = {
    label,
    kind: entry.kind,
    ...(entry.kind === "assistant" && entry.prompt && entry.prompt !== label
      ? { prompt: entry.prompt }
      : {}),
    at: Date.now(),
  };
  commit(
    [next, ...snapshot.filter((s) => s.label.toLowerCase() !== key)].slice(0, MAX_RECENT),
  );
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep tabs in sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      snapshot = read();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useRecentSearches(): RecentSearch[] {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}
