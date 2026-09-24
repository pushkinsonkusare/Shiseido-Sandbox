import { StarIcon } from "../../icons/StorefrontIcons";
import "./AgentMessageCards.css";

export type AgentReviewsSummaryProps = {
  rating?: number | null;
  reviewCount?: number | null;
  summary: string;
  excerpt: string;
  reviewer?: string;
  className?: string;
};

/**
 * Review summary card: a quiet rating line, a shopper-voice paragraph,
 * and one quoted excerpt attributed to a reviewer.
 */
export function AgentReviewsSummary({
  rating,
  reviewCount,
  summary,
  excerpt,
  reviewer,
  className,
}: AgentReviewsSummaryProps) {
  const rootClass =
    "agent-msg__card agent-msg__card--padded" +
    (className ? ` ${className}` : "");
  const hasRating = typeof rating === "number";
  const hasCount = typeof reviewCount === "number";
  const meta = hasRating
    ? hasCount
      ? `${rating.toFixed(1)} out of 5 \u00b7 ${reviewCount.toLocaleString()} reviews`
      : `${rating.toFixed(1)} out of 5`
    : hasCount
      ? `${reviewCount.toLocaleString()} reviews`
      : null;
  const paragraphs = summary
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    <article className={rootClass} data-component="agent-reviews-summary">
      <div className="agent-msg__content agent-reviews">
        {meta ? (
          <div className="agent-msg__row">
            <p
              className="agent-reviews__meta"
              aria-label={
                hasRating
                  ? hasCount
                    ? `Rated ${rating.toFixed(1)} out of 5 from ${reviewCount.toLocaleString()} reviews`
                    : `Rated ${rating.toFixed(1)} out of 5`
                  : meta
              }
            >
              {hasRating ? (
                <>
                  <span className="agent-reviews__rating">
                    {rating.toFixed(1)}
                  </span>
                  <StarIcon
                    width={12}
                    height={12}
                    className="agent-reviews__star"
                  />
                  <span>out of 5</span>
                  {hasCount ? (
                    <span className="agent-reviews__count">
                      {" \u00b7 "}
                      {reviewCount.toLocaleString()} reviews
                    </span>
                  ) : null}
                </>
              ) : (
                meta
              )}
            </p>
          </div>
        ) : null}

        {paragraphs.length > 0 ? (
          <div className="agent-msg__row agent-reviews__copy">
            {paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 48)} className="agent-reviews__summary">
                {paragraph}
              </p>
            ))}
          </div>
        ) : null}

        {excerpt ? (
          <figure className="agent-msg__row agent-reviews__quote">
            <blockquote className="agent-reviews__excerpt">
              &ldquo;{excerpt}&rdquo;
            </blockquote>
            {reviewer ? (
              <figcaption className="agent-reviews__reviewer">
                {" "}- {reviewer.replace(/ /g, "\u00A0")}
              </figcaption>
            ) : null}
          </figure>
        ) : null}
      </div>
    </article>
  );
}

export default AgentReviewsSummary;
