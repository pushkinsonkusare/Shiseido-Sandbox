import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { SparkleIcon } from "../icons/StorefrontIcons";
import {
  useAgentMode,
  DEMO_SCENARIO,
  readDemoScenario,
} from "../AgentModeBar/AgentModeContext";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useFabInvite } from "../../hooks/useFabInvite";
import { useNarrowScreen } from "../../hooks/useNarrowScreen";
import { SidecarAssistant, type PendingAsk } from "./SidecarAssistant";
import type { AskAssistantEventDetail } from "../../pages/ProductDetailPage/PdpNbaPanel";
// Reuse the SideBySide docking shell CSS for desktop grid + mobile overlay.
import "../SideBySideAssistant/SideBySideLayout.css";

type Props = {
  children: ReactNode;
};

// Stagger the FAB so it doesn't pop in over the closing panel. Matches the
// keyframe / transition durations in SideBySideLayout.css.
const FAB_REVEAL_DELAY_MS = 280;

const PANEL_WIDTH_MIN = 420;
const PANEL_WIDTH_MAX = 630;
const PANEL_WIDTH_STEP = 16;

/**
 * Mobile bottom-sheet stops. A pill or NBA opens the advisor at "half" so
 * the answer lands next to the page the shopper was on; typing, a flick
 * up, or the grab handle takes it to "full".
 */
type SheetStop = "half" | "full";

/** How far a vertical flick has to travel before the sheet changes stop. */
const SHEET_FLICK_UP_PX = 48;
const SHEET_FLICK_DOWN_PX = 110;

/** Inline styles that let a drag override the sheet's stop heights. */
const SHEET_DRAG_PROPS = ["height", "top", "bottom", "min-height", "max-height", "transition"] as const;

/** True when the touch began inside something already scrolled down. */
function startedInScrolledArea(target: EventTarget | null, panel: HTMLElement): boolean {
  let el = target instanceof Element ? target : null;
  while (el && el !== panel) {
    if (el.scrollTop > 0) return true;
    el = el.parentElement;
  }
  return false;
}

function clampPanelWidth(width: number): number {
  return Math.min(PANEL_WIDTH_MAX, Math.max(PANEL_WIDTH_MIN, Math.round(width)));
}

function shouldOpenPanelFromUrl(): boolean {
  if (typeof window === "undefined") return false;
  const open = (new URLSearchParams(window.location.search).get("open") || "")
    .trim()
    .toLowerCase();
  /* Explicit close wins over scenario auto-open, so a shared PDP can keep
   * the advisor shut until the shopper taps it. */
  if (open === "0" || open === "false" || open === "off" || open === "no") {
    return false;
  }
  if (DEMO_SCENARIO != null) return true;
  // Runtime re-read covers late URL changes / stale module constants.
  if (readDemoScenario() != null) return true;
  return open === "1" || open === "true" || open === "yes";
}

