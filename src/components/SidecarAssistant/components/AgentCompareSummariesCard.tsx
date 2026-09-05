import { type ReactNode } from "react";
import { PlusIcon } from "../../icons/StorefrontIcons";
import "./AgentMessageCards.css";

export type AgentCompareSummaryProduct = {
  slug: string;
  imageUrl: string;
  imageAlt: string;
  title: string;
  category: string;
  price: string;
  comparePrice?: string;
  /** Short narrative blurb for this product (when to use it / who it's for). */
  summary: string;
};

export type AgentCompareSummariesCardProps = {
  /** Body copy rendered above the product stack. */
  intro: string;
  /** Products compared, in selection order. */
  summaries: AgentCompareSummaryProduct[];
  /** Optional closing recommendation shown beneath the stack. */
  recommendation?: string;
  /** Slug of the recommended product, bolded inside the recommendation copy. */
  recommendedSlug?: string;
  /** Invoked with a product slug when its thumbnail / title is tapped. */
  onSelect?: (slug: string) => void;
  /** Invoked with a product slug when its add-to-cart control is tapped. */
  onAddToCart?: (slug: string) => void;
};

/** Renders the recommendation copy, bolding the recommended product's title
 * where it appears inline. */
function renderRecommendation(text: string, boldTitle?: string): ReactNode {
  if (!boldTitle) return text;
  const index = text.indexOf(boldTitle);
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <strong>{boldTitle}</strong>
      {text.slice(index + boldTitle.length)}
    </>
  );
}

/**
 * Stacked per-product summary compare card: thumb, name/category/price, and
 * a narrative blurb for each selected SKU, followed by a recommendation.
 * Used when Compare Type is "Product summaries".
 */
export function AgentCompareSummariesCard({
  intro,
  summaries,
  recommendation,
  recommendedSlug,
  onSelect,
  onAddToCart,
}: AgentCompareSummariesCardProps) {
  if (summaries.length === 0) return null;

  const recommendedTitle = recommendedSlug
    ? summaries.find((product) => product.slug === recommendedSlug)?.title
    : undefined;

  return (
    <article
      className="agent-compare agent-compare--summaries"
      data-component="agent-compare-summaries-card"
    >
      <p className="agent-compare__intro">{intro}</p>

      <div className="agent-compare-summaries">
        {summaries.map((product) => {
          const isRecommended = product.slug === recommendedSlug;
          return (
            <section
              key={product.slug}
              className={
                "agent-compare-summaries__product" +
                (isRecommended
                  ? " agent-compare-summaries__product--recommended"
                  : "")
              }
            >
              <div className="agent-compare-summaries__top">
                <button
                  type="button"
                  className="agent-compare-summaries__header"
                  onClick={() => onSelect?.(product.slug)}
                >
                  <img
                    className="agent-compare-summaries__thumb"
                    src={product.imageUrl}
                    alt={product.imageAlt}
                  />
                  <span className="agent-compare-summaries__meta">
                    <span className="agent-compare-summaries__title">
                      {product.title}
                    </span>
                    <span className="agent-compare-summaries__category">
                      {product.category}
                    </span>
                    <span className="agent-compare-summaries__price-row">
                      <span className="agent-compare-summaries__price">
                        {product.price.replace(/^From\s+/i, "")}
                      </span>
                      {product.comparePrice ? (
                        <span className="agent-compare-summaries__price--strike">
                          {product.comparePrice}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
                {onAddToCart ? (
                  <button
                    type="button"
                    className="agent-product-card__cart-btn"
                    aria-label="Add to cart"
                    onClick={() => onAddToCart(product.slug)}
                  >
                    <PlusIcon width={18} height={18} />
                  </button>
                ) : null}
              </div>

              {product.summary.trim() ? (
                <p className="agent-compare-summaries__summary">
                  {product.summary.trim()}
                </p>
              ) : null}
            </section>
          );
        })}
      </div>

      {recommendation ? (
        <p className="agent-compare__recommendation">
          <span className="agent-compare__recommendation-label">
            Recommendation:{" "}
          </span>
          {renderRecommendation(recommendation, recommendedTitle)}
        </p>
      ) : null}
    </article>
  );
}

export default AgentCompareSummariesCard;
