import { useEffect, useState } from "react";
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

export type AdvisorConnectLoaderProps = {
  title?: string;
  steps?: readonly string[];
  stepIntervalMs?: number;
  className?: string;
};

/**
 * Centered connect wait before the welcome card. Headline stays put;
 * feature sublines rotate underneath. Not a message card.
 */
export function AdvisorConnectLoader({
  title = ADVISOR_CONNECT_TITLE,
  steps = ADVISOR_CONNECT_STEPS,
  stepIntervalMs = ADVISOR_CONNECT_STEP_MS,
  className,
}: AdvisorConnectLoaderProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const stepCount = steps.length;

  useEffect(() => {
    setStepIndex(0);
    if (stepCount < 2 || prefersReducedMotion()) return;
    const timer = window.setInterval(() => {
      setStepIndex((current) => Math.min(current + 1, stepCount - 1));
    }, Math.max(200, stepIntervalMs));
    return () => window.clearInterval(timer);
  }, [stepCount, stepIntervalMs]);

  const subline = steps[Math.min(stepIndex, Math.max(stepCount - 1, 0))] ?? "";
  const rootClass =
    "advisor-connect" + (className ? ` ${className}` : "");

  return (
    <div
      className={rootClass}
      role="status"
      aria-live="polite"
      data-component="advisor-connect-loader"
    >
      <span className="advisor-connect__wave" aria-hidden="true">
        <span className="advisor-connect__dot" />
        <span className="advisor-connect__dot" />
        <span className="advisor-connect__dot" />
      </span>
      <p className="advisor-connect__title">{title}</p>
      {subline ? (
        <p key={subline} className="advisor-connect__subline">
          {subline}
        </p>
      ) : null}
    </div>
  );
}

export default AdvisorConnectLoader;
