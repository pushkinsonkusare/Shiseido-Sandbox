import { useEffect, useState } from "react";
import { ChevronRightSlimIcon, SparkleIcon } from "../../components/icons/StorefrontIcons";
import { blogPhotoUrl, getBlogArticle } from "../BlogPage/blogArticles";
import { ROUTES, usePrototypeNavigation } from "../../prototypeRoutes";
import type { PlpExplainer } from "./plpExplainers";

type PlpExplainerStripProps = {
  explainer: PlpExplainer;
};

/** Opens the advisor with the pill's question as the shopper's turn. */
function askAdvisor(prompt: string) {
  if (typeof document === "undefined") return;
  document.dispatchEvent(
    new CustomEvent("agentic:ask-assistant", { detail: { prompt } }),
  );
}

/** How long the strip "thinks" before the guide and pills appear. */
const GENERATE_MS = 1100;

/** Rough pill widths so the skeleton matches the real layout. */
const SKELETON_PILL_WIDTHS = [148, 124, 156, 132];

/** Shows the AI "writing" the guide, then reveals it. Replays per category. */
function useGenerated(key: string) {
  const [readyKey, setReadyKey] = useState<string | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setReadyKey(key), GENERATE_MS);
    return () => window.clearTimeout(t);
  }, [key]);
  return readyKey === key;
}

function ExplainerSkeleton({ pillCount }: { pillCount: number }) {
  return (
    <>
      <div className="plp-explainer__text" aria-hidden="true">
        <span className="plp-explainer__status">
          Writing a quick guide for you
        </span>
        <span className="plp-skel plp-skel--line" style={{ width: "92%" }} />
        <span className="plp-skel plp-skel--line" style={{ width: "68%" }} />
        <span className="plp-skel plp-skel--source" />
      </div>
      <ul className="plp-explainer__pills" aria-hidden="true">
        {SKELETON_PILL_WIDTHS.slice(0, pillCount).map((w, i) => (
          <li key={i}>
            <span
              className="plp-skel plp-skel--pill"
              style={{ width: w, animationDelay: `${i * 90}ms` }}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

/** The guide's photo, or the cited article's, resolved to a URL. */
function explainerPhoto(explainer: PlpExplainer) {
  if (explainer.image) {
    return {
      src: `${import.meta.env.BASE_URL}${explainer.image.src.replace(/^\//, "")}`,
      position: explainer.image.position,
    };
  }
  if (explainer.source) {
    return {
      src: blogPhotoUrl(explainer.source.slug),
      position: getBlogArticle(explainer.source.slug)?.photoPosition,
    };
  }
  return null;
}

/**
 * A photo of the shopper's situation. While the guide is "writing",
 * the tile shimmers with the sparkle in the middle.
 */
function ExplainerMedia({ explainer, ready }: { explainer: PlpExplainer; ready: boolean }) {
  const photo = explainerPhoto(explainer);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showPhoto = ready && photo !== null && failedSrc !== photo.src;
  return (
    <span
      className={
        photo && failedSrc !== photo.src
          ? "plp-explainer__media"
          : "plp-explainer__media plp-explainer__media--icon"
      }
      aria-hidden="true"
    >
      {showPhoto && (
        <img
          className="plp-explainer__photo"
          src={photo.src}
          alt=""
          style={{ objectPosition: photo.position }}
          onError={() => setFailedSrc(photo.src)}
        />
      )}
      {!showPhoto && (
        <span className="plp-explainer__icon">
          <SparkleIcon width={20} height={20} />
        </span>
      )}
    </span>
  );
}

/**
 * Sits between the PLP header and the filters + grid. Teaches the
 * category in two lines, then hands off to the advisor.
 */
export function PlpExplainerStrip({ explainer }: PlpExplainerStripProps) {
  const { navigateToBlogArticle } = usePrototypeNavigation();
  const ready = useGenerated(explainer.id);
  return (
    <section
      className={
        ready
          ? "plp-explainer plp-explainer--ready"
          : "plp-explainer plp-explainer--loading"
      }
      aria-labelledby={ready ? `plp-explainer-${explainer.id}` : undefined}
      aria-label={ready ? undefined : "Writing a quick guide"}
      aria-busy={!ready}
    >
      <div className="plp-explainer__inner">
        <ExplainerMedia explainer={explainer} ready={ready} />
        {!ready ? (
          <ExplainerSkeleton
            pillCount={Math.min(
              explainer.pills.length,
              SKELETON_PILL_WIDTHS.length,
            )}
          />
        ) : (
          <>
            <div className="plp-explainer__text">
              <h2
                className="plp-explainer__title"
                id={`plp-explainer-${explainer.id}`}
              >
                {explainer.title}
              </h2>
              <p className="plp-explainer__body">{explainer.body}</p>
              {explainer.source && (
                <a
                  className={
                    explainer.image
                      ? "plp-explainer__source"
                      : "plp-explainer__source plp-explainer__source--same-photo"
                  }
                  href={`${ROUTES.blog}/${explainer.source.slug}`}
                  onClick={(event) => {
                    event.preventDefault();
                    navigateToBlogArticle(explainer.source!.slug);
                  }}
                >
                  <img
                    className="plp-explainer__source-thumb"
                    src={blogPhotoUrl(explainer.source.slug)}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                    }}
                    style={{
                      objectPosition: getBlogArticle(explainer.source.slug)?.photoPosition,
                    }}
                  />
                  <span className="plp-explainer__source-kicker">From the Skincare Blog</span>
                  <span className="plp-explainer__source-title">{explainer.source.label}</span>
                  {getBlogArticle(explainer.source.slug) && (
                    <span className="plp-explainer__source-meta">
                      {getBlogArticle(explainer.source.slug)!.readMinutes} min read
                    </span>
                  )}
                  <ChevronRightSlimIcon
                    className="plp-explainer__source-arrow"
                    width={14}
                    height={14}
                    aria-hidden="true"
                  />
                </a>
              )}
            </div>
            <ul className="plp-explainer__pills" aria-label="Ask the advisor">
              {explainer.pills.map((pill, i) => (
                <li
                  key={pill.label}
                  style={{ animationDelay: `${120 + i * 70}ms` }}
                >
                  <button
                    type="button"
                    className="plp-explainer__pill"
                    onClick={() => askAdvisor(pill.prompt)}
                  >
                    {pill.label}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
