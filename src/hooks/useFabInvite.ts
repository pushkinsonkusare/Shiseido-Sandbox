import { useEffect, useState } from "react";

const FIRST_DELAY_MS = 1600;
const HOLD_MS = 3000;
const CYCLE_MS = 8500;

/**
 * Periodically expands the dock FAB so “glow with me” is discoverable.
 * Uses a class toggle (not width keyframes) so CSS transitions stay smooth.
 */
export function useFabInvite(enabled: boolean): boolean {
  const [invite, setInvite] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setInvite(false);
      return;
    }
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let collapseId = 0;
    const pulse = () => {
      setInvite(true);
      window.clearTimeout(collapseId);
      collapseId = window.setTimeout(() => setInvite(false), HOLD_MS);
    };

    const firstId = window.setTimeout(pulse, FIRST_DELAY_MS);
    const cycleId = window.setInterval(pulse, CYCLE_MS);
    return () => {
      window.clearTimeout(firstId);
      window.clearTimeout(collapseId);
      window.clearInterval(cycleId);
    };
  }, [enabled]);

  return invite;
}
