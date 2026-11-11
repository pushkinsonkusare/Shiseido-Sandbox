import { CheckIcon, TagIcon } from "../../icons/StorefrontIcons";
import {
  AgentProductCarousel,
  type AgentCarouselProduct,
} from "./AgentProductCarousel";
import "./AgentMessageCards.css";

export type AgentCartUpsellTier = {
  /** Order value that unlocks this tier, in dollars. */
  threshold: number;
  /** Coupon code applied automatically at this tier, e.g. "SPEND100". */
  code: string;
  /** Discount as a fraction, e.g. 0.15. */
  fraction: number;
};

export type AgentCartUpsellProps = {
  /** Spend milestones, lowest first. */
  tiers: readonly AgentCartUpsellTier[];
  /** Current cart subtotal, in dollars. */
  subtotal: number;
  /** Products that help the shopper reach the next milestone. */
  products: AgentCarouselProduct[];
  /** Adds a product (by id) to the cart. */
  onAdd: (id: string) => void;
  /** True while an add is in flight; further adds are held. */
  busy?: boolean;
  /** Optional class name appended to the root element. */
  className?: string;
};

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const usdWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const percent = (fraction: number) => `${Math.round(fraction * 100)}%`;

/**
 * AgentCartUpsell is the spend-milestone widget shown beneath the cart in the
 * "in panel" cart view. It tracks progress across the tiers, names the next
 * one, and offers a carousel of products that close the gap; each tier's
 * coupon applies itself once the cart crosses its line.
 */
export function AgentCartUpsell({
  tiers,
  subtotal,
  products,
  onAdd,
  busy = false,
  className,
}: AgentCartUpsellProps) {
  const top = tiers[tiers.length - 1];
  const reached = [...tiers].reverse().find((tier) => subtotal >= tier.threshold);
  const next = tiers.find((tier) => subtotal < tier.threshold);
  const remaining = next ? next.threshold - subtotal : 0;
  const progress = Math.min(1, subtotal / top.threshold);

  let title: string;
  let body: string;
  if (!reached && next) {
    title = `Receive ${percent(next.fraction)} off orders of ${usdWhole.format(next.threshold)} or more`;
    body = `You're ${usd.format(remaining)} away. Add one of these and ${next.code} applies automatically.`;
  } else if (reached && next) {
    title = `You've unlocked ${percent(reached.fraction)} off`;
    body = `${reached.code} is applied. Add ${usd.format(remaining)} more to get ${percent(next.fraction)} off at ${usdWhole.format(next.threshold)}.`;
  } else {
    title = `You've unlocked ${percent(top.fraction)} off`;
    body = `${top.code} is applied, our best offer. Anything else you add gets ${percent(top.fraction)} off too.`;
  }

  return (
    <article
      className={"agent-summary__card agent-upsell" + (className ? " " + className : "")}
      data-component="agent-cart-upsell"
    >
      <div className="agent-summary__card-content">
        <div className="agent-summary__row agent-upsell__head">
          <span
            className={
              "agent-upsell__icon" + (reached ? " agent-upsell__icon--done" : "")
            }
            aria-hidden="true"
          >
            {reached ? (
              <CheckIcon width={16} height={16} />
            ) : (
              <TagIcon width={16} height={16} />
            )}
          </span>
          <div className="agent-upsell__copy">
            <p className="agent-upsell__title">{title}</p>
            <p className="agent-upsell__body">{body}</p>
          </div>
        </div>

        <div className="agent-summary__row">
          <div
            className="agent-upsell__track"
            role="progressbar"
            aria-label={`Cart total ${usd.format(subtotal)} toward ${usdWhole.format(top.threshold)}`}
            aria-valuemin={0}
            aria-valuemax={top.threshold}
            aria-valuenow={Math.min(subtotal, top.threshold)}
          >
            <div className="agent-upsell__progress">
              <span
                className="agent-upsell__progress-fill"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            {tiers.map((tier) => (
              <span
                key={tier.code}
                className={
                  "agent-upsell__milestone" +
                  (subtotal >= tier.threshold ? " agent-upsell__milestone--reached" : "")
                }
                style={{ left: `${(tier.threshold / top.threshold) * 100}%` }}
                aria-hidden="true"
              >
                {subtotal >= tier.threshold ? <CheckIcon width={10} height={10} /> : null}
              </span>
            ))}
          </div>
          <div className="agent-upsell__milestone-labels" aria-hidden="true">
            {tiers.map((tier) => (
              <span
                key={tier.code}
                className={
                  "agent-upsell__milestone-label" +
                  (subtotal >= tier.threshold ? " agent-upsell__milestone-label--reached" : "") +
                  (tier === next ? " agent-upsell__milestone-label--next" : "")
                }
                style={{ left: `${(tier.threshold / top.threshold) * 100}%` }}
              >
                <span className="agent-upsell__milestone-value">
                  {usdWhole.format(tier.threshold)}
                </span>
                <span>{percent(tier.fraction)} off</span>
              </span>
            ))}
          </div>
        </div>

        {products.length > 0 ? (
          <div
            className="agent-summary__row agent-upsell__carousel"
            aria-busy={busy}
          >
            <AgentProductCarousel
              products={products}
              showMoreCard={false}
              onAddToCart={busy ? undefined : onAdd}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default AgentCartUpsell;
