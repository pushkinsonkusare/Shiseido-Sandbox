import { useEffect, useState } from "react";
import { Settings, X } from "lucide-react";
import "./AgentModeBar.css";
import {
  AGENT_MODES,
  PRODUCT_SELECTION_TYPES,
  PDP_INLINE_WIDGET_POSITIONS,
  PDP_INLINE_WIDGET_TYPES,
  useAgentMode,
} from "./AgentModeContext";
import type { AgentMode } from "./AgentModeContext";

type DemoTheme = "sf-next" | "consumer-electronics";

const DEMO_THEMES: { id: DemoTheme; label: string }[] = [
  { id: "sf-next", label: "market street" },
  { id: "consumer-electronics", label: "NTO" },
];

/** Hidden for now — app stays on Sidecar (`assistant-only`). Flip to true
 *  only when explicitly asked to "show" the concept switcher. Do not delete
 *  Native / Side-by-side experiences unless explicitly asked to "delete". */
const SHOW_CONCEPT_SWITCHER = false;

export function AgentModeBar() {
  const {
    mode,
    setMode,
    viewportMode,
    setViewportMode,
    accordionRecommendations,
    setAccordionRecommendations,
    contextIsland,
    setContextIsland,
    productSelection,
    setProductSelection,
    productSelectionType,
    setProductSelectionType,
    pdpInlineWidget,
    setPdpInlineWidget,
    pdpInlineWidgetType,
    setPdpInlineWidgetType,
    pdpInlineWidgetPosition,
    setPdpInlineWidgetPosition,
    userTestingLock,
  } = useAgentMode();
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [theme, setTheme] = useState<DemoTheme>(() => {
    if (typeof window === "undefined") return "sf-next";
    const saved = window.localStorage.getItem("agent-demo-theme");
    return saved === "consumer-electronics" ? saved : "sf-next";
  });

  const handleModeClick = (nextMode: AgentMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
  };

  useEffect(() => {
    if (!isSwitcherOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSwitcherOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isSwitcherOpen]);

  useEffect(() => {
    /* Reflect the active viewport on the documentElement so CSS
     * media-query-equivalents can scope to it. We deliberately
     * DON'T persist this to localStorage anymore. Every page
     * refresh resets to Sidecar assistant + Desktop
     * (see `AgentModeContext.tsx`). One-time cleanup of any stale
     * value left by a previous build keeps the storage tidy.
     * Still runs under UserTesting lock so `data-demo-viewport`
     * is applied even when the FAB is hidden. */
    const root = document.documentElement;
    root.setAttribute("data-demo-viewport", viewportMode);
    try {
      window.localStorage.removeItem("agent-demo-viewport-mode");
    } catch {
      /* localStorage can fail in private mode; ignore gracefully. */
    }
  }, [viewportMode]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-demo-theme", theme);
    try {
      window.localStorage.setItem("agent-demo-theme", theme);
    } catch {
      /* localStorage can fail in private mode; ignore gracefully. */
    }
  }, [theme]);

  /* Hide the experience switcher during UserTesting so shoppers
   * cannot flip accordion A/B mid-study. Viewport/theme effects
   * above still run. */
  if (userTestingLock) return null;

  return (
    <div className="agent-mode-bar" role="banner" aria-label="Experience switcher">
      <button
        type="button"
        className="agent-mode-bar__fab"
        onClick={() => setIsSwitcherOpen((open) => !open)}
        aria-expanded={isSwitcherOpen}
        aria-controls="agent-mode-switcher-modal"
        aria-label={isSwitcherOpen ? "Close experience switcher" : "Open experience switcher"}
        title={isSwitcherOpen ? "Close switcher" : "Open switcher"}
      >
        <Settings width={16} height={16} aria-hidden="true" />
      </button>
      {isSwitcherOpen && (
        <div
          className="agent-mode-bar__modal-overlay"
          role="presentation"
          onClick={() => setIsSwitcherOpen(false)}
        >
          <div
            id="agent-mode-switcher-modal"
            className="agent-mode-bar__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="agent-mode-switcher-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="agent-mode-bar__modal-header">
              <h2 id="agent-mode-switcher-title" className="agent-mode-bar__modal-title">
                Agentic Commerce
              </h2>
              <button
                type="button"
                className="agent-mode-bar__modal-close"
                onClick={() => setIsSwitcherOpen(false)}
                aria-label="Close experience switcher"
              >
                <X width={16} height={16} aria-hidden="true" />
              </button>
            </div>

            {SHOW_CONCEPT_SWITCHER && (
              <div className="agent-mode-bar__section">
                <h3 className="agent-mode-bar__section-title">Concept switcher</h3>
                <div className="agent-mode-bar__option-grid" role="group" aria-label="Concept switcher">
                  {AGENT_MODES.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      className={
                        "agent-mode-bar__option-button" +
                        (mode === id ? " agent-mode-bar__option-button--active" : "")
                      }
                      onClick={() => handleModeClick(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="agent-mode-bar__section">
              <h3 className="agent-mode-bar__section-title">Platform switcher</h3>
              <div className="agent-mode-bar__option-grid" role="group" aria-label="Platform switcher">
                <button
                  type="button"
                  className={
                    "agent-mode-bar__option-button" +
                    (viewportMode === "desktop" ? " agent-mode-bar__option-button--active" : "")
                  }
                  onClick={() => setViewportMode("desktop")}
                >
                  Desktop
                </button>
                <button
                  type="button"
                  className={
                    "agent-mode-bar__option-button" +
                    (viewportMode === "mobile" ? " agent-mode-bar__option-button--active" : "")
                  }
                  onClick={() => setViewportMode("mobile")}
                >
                  Mobile
                </button>
              </div>
            </div>

            <div className="agent-mode-bar__section">
              <h3 className="agent-mode-bar__section-title">Theme switcher</h3>
              <div className="agent-mode-bar__option-grid" role="group" aria-label="Theme switcher">
                {DEMO_THEMES.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    className={
                      "agent-mode-bar__option-button" +
                      (theme === id ? " agent-mode-bar__option-button--active" : "")
                    }
                    onClick={() => setTheme(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="agent-mode-bar__section">
              <h3 className="agent-mode-bar__section-title">Features</h3>
              <div className="agent-mode-bar__feature-list" role="group" aria-label="Features">
                <label className="agent-mode-bar__feature">
                  <input
                    type="checkbox"
                    className="agent-mode-bar__feature-checkbox"
                    checked={accordionRecommendations}
                    onChange={(event) =>
                      setAccordionRecommendations(event.target.checked)
                    }
                  />
                  <span className="agent-mode-bar__feature-label">
                    Accordion category recommendations
                  </span>
                </label>
                <label className="agent-mode-bar__feature">
                  <input
                    type="checkbox"
                    className="agent-mode-bar__feature-checkbox"
                    checked={contextIsland}
                    onChange={(event) => setContextIsland(event.target.checked)}
                  />
                  <span className="agent-mode-bar__feature-label">
                    Context island
                  </span>
                </label>
                <label className="agent-mode-bar__feature">
                  <input
                    type="checkbox"
                    className="agent-mode-bar__feature-checkbox"
                    checked={productSelection}
                    onChange={(event) =>
                      setProductSelection(event.target.checked)
                    }
                  />
                  <span className="agent-mode-bar__feature-label">
                    Product selection
                  </span>
                </label>
                {productSelection && (
                  <div className="agent-mode-bar__sub-options">
                    <div
                      className="agent-mode-bar__sub-group"
                      role="group"
                      aria-label="Product selection type"
                    >
                      <span className="agent-mode-bar__sub-title">Type</span>
                      <div className="agent-mode-bar__option-grid">
                        {PRODUCT_SELECTION_TYPES.map(({ id, label }) => (
                          <button
                            key={id}
                            type="button"
                            className={
                              "agent-mode-bar__option-button agent-mode-bar__option-button--sm" +
                              (productSelectionType === id
                                ? " agent-mode-bar__option-button--active"
                                : "")
                            }
                            aria-pressed={productSelectionType === id}
                            onClick={() => setProductSelectionType(id)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <label className="agent-mode-bar__feature">
                  <input
                    type="checkbox"
                    className="agent-mode-bar__feature-checkbox"
                    checked={pdpInlineWidget}
                    onChange={(event) => setPdpInlineWidget(event.target.checked)}
                  />
                  <span className="agent-mode-bar__feature-label">
                    PDP inline widget
                  </span>
                </label>
                {/* Sibling of the label, not a child: nested inside it, every
                    click on a sub-option would also toggle the checkbox. */}
                {pdpInlineWidget && (
                  <div className="agent-mode-bar__sub-options">
                    <div
                      className="agent-mode-bar__sub-group"
                      role="group"
                      aria-label="PDP inline widget type"
                    >
                      <span className="agent-mode-bar__sub-title">Type</span>
                      <div className="agent-mode-bar__option-grid">
                        {PDP_INLINE_WIDGET_TYPES.map(({ id, label }) => (
                          <button
                            key={id}
                            type="button"
                            className={
                              "agent-mode-bar__option-button agent-mode-bar__option-button--sm" +
                              (pdpInlineWidgetType === id
                                ? " agent-mode-bar__option-button--active"
                                : "")
                            }
                            aria-pressed={pdpInlineWidgetType === id}
                            onClick={() => setPdpInlineWidgetType(id)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div
                      className="agent-mode-bar__sub-group"
                      role="group"
                      aria-label="PDP inline widget position"
                    >
                      <span className="agent-mode-bar__sub-title">Position</span>
                      <div className="agent-mode-bar__option-grid">
                        {PDP_INLINE_WIDGET_POSITIONS.map(({ id, label }) => (
                          <button
                            key={id}
                            type="button"
                            className={
                              "agent-mode-bar__option-button agent-mode-bar__option-button--sm" +
                              (pdpInlineWidgetPosition === id
                                ? " agent-mode-bar__option-button--active"
                                : "")
                            }
                            aria-pressed={pdpInlineWidgetPosition === id}
                            onClick={() => setPdpInlineWidgetPosition(id)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AgentModeBar;
