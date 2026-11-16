import { useEffect, useState } from "react";

/** Phone-width breakpoint, matching the storefront's mobile CSS. */
export const NARROW_SCREEN_QUERY = "(max-width: 767.98px)";

/** True on a real phone or narrow window, independent of the demo switcher. */
export function useNarrowScreen() {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia(NARROW_SCREEN_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(NARROW_SCREEN_QUERY);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return narrow;
}
