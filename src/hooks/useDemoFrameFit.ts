import { useEffect } from "react";
import type { DemoViewportMode } from "../components/AgentModeBar/AgentModeContext";

const FRAME_WIDTH = 402;
const FRAME_HEIGHT = 874;
/** Breathing room around the frame so the bezel / outline is not clipped. */
const GUTTER = 24;
/** Mobile Chrome outline is 4px outside `#root` on each side. */
const CHROME_OUTLINE = 8;

/**
 * Scales the 402×874 demo phone down (never up) so the full device stays
 * on screen at any window size, display scale, or browser zoom.
 */
export function useDemoFrameFit(
  viewportMode: DemoViewportMode,
  mobileChrome: boolean,
) {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-demo-viewport", viewportMode);
    if (viewportMode === "mobile" && mobileChrome) {
      root.setAttribute("data-demo-mobile-chrome", "true");
    } else {
      root.removeAttribute("data-demo-mobile-chrome");
    }

    const apply = () => {
      if (viewportMode !== "mobile") {
        root.style.removeProperty("--demo-frame-scale");
        return;
      }
      const extra = mobileChrome ? CHROME_OUTLINE : 0;
      const viewport = window.visualViewport;
      const availW = (viewport?.width ?? window.innerWidth) - GUTTER;
      const availH = (viewport?.height ?? window.innerHeight) - GUTTER;
      const scale = Math.min(
        1,
        availW / (FRAME_WIDTH + extra),
        availH / (FRAME_HEIGHT + extra),
      );
      root.style.setProperty("--demo-frame-scale", String(Math.max(scale, 0.2)));
    };

    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    window.visualViewport?.addEventListener("resize", apply);
    window.visualViewport?.addEventListener("scroll", apply);
    const observer = new ResizeObserver(apply);
    observer.observe(root);
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      window.visualViewport?.removeEventListener("resize", apply);
      window.visualViewport?.removeEventListener("scroll", apply);
      observer.disconnect();
      root.style.removeProperty("--demo-frame-scale");
    };
  }, [viewportMode, mobileChrome]);
}
