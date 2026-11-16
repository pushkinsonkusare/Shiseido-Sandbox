import { useAgentMode } from "../AgentModeBar/AgentModeContext";
import { SparkleIcon } from "../icons/StorefrontIcons";
import { acknowledgeProactive, useProactiveBadge } from "../../hooks/useProactiveNudge";
import "./OpenPersonalAssistantNavButton.css";

/** Dispatches `agentic:open-assistant`. Sidecar listens; SideBySideLayout opens the panel when collapsed. */
export function OpenPersonalAssistantNavButton() {
  const { mode, sidecarAvailable } = useAgentMode();
  const badgeSlug = useProactiveBadge();
  // Nothing to open on the native storefront, and nothing to open while the PDP
  // widget answers inline either.
  if (mode === "basic-website" || !sidecarAvailable) return null;

  return (
    <button
      type="button"
      className="personal-assistant-nav-trigger"
      aria-label={
        badgeSlug ? "Open Beauty Advisor, 1 new suggestion" : "Open Beauty Advisor"
      }
      onClick={() => {
        acknowledgeProactive();
        document.dispatchEvent(new CustomEvent("agentic:open-assistant"));
      }}
    >
      <SparkleIcon width={16} height={16} />
      <span className="personal-assistant-nav-trigger__label personal-assistant-nav-trigger__label--full">
        Beauty Advisor
      </span>
      <span className="personal-assistant-nav-trigger__label personal-assistant-nav-trigger__label--short">
        Advisor
      </span>
      {badgeSlug ? (
        <span className="proactive-badge" aria-hidden="true">
          1
        </span>
      ) : null}
    </button>
  );
}
