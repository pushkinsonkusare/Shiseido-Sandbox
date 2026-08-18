import { useAgentMode } from "../AgentModeBar/AgentModeContext";
import { SparkleIcon } from "../icons/StorefrontIcons";
import "./OpenPersonalAssistantNavButton.css";

/** Dispatches `agentic:open-assistant`. Sidecar listens; SideBySideLayout opens the panel when collapsed. */
export function OpenPersonalAssistantNavButton() {
  const { mode, sidecarAvailable } = useAgentMode();
  // Nothing to open on the native storefront, and nothing to open while the PDP
  // widget answers inline either.
  if (mode === "basic-website" || !sidecarAvailable) return null;

  return (
    <button
      type="button"
      className="personal-assistant-nav-trigger"
      aria-label="Open Beauty Advisor"
      onClick={() =>
        document.dispatchEvent(new CustomEvent("agentic:open-assistant"))
      }
    >
      <SparkleIcon width={16} height={16} />
    </button>
  );
}
