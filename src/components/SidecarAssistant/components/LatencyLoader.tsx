import { useEffect, useState } from "react";
import { LoaderCircleIcon, StopIcon } from "../../icons/StorefrontIcons";
import "./LatencyLoader.css";

export type LatencyLoaderVariant =
  | "thinking"
  | "answering"
  | "fetching_order"
  | "completing_order"
  | "fetching_payment"
  | "removing";

const VARIANT_LABELS: Record<LatencyLoaderVariant, string> = {
  thinking: "Working on it…",
  answering: "Looking for answers…",
  fetching_order: "Fetching your order details…",
  completing_order: "Completing order…",
  fetching_payment: "Fetching your payment details…",
  removing: "Removing…",
};

const DEFAULT_STEP_INTERVAL_MS = 1200;

export type LatencyLoaderProps = {
  /** Pre-canned status message variants matching the Figma component. */
  variant?: LatencyLoaderVariant;
  /** Optional override label.  When provided, supersedes `variant`. */
  label?: string;
  /** Stages to walk through, for waits long enough that a single line reads
   *  as a stall. Supersedes `variant` and `label`. */
  steps?: string[];
  /** How long each stage holds before the next one takes over. */
  stepIntervalMs?: number;
  /** Abandons the turn in flight. Omit it and no stop affordance renders. */
  onCancel?: () => void;
  /** Optional class name appended to the root element. */
  className?: string;
};

/**
 * LatencyLoader is the agentic "the assistant is working" indicator rendered
 * inside the chat panel while a response is in flight.  Mirrors
 * `Latency Loader` (node-id 32933:112416 family) from Figma.
 */
export function LatencyLoader({
  variant = "thinking",
  label,
  steps,
  stepIntervalMs = DEFAULT_STEP_INTERVAL_MS,
  onCancel,
  className,
}: LatencyLoaderProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const stepCount = steps?.length ?? 0;

  useEffect(() => {
    setStepIndex(0);
    if (stepCount < 2) return;
    const timer = window.setInterval(() => {
      // Holds on the closing line rather than looping, so a turn that runs
      // long never reads as if it started over.
      setStepIndex((current) => Math.min(current + 1, stepCount - 1));
    }, Math.max(200, stepIntervalMs));
    return () => window.clearInterval(timer);
  }, [stepCount, stepIntervalMs]);

  const text =
    stepCount > 0
      ? (steps as string[])[Math.min(stepIndex, stepCount - 1)]
      : (label ?? VARIANT_LABELS[variant]);
  const rootClass = "agent-loader" + (className ? " " + className : "");

  return (
    <div
      className={rootClass}
      role="status"
      aria-live="polite"
      data-component="latency-loader"
    >
      <span className="agent-loader__spinner" aria-hidden="true">
        <LoaderCircleIcon width={20} height={20} />
      </span>
      {/* Keyed so each stage fades in rather than snapping over the last. */}
      <span key={text} className="agent-loader__label">
        {text}
      </span>
      {onCancel ? (
        <button
          type="button"
          className="agent-loader__stop"
          onClick={onCancel}
          aria-label="Stop"
          title="Stop"
        >
          <StopIcon width={16} height={16} />
        </button>
      ) : null}
    </div>
  );
}

export default LatencyLoader;