export function SidecarDockLayout({ children }: Props) {
  const { viewportMode, userTestingLock, sidecarAvailable } = useAgentMode();
  const narrowScreen = useNarrowScreen();
  /* Phones get the full-screen bottom sheet, not the side dock, even when
   * the demo switcher is on its desktop default. */
  const isMobileViewport = viewportMode === "mobile" || narrowScreen;
  const openFromUrl = shouldOpenPanelFromUrl();

  const [panelOpen, setPanelOpen] = useState(
    () => userTestingLock || openFromUrl,
  );
  // When detached the assistant floats as a centered modal and the storefront
  // reflows to full width. Desktop-only; mobile keeps the overlay sheet.
  const [detached, setDetached] = useState(false);
  // Once the assistant mounts we keep it in the tree for the rest of the
  // session so the chat history survives a close -> reopen. The close
  // transition is driven entirely by CSS (grid collapses to 0px and the panel
  // slides out via `--closing`).
  const [panelMounted, setPanelMounted] = useState(
    () => userTestingLock || openFromUrl,
  );
  const [fabVisible, setFabVisible] = useState(
    () => !(userTestingLock || openFromUrl),
  );
  const fabInvite = useFabInvite(fabVisible && sidecarAvailable && !isMobileViewport);
  // An ask request that landed before the assistant mounted; see the listener.
  const [pendingAsk, setPendingAsk] = useState<PendingAsk | null>(null);
  const clearPendingAsk = useCallback(() => setPendingAsk(null), []);
  const askTokenRef = useRef(0);
  // Read inside the document listener, which is registered once.
  const panelMountedRef = useRef(panelMounted);
  useEffect(() => {
    panelMountedRef.current = panelMounted;
  }, [panelMounted]);

  // Read inside the document listeners alongside `panelMountedRef`.
  const sidecarAvailableRef = useRef(sidecarAvailable);
  useEffect(() => {
    sidecarAvailableRef.current = sidecarAvailable;
  }, [sidecarAvailable]);

  // Inline-answer mode is meant to look like a storefront with no assistant at
  // all, so a panel left open when the flag flips has to go with it.
  useEffect(() => {
    if (!sidecarAvailable) setPanelOpen(false);
  }, [sidecarAvailable]);

  // Deep-link scenarios / `?open=1` must win over a closed initial paint.
  useEffect(() => {
    if (!sidecarAvailable) return;
    if (!shouldOpenPanelFromUrl()) return;
    setPanelOpen(true);
    setPanelMounted(true);
    setFabVisible(false);
  }, [sidecarAvailable]);

  const panelRef = useRef<HTMLElement | null>(null);
  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartYRef = useRef<number | null>(null);
  const [panelWidthPx, setPanelWidthPx] = useState(PANEL_WIDTH_MIN);
  const [resizing, setResizing] = useState(false);
  const resizeDragRef = useRef<{ startX: number; startWidth: number } | null>(
    null,
  );

  const [sheetStop, setSheetStop] = useState<SheetStop>("full");
  const swipeFromScrolledRef = useRef(false);
  /** The grab bar's drag: where it started and how tall the sheet was. */
  const handleDragRef = useRef<{
    pointerId: number;
    startY: number;
    scale: number;
    startHeight: number;
    startBottom: number;
    maxHeight: number;
    lastY: number;
    lastT: number;
    velocity: number;
    moved: boolean;
  } | null>(null);
  // Read inside the document listeners, which are registered once.
  const panelOpenRef = useRef(panelOpen);
  useEffect(() => {
    panelOpenRef.current = panelOpen;
  }, [panelOpen]);

  /** Opens at `stop` from closed; an open sheet keeps the stop it's at. */
  const openPanelAt = (stop: SheetStop) => {
    if (!panelOpenRef.current) setSheetStop(stop);
    setPanelOpen(true);
  };
  const openPanel = () => openPanelAt("full");
  const closePanel = () => setPanelOpen(false);
  const toggleDetach = () => setDetached((value) => !value);

  const beginResize = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      resizeDragRef.current = {
        startX: event.clientX,
        startWidth: panelWidthPx,
      };
      setResizing(true);
    },
    [panelWidthPx],
  );

  const onResizeKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setResizing(true);
        setPanelWidthPx((width) => clampPanelWidth(width + PANEL_WIDTH_STEP));
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setResizing(true);
        setPanelWidthPx((width) => clampPanelWidth(width - PANEL_WIDTH_STEP));
      }
    },
    [],
  );

  // Re-dock whenever the panel closes or we drop into mobile, so the modal
  // state never lingers when the docked shell isn't visible.
  useEffect(() => {
    if (!panelOpen || isMobileViewport) setDetached(false);
  }, [panelOpen, isMobileViewport]);

  const isDetached = detached && !isMobileViewport;
  const isHalfSheet = isMobileViewport && panelOpen && sheetStop === "half";

  // Immersive covers the viewport, so the storefront behind it should hold still
  // rather than scrolling along. The docked panel deliberately does not lock:
  // browsing the storefront while chatting is the point of that mode.
  useBodyScrollLock(isDetached);

  useEffect(() => {
    if (panelOpen) {
      setPanelMounted(true);
      setFabVisible(false);
      return;
    }
    const fabTimer = window.setTimeout(
      () => setFabVisible(true),
      FAB_REVEAL_DELAY_MS,
    );
    return () => window.clearTimeout(fabTimer);
  }, [panelOpen]);

  // Mark the document when the mobile overlay is open so storefront sticky
  // chrome can be demoted globally (portaled panel is no longer a descendant
  // of `.sxs-layout--mobile`, so `:has()` on the layout can't reach it).
  useEffect(() => {
    const root = document.documentElement;
    if (isMobileViewport && panelOpen) {
      // "half" leaves the storefront showing above the sheet, chrome and all.
      root.setAttribute("data-sxs-assistant-open", isHalfSheet ? "half" : "true");
    } else {
      root.removeAttribute("data-sxs-assistant-open");
    }
    return () => root.removeAttribute("data-sxs-assistant-open");
  }, [isMobileViewport, panelOpen, isHalfSheet]);

  // Open on the same storefront events the sidecar/SxS assistants listen for.
  // The `agentic:ask-assistant` prompt is normally seeded by SidecarAssistant's
  // own listener, so we only open the panel to reflow the grid. The exception is
  // the very first click from a closed panel: the assistant is not in the tree
  // yet, so nothing is listening and the prompt would be dropped. Stash it and
  // let the assistant pick it up once mounted.
  // UserTesting lock opens the panel on load (initial state above) but does
  // not auto-dispatch a prompt — testers click/type the welcome NBA instead.
  // While the PDP widget answers inline, nothing may open the panel: its own
  // pills answer on the page, and any other surface that still fires these
  // events would otherwise reintroduce the assistant the mode is hiding.
  useEffect(() => {
    const onOpen = () => {
      if (!sidecarAvailableRef.current) return;
      openPanel();
    };
    const onAsk = (event: Event) => {
      if (!sidecarAvailableRef.current) return;
      // A pill's answer opens the sheet halfway; the FAB still opens full.
      openPanelAt("half");
      if (!panelMountedRef.current) {
        const detail = (event as CustomEvent<AskAssistantEventDetail>).detail;
        if (detail?.prompt?.trim()) {
          askTokenRef.current += 1;
          setPendingAsk({ token: askTokenRef.current, detail });
        }
      }
    };
    document.addEventListener("agentic:open-assistant", onOpen);
    document.addEventListener("agentic:ask-assistant", onAsk);
    return () => {
      document.removeEventListener("agentic:open-assistant", onOpen);
      document.removeEventListener("agentic:ask-assistant", onAsk);
    };
  }, []);

  useEffect(() => {
    if (!isMobileViewport) return;
    const root = document.documentElement;
    const vv = window.visualViewport;
    const syncViewport = () => {
      const viewportHeight = vv?.height ?? window.innerHeight;
      root.style.setProperty("--sxs-mobile-vh", `${Math.round(viewportHeight)}px`);
      // With the keyboard up, iOS can scroll the visible area down the page;
      // the sheet follows it so its header never slides off the top.
      root.style.setProperty("--sxs-mobile-vtop", `${Math.round(vv?.offsetTop ?? 0)}px`);
    };
    syncViewport();
    vv?.addEventListener("resize", syncViewport);
    vv?.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);
    return () => {
      vv?.removeEventListener("resize", syncViewport);
      vv?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("resize", syncViewport);
      root.style.removeProperty("--sxs-mobile-vh");
      root.style.removeProperty("--sxs-mobile-vtop");
    };
  }, [isMobileViewport]);

  const resetSwipeTransform = () => {
    const panel = panelRef.current;
    if (!panel) return;
    panel.style.transition = "";
    panel.style.transform = "";
  };

  useEffect(() => {
    if (panelOpen) resetSwipeTransform();
  }, [panelOpen]);

  useEffect(() => {
    if (!resizing) return;

    if (!resizeDragRef.current) {
      let cancelled = false;
      const id = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (!cancelled) setResizing(false);
        });
      });
      return () => {
        cancelled = true;
        window.cancelAnimationFrame(id);
      };
    }

    const onMove = (event: PointerEvent) => {
      const drag = resizeDragRef.current;
      if (!drag) return;
      setPanelWidthPx(
        clampPanelWidth(drag.startWidth + (drag.startX - event.clientX)),
      );
    };
    const onUp = () => {
      resizeDragRef.current = null;
      setResizing(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    const root = document.documentElement;
    root.classList.add("sxs-resizing");
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      root.classList.remove("sxs-resizing");
    };
  }, [resizing]);

  const handleDragMovedRef = useRef(false);
  const clearSheetDragStyles = () => {
    const el = panelRef.current;
    if (!el) return;
    for (const prop of SHEET_DRAG_PROPS) el.style.removeProperty(prop);
  };

  const beginHandleDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const el = panelRef.current;
    if (!el || (event.pointerType === "mouse" && event.button !== 0)) return;
    const rect = el.getBoundingClientRect();
    // The demo phone frame may be scaled to fit; work in CSS pixels.
    const scale = el.offsetHeight ? rect.height / el.offsetHeight : 1;
    const inFrame = el.parentElement?.id === "root" && getComputedStyle(el).position === "absolute";
    const frameTop = inFrame ? (el.parentElement?.getBoundingClientRect().top ?? 0) : 0;
    // Full height reaches the top of the frame, below any fake status bar.
    const statusBar =
      document.documentElement.dataset.demoMobileChrome === "true"
        ? parseFloat(getComputedStyle(el).getPropertyValue("--mobile-chrome-status")) || 0
        : 0;
    handleDragMovedRef.current = false;
    handleDragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      scale,
      startHeight: el.offsetHeight,
      startBottom: parseFloat(getComputedStyle(el).bottom) || 0,
      maxHeight: (rect.bottom - frameTop) / scale - statusBar,
      lastY: event.clientY,
      lastT: event.timeStamp,
      velocity: 0,
      moved: false,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer already gone (e.g. a cancelled touch); the drag still works.
    }
  };

  const moveHandleDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = handleDragRef.current;
    const el = panelRef.current;
    if (!drag || !el || drag.pointerId !== event.pointerId) return;
    const dy = (event.clientY - drag.startY) / drag.scale;
    if (!drag.moved && Math.abs(dy) < 4) return;
    drag.moved = true;
    handleDragMovedRef.current = true;
    const dt = Math.max(1, event.timeStamp - drag.lastT);
    drag.velocity = (event.clientY - drag.lastY) / dt; // px/ms, + is down
    drag.lastY = event.clientY;
    drag.lastT = event.timeStamp;
    const height = Math.min(drag.maxHeight, Math.max(80, drag.startHeight - dy));
    el.style.setProperty("transition", "none", "important");
    el.style.setProperty("top", "auto", "important");
    // Hold the bottom edge where it was, so only the top moves.
    el.style.setProperty("bottom", `${drag.startBottom}px`, "important");
    el.style.setProperty("min-height", "0", "important");
    el.style.setProperty("max-height", "none", "important");
    el.style.setProperty("height", `${Math.round(height)}px`, "important");
  };

  const endHandleDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = handleDragRef.current;
    const el = panelRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    handleDragRef.current = null;
    if (!drag.moved || !el) {
      clearSheetDragStyles();
      return;
    }
    const share = el.offsetHeight / drag.maxHeight;
    // A quick flick wins over where the finger stopped.
    const flick = Math.abs(drag.velocity) > 0.6 ? Math.sign(drag.velocity) : 0;
    let next: SheetStop | "closed";
    if (flick < 0) next = "full";
    else if (flick > 0) next = share > 0.8 ? "half" : "closed";
    else if (share > 0.78) next = "full";
    else if (share > 0.32) next = "half";
    else next = "closed";
    // Let the stop's own height take over with its transition.
    el.style.removeProperty("transition");
    el.style.removeProperty("height");
    el.style.removeProperty("min-height");
    el.style.removeProperty("max-height");
    el.style.removeProperty("top");
    el.style.removeProperty("bottom");
    if (next === "closed") closePanel();
    else setSheetStop(next);
  };

  const panel = panelMounted && sidecarAvailable ? (
    <aside
      ref={panelRef}
      className={
        (panelOpen
          ? "sxs-layout__panel sxs-layout__panel--open"
          : "sxs-layout__panel sxs-layout__panel--closing") +
        (isMobileViewport ? " sxs-layout__panel--mobile" : "") +
        (isHalfSheet ? " sxs-layout__panel--half" : "") +
        (isDetached ? " sxs-layout__panel--detached" : "")
      }
      aria-label="Beauty Advisor"
      aria-hidden={!panelOpen}
      onTouchStart={(event) => {
        if (!isMobileViewport || !panelOpen) return;
        const touch = event.touches[0];
        if (!touch) return;
        // The grab bar runs its own drag (pointer events, below).
        if ((event.target as Element).closest?.(".sxs-layout__sheet-handle")) {
          swipeStartXRef.current = null;
          swipeStartYRef.current = null;
          return;
        }
        swipeStartXRef.current = touch.clientX;
        swipeStartYRef.current = touch.clientY;
        swipeFromScrolledRef.current = panelRef.current
          ? startedInScrolledArea(event.target, panelRef.current)
          : false;
      }}
      // Reaching for the composer means the keyboard is coming: go full.
      onFocusCapture={(event) => {
        if (!isHalfSheet) return;
        if ((event.target as Element).matches?.("textarea, input, [contenteditable='true']")) {
          setSheetStop("full");
        }
      }}
      onPointerDownCapture={(event) => {
        if (!isHalfSheet) return;
        if ((event.target as Element).closest?.(".sidecar-assistant__input-bar")) {
          setSheetStop("full");
        }
      }}
      onTouchMove={(event) => {
        if (!isMobileViewport || !panelOpen) return;
        const panelEl = panelRef.current;
        const startX = swipeStartXRef.current;
        const startY = swipeStartYRef.current;
        const touch = event.touches[0];
        if (!panelEl || startX === null || startY === null || !touch) return;
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        // Bottom sheet: only engage a downward, vertically-dominant drag
        // that isn't just the chat scrolling back up.
        if (dy <= 0 || Math.abs(dy) < Math.abs(dx) || swipeFromScrolledRef.current) return;
        panelEl.style.transition = "none";
        panelEl.style.transform = `translate3d(0, ${Math.min(dy, 220)}px, 0)`;
      }}
      onTouchEnd={(event) => {
        if (!isMobileViewport || !panelOpen) return;
        const startX = swipeStartXRef.current;
        const startY = swipeStartYRef.current;
        const touch = event.changedTouches[0];
        swipeStartXRef.current = null;
        swipeStartYRef.current = null;
        if (startX === null || startY === null || !touch) {
          resetSwipeTransform();
          return;
        }
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        const vertical = Math.abs(dy) > Math.abs(dx);
        // Flick up from half: immerse.
        if (sheetStop === "half" && vertical && dy < -SHEET_FLICK_UP_PX) {
          setSheetStop("full");
          resetSwipeTransform();
          return;
        }
        // Flick down: full steps back to half, half dismisses.
        if (vertical && dy > SHEET_FLICK_DOWN_PX && !swipeFromScrolledRef.current) {
          if (sheetStop === "full") {
            setSheetStop("half");
            resetSwipeTransform();
          } else {
            closePanel();
          }
          return;
        }
        const panelEl = panelRef.current;
        if (!panelEl) return;
        panelEl.style.transition = "transform 180ms ease";
        panelEl.style.transform = "translate3d(0, 0, 0)";
        window.setTimeout(() => resetSwipeTransform(), 190);
      }}
    >
      {panelOpen && isMobileViewport ? (
        <button
          type="button"
          className="sxs-layout__sheet-handle"
          aria-label={isHalfSheet ? "Expand Beauty Advisor" : "Shrink Beauty Advisor to half"}
          onPointerDown={beginHandleDrag}
          onPointerMove={moveHandleDrag}
          onPointerUp={endHandleDrag}
          onPointerCancel={endHandleDrag}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setSheetStop("full");
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              if (isHalfSheet) closePanel();
              else setSheetStop("half");
            }
          }}
          onClick={(event) => {
            // A drag already decided the stop; only a plain tap toggles.
            if (event.detail !== 0 && handleDragMovedRef.current) return;
            setSheetStop(isHalfSheet ? "full" : "half");
          }}
        >
          <span className="sxs-layout__sheet-handle-bar" aria-hidden="true" />
        </button>
      ) : null}
      {panelOpen && !isMobileViewport && !isDetached ? (
        <div
          className="sxs-layout__resize"
          role="separator"
          aria-orientation="vertical"
          aria-valuemin={PANEL_WIDTH_MIN}
          aria-valuemax={PANEL_WIDTH_MAX}
          aria-valuenow={panelWidthPx}
          aria-label="Resize Beauty Advisor"
          tabIndex={0}
          onPointerDown={beginResize}
          onKeyDown={onResizeKeyDown}
        >
          <span className="sxs-layout__resize-pill" aria-hidden="true" />
        </div>
      ) : null}
      <SidecarAssistant
        docked
        open={panelOpen}
        onRequestClose={closePanel}
        detached={isDetached}
        onToggleDetach={toggleDetach}
        pendingAsk={pendingAsk}
        onPendingAskHandled={clearPendingAsk}
      />
    </aside>
  ) : null;

  // On mobile, portal the panel to `#root` so it stacks above the sticky
  // storefront header. Nested `position:fixed` inside `.sxs-shell` loses to
  // sticky compositing; a direct `#root` child with a high z-index does not.
  const rootEl = typeof document !== "undefined" ? document.getElementById("root") : null;
  // At half the page stays visible under a tint; tapping it closes the sheet.
  const sheetScrim = (
    <button
      type="button"
      className={"sxs-layout__sheet-scrim" + (isHalfSheet ? " sxs-layout__sheet-scrim--on" : "")}
      aria-label="Close Beauty Advisor"
      aria-hidden={!isHalfSheet}
      tabIndex={isHalfSheet ? 0 : -1}
      onClick={closePanel}
    />
  );
  const mobilePanel =
    isMobileViewport && panel && rootEl
      ? createPortal(
          <>
            {sheetScrim}
            {panel}
          </>,
          rootEl,
        )
      : null;
  const desktopPanel = !isMobileViewport ? panel : null;

  return (
    <div className="sxs-shell">
      <div
        className={
          (panelOpen ? "sxs-layout" : "sxs-layout sxs-layout--panel-collapsed") +
          (isMobileViewport ? " sxs-layout--mobile" : "") +
          (isDetached ? " sxs-layout--detached" : "") +
          (resizing ? " sxs-layout--resizing" : "")
        }
        style={
          {
            "--sxs-panel-width": `${panelWidthPx}px`,
          } as CSSProperties
        }
      >
        <div className="sxs-layout__main">{children}</div>
        {desktopPanel}
      </div>
      {mobilePanel}
      {fabVisible && sidecarAvailable ? (
        <button
          type="button"
          className={
            "sxs-layout__fab" + (fabInvite ? " sxs-layout__fab--invite" : "")
          }
          aria-label="Open Beauty Advisor"
          onClick={openPanel}
        >
          <SparkleIcon
            width={22}
            height={22}
            className="sxs-layout__fab-icon"
            fill="currentColor"
          />
          <span className="sxs-layout__fab-label" aria-hidden="true">
            glow with me
          </span>
        </button>
      ) : null}
    </div>
  );
}

export default SidecarDockLayout;
