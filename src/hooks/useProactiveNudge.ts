import { useSyncExternalStore } from "react";

/**
 * Proactive Assistant: a short while after the shopper lands on a PDP, the
 * advisor's entry points (header Advisor button, bottom FAB) light a "1"
 * badge. Opening the advisor from either one hands the product over, so the
 * advisor opens already in its context with next-best-action pills in the
 * composer.
 *
 * Module-level store so the header, the FAB and the advisor (which may not be
 * mounted yet when the shopper clicks) all read the same state.
 */

/** How long the shopper is on the page before the advisor nudges. */
const NUDGE_DELAY_MS = 2500;

type ProactiveState = {
  /** The PDP product the badge is for, once the delay has passed. */
  badgeSlug: string | null;
  /** A product handed over by an entry-point click, for the advisor to pick up. */
  pendingSlug: string | null;
  /** Bumped on every hand-over so the same product can be handed over again. */
  pendingToken: number;
};

let state: ProactiveState = { badgeSlug: null, pendingSlug: null, pendingToken: 0 };
let pageSlug: string | null = null;
let timer: number | null = null;
/** Products already nudged for this page load; each nudges once. */
const acknowledged = new Set<string>();
const listeners = new Set<() => void>();

function setState(next: Partial<ProactiveState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Called by the PDP with its product, and with `null` when it unmounts. */
export function setProactivePage(slug: string | null) {
  if (slug === pageSlug) return;
  pageSlug = slug;
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
  if (state.badgeSlug) setState({ badgeSlug: null });
  if (!slug || acknowledged.has(slug)) return;
  timer = window.setTimeout(() => {
    timer = null;
    if (pageSlug === slug && !acknowledged.has(slug)) setState({ badgeSlug: slug });
  }, NUDGE_DELAY_MS);
}

/**
 * Entry points call this when clicked. If a badge is showing, clears it and
 * queues its product for the advisor. Returns whether there was one.
 */
export function acknowledgeProactive(): boolean {
  const slug = state.badgeSlug;
  if (!slug) return false;
  acknowledged.add(slug);
  setState({ badgeSlug: null, pendingSlug: slug, pendingToken: state.pendingToken + 1 });
  return true;
}

/** Clears the badge without handing its product over (the advisor was opened another way). */
export function dismissProactiveBadge() {
  const slug = state.badgeSlug;
  if (!slug) return;
  acknowledged.add(slug);
  setState({ badgeSlug: null });
}

/** The advisor calls this once it has picked up the handed-over product. */
export function consumeProactivePending() {
  if (state.pendingSlug) setState({ pendingSlug: null });
}

/** Product the entry-point badge is showing for, or `null`. */
export function useProactiveBadge(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => state.badgeSlug,
    () => null,
  );
}

/** Product handed over by an entry-point click, waiting for the advisor. */
export function useProactivePending(): { slug: string | null; token: number } {
  const slug = useSyncExternalStore(subscribe, () => state.pendingSlug, () => null);
  const token = useSyncExternalStore(subscribe, () => state.pendingToken, () => 0);
  return { slug, token };
}
