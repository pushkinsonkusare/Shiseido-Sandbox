import { useEffect, useState } from "react";
import type { AdvisorConnectType } from "../../AgentModeBar/AgentModeContext";
import {
  ADVISOR_CONNECT_STEP_MS,
  ADVISOR_CONNECT_STEPS,
  ADVISOR_CONNECT_TITLE,
} from "../conversation/flow";
import "./AdvisorConnectLoader.css";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Outer pill width, then the label width inside it. */
const SKELETON_PILLS = [
  { shell: 169, label: 135 },
  { shell: 177, label: 143 },
  { shell: 195, label: 161 },
  { shell: 181, label: 147 },
] as const;

export type AdvisorConnectLoaderProps = {
  title?: string;
  steps?: readonly string[];
  stepIntervalMs?: number;
  className?: string;
  variant?: AdvisorConnectType;
};

/**
 * Centered connect wait before the welcome card. Rotating statements keep the
 * sparkle and feature lines. Skeleton shimmer traces the welcome card and the
 * suggestion pills that land when the wait ends.
 */
export function AdvisorConnectLoader({
  title = ADVISOR_CONNECT_TITLE,
  steps = ADVISOR_CONNECT_STEPS,
  stepIntervalMs = ADVISOR_CONNECT_STEP_MS,
  className,
  variant = "rotating-statements",
}: AdvisorConnectLoaderProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const stepCount = steps.length;
  const shimmer = variant === "skeleton-shimmer";

  useEffect(() => {
    setStepIndex(0);
    if (shimmer || stepCount < 2 || prefersReducedMotion()) return;
    const timer = window.setInterval(() => {
      setStepIndex((current) => Math.min(current + 1, stepCount - 1));
    }, Math.max(200, stepIntervalMs));
    return () => window.clearInterval(timer);
  }, [shimmer, stepCount, stepIntervalMs]);

  const subline = steps[Math.min(stepIndex, Math.max(stepCount - 1, 0))] ?? "";
  const rootClass =
    "advisor-connect" +
    (shimmer ? " advisor-connect--skeleton" : "") +
    (className ? ` ${className}` : "");

  return (
    <div
      className={rootClass}
      role="status"
      aria-live="polite"
      aria-label={title}
      data-component="advisor-connect-loader"
      data-variant={variant}
    >
      {shimmer ? (
        <ConnectSkeleton />
      ) : (
        <>
          <span className="advisor-connect__sparkles" aria-hidden="true" />
          <p className="advisor-connect__title">{title}</p>
          {subline ? (
            <p key={subline} className="advisor-connect__subline">
              {subline}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function ConnectSkeleton() {
  return (
    <div className="advisor-connect__trace" aria-hidden="true">
      <div className="advisor-connect__card">
        <div className="advisor-connect__hero advisor-connect__bone">
          <span className="advisor-connect__logo advisor-connect__bone" />
        </div>
        <div className="advisor-connect__copy">
          <span className="advisor-connect__line advisor-connect__line--title advisor-connect__bone" />
          <span className="advisor-connect__line advisor-connect__bone" />
          <span className="advisor-connect__line advisor-connect__bone" />
          <span className="advisor-connect__line advisor-connect__bone" />
          <span className="advisor-connect__line advisor-connect__line--short advisor-connect__bone" />
        </div>
      </div>
      <div className="advisor-connect__pills">
        {SKELETON_PILLS.map(({ shell, label }) => (
          <span
            key={label}
            className="advisor-connect__pill"
            style={{ width: shell }}
          >
            <span
              className="advisor-connect__pill-label advisor-connect__bone"
              style={{ width: label }}
            />
          </span>
        ))}
        <span className="advisor-connect__regen">
          <span className="advisor-connect__regen-icon advisor-connect__bone" />
        </span>
      </div>
    </div>
  );
}

export default AdvisorConnectLoader;
