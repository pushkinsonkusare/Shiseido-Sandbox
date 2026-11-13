import { useEffect, useState } from "react";
import { useCatalog } from "../../catalog/CatalogContext";
import { formatPrice, type CatalogProduct } from "../../catalog/catalog";
import { SHELF_NAMES, nextShelves, tierPicks, tierStep } from "../../catalog/tierPairings";
import { SparkleIcon } from "../../components/icons/StorefrontIcons";

/** How long the advisor "reads the cart" before nudging. */
const THINK_MS = 900;

/** Hands the advisor the shopper's ask plus the products to answer with. */
function askAdvisor(prompt: string, picks: CatalogProduct[], intro: string) {
  document.dispatchEvent(
    new CustomEvent("agentic:ask-assistant", {
      detail: { prompt, picks: { slugs: picks.map((p) => p.slug), intro } },
    }),
  );
}

const pct = (fraction: number) => `${Math.round(fraction * 100)}%`;

/** Whole dollars when exact, cents otherwise: "$40", "$12.50". */
function money(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? `$${rounded}` : formatPrice(rounded);
}

type CartTierNudgeProps = {
  /** The products in the cart, one entry per line. */
  cartProducts: CatalogProduct[];
  subtotal: number;
};

/**
 * The cart's spend-tier bar, made agentic: only the next reward, how much
 * it takes to get there, and a few shelves that complete the cart's
 * routine. Each pill hands the advisor the cart, the budget and the shelf,
 * and the advisor brings back the products.
 */
export function CartTierNudge({ cartProducts, subtotal }: CartTierNudgeProps) {
  const { products } = useCatalog();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), THINK_MS);
    return () => window.clearTimeout(t);
  }, []);

  const { current, next, gap, budget } = tierStep(subtotal);
  // Only shelves that have at least two things in budget get a pill, so
  // "Shop serums" never answers with $90 serums for a $45 gap.
  const shelves = next
    ? nextShelves(cartProducts, 7)
        .filter((cat) => tierPicks(cartProducts, products, tierStep(subtotal), cat).length >= 2)
        .slice(0, 3)
    : [];
  const base = current?.threshold ?? 0;
  const fill = next ? Math.min(100, ((subtotal - base) / (next.threshold - base)) * 100) : 100;

  const step = { current, next, gap, budget, subtotal };
  const reward = next ? `${pct(next.fraction)} off` : "";
  /** "$45-$70" from what was actually picked, so the copy never overstates. */
  const spread = (list: CatalogProduct[]) => {
    const prices = list.map((p) => p.price as number);
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    return lo === hi ? money(lo) : `${money(lo)}-${money(hi)}`;
  };

  const pills = next
    ? [
        ...shelves.map((cat) => {
          const name = SHELF_NAMES[cat];
          return {
            label: `Shop ${name}`,
            run: () => {
              const picks = tierPicks(cartProducts, products, step, cat);
              askAdvisor(
                `Show me ${name} that get me to ${reward}`,
                picks,
                picks.length
                  ? `Any of these ${name} (${spread(picks)}) gets you to ${money(next.threshold)}, so ${reward} applies to your whole order. Each one pairs with what's already in your cart.`
                  : "",
              );
            },
          };
        }),
        {
          label: "Suggest anything",
          run: () => {
            const picks = tierPicks(cartProducts, products, step);
            askAdvisor(
              `Suggest anything that gets me to ${reward}`,
              picks,
              picks.length
                ? `Here's a mix (${spread(picks)}) that rounds out your routine. Add any one and you reach ${money(next.threshold)} for ${reward}.`
                : "",
            );
          },
        },
      ]
    : [];

  return (
    <section
      className={`cart-tier${ready ? " cart-tier--ready" : " cart-tier--loading"}`}
      aria-label="Spend rewards"
      aria-busy={!ready}
    >
      <div className="cart-tier__lead">
        <span className="cart-tier__icon" aria-hidden="true">
          <SparkleIcon width={18} height={18} />
        </span>
        {ready ? (
          <div className="cart-tier__copy" aria-live="polite">
            <h2 className="cart-tier__title">
              {next
                ? `You're ${money(gap)} away from ${pct(next.fraction)} off`
                : `You've unlocked our best rate, ${pct(current!.fraction)} off`}
            </h2>
            <p className="cart-tier__body">
              {next
                ? `Add something around ${money(gap)} to reach ${money(next.threshold)} and the discount applies to your whole order.`
                : "It's already on your order. No code needed."}
            </p>
          </div>
        ) : (
          <div className="cart-tier__copy" aria-hidden="true">
            <span className="cart-tier__status">Checking your rewards</span>
            <span className="cart-tier__skel" style={{ width: "62%" }} />
          </div>
        )}
      </div>

      <div className="cart-tier__meter">
        <div
          className="cart-tier__rail"
          role="progressbar"
          aria-label={next ? `Progress to ${pct(next.fraction)} off` : "Best rate reached"}
          aria-valuemin={base}
          aria-valuemax={next?.threshold ?? subtotal}
          aria-valuenow={Math.round(subtotal)}
          aria-valuetext={next ? `${formatPrice(subtotal)} of ${formatPrice(next.threshold)}` : undefined}
        >
          <div className="cart-tier__fill" style={{ width: `${fill}%` }} />
        </div>
        {next && (
          <div className="cart-tier__ends" aria-hidden="true">
            <span>{formatPrice(subtotal)} in cart</span>
            <span>
              {money(next.threshold)} · {pct(next.fraction)} off
            </span>
          </div>
        )}
      </div>

      {ready && pills.length > 0 && (
        <ul className="cart-tier__pills" aria-label="Find something to reach the discount">
          {pills.map((pill, i) => (
            <li key={pill.label} style={{ animationDelay: `${i * 60}ms` }}>
              <button
                type="button"
                className={`cart-tier__pill${i === pills.length - 1 ? " cart-tier__pill--any" : ""}`}
                onClick={pill.run}
              >
                {i === pills.length - 1 && <SparkleIcon width={14} height={14} aria-hidden="true" />}
                {pill.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
