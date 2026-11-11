import { useEffect, useId, useState } from "react";
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
          <ConnectSparkles />
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

/**
 * Outline of one sparkle, traced from advisor-connect-sparkles.png: a
 * four-point star with long concave sides and softly rounded tips. One
 * quadrant runs from the right tip (1, 0) to the 45° midpoint; the rest is
 * mirrored. Units are the star's radius, centred on 0,0; the path is built
 * at SPARKLE_RADIUS so the animation only ever scales it down, which keeps
 * the edges sharp (scaling a tiny path up renders it soft and jagged).
 */
const SPARKLE_QUADRANT: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [0.99, 0.03],
  [0.95, 0.047],
  [0.9, 0.059],
  [0.85, 0.072],
  [0.8, 0.087],
  [0.75, 0.105],
  [0.7, 0.123],
  [0.65, 0.139],
  [0.6, 0.157],
  [0.55, 0.178],
  [0.5, 0.203],
  [0.45, 0.233],
  [0.4, 0.262],
  [0.35, 0.299],
  [0.325, 0.325],
];

const SPARKLE_RADIUS = 100;

function buildSparklePath(): string {
  // Right tip to the midpoint, then mirrored up to the top tip.
  const firstQuarter = [
    ...SPARKLE_QUADRANT,
    ...SPARKLE_QUADRANT.slice(0, -1)
      .reverse()
      .map(([x, y]) => [y, x] as const),
  ].slice(0, -1);
  // Rotate that quarter round by 90° steps for the full outline.
  const points: Array<readonly [number, number]> = [];
  for (let turn = 0; turn < 4; turn += 1) {
    for (const [x, y] of firstQuarter) {
      if (turn === 0) points.push([x, -y]);
      if (turn === 1) points.push([-y, -x]);
      if (turn === 2) points.push([-x, y]);
      if (turn === 3) points.push([y, x]);
    }
  }
  // Closed Catmull-Rom spline through the traced points, as cubic Béziers.
  const n = points.length;
  const f = (value: number) => +(value * SPARKLE_RADIUS).toFixed(2);
  let d = `M${f(points[0][0])} ${f(points[0][1])}`;
  for (let i = 0; i < n; i += 1) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d}Z`;
}

const SPARKLE_PATH = buildSparklePath();

/**
 * The connect sparkles, redrawn as vectors from the original 8-frame sprite.
 * Each star follows the positions and sizes measured from those frames (see
 * the keyframes in AdvisorConnectLoader.css), but glides between them instead
 * of cutting, and stays sharp at any size. Back to front: the big star
 * shrinking away, the small star growing into its place, and the small star
 * crossing from bottom right to top left.
 */
function ConnectSparkles() {
  const gradientId = `advisor-connect-gradient-${useId().replace(/:/g, "")}`;
  return (
    <svg
      className="advisor-connect__sparkles"
      viewBox="0 0 276 261"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#567ad2" />
          <stop offset="100%" stopColor="#c96880" />
        </linearGradient>
      </defs>
      {(["shrink", "grow", "cross"] as const).map((track) => (
        <path
          key={track}
          className={`advisor-connect__sparkle advisor-connect__sparkle--${track}`}
          d={SPARKLE_PATH}
          fill={`url(#${gradientId})`}
        />
      ))}
    </svg>
  );
}
