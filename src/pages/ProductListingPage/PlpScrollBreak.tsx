import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CatalogProduct } from "../../catalog/catalog";
import { SendHorizontalIcon, SparkleIcon } from "../../components/icons/StorefrontIcons";

/** Opens the advisor with the prompt as the shopper's own turn. */
function askAdvisor(prompt: string) {
  if (typeof document === "undefined") return;
  document.dispatchEvent(
    new CustomEvent("agentic:ask-assistant", { detail: { prompt } }),
  );
}

/** How long the strip "reads the shelf" once it scrolls into view. */
const THINK_MS = 900;

/**
 * Starts the "thinking" beat only when the strip actually reaches the
 * shopper, so the reveal reads as a response to their scrolling.
 */
function useRevealOnView<T extends Element>() {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [seen]);
  useEffect(() => {
    if (!seen) return;
    const t = window.setTimeout(() => setReady(true), THINK_MS);
    return () => window.clearTimeout(t);
  }, [seen]);
  return { ref, ready };
}

/** A friendly price ceiling a little under the shelf's middle price. */
function budgetCeiling(products: CatalogProduct[]) {
  const prices = products
    .map((p) => p.price)
    .filter((p): p is number => typeof p === "number" && p > 0)
    .sort((a, b) => a - b);
  if (prices.length < 4) return null;
  const median = prices[Math.floor(prices.length / 2)];
  const ceiling = Math.max(20, Math.floor((median * 0.75) / 10) * 10);
  return prices[0] < ceiling ? ceiling : null;
}

/** The best-reviewed of the products the shopper has already passed. */
function topPassed(passed: CatalogProduct[]) {
  return [...passed]
    .sort(
      (a, b) =>
        (b.rating ?? 0) * Math.log10((b.reviewCount ?? 0) + 10) -
        (a.rating ?? 0) * Math.log10((a.reviewCount ?? 0) + 10),
    )
    .slice(0, 3);
}

type PlpScrollBreakProps = {
  /** Shelf name as shown in the heading, e.g. "Serums". */
  shelfLabel: string;
  /** Every product on the shelf. */
  products: CatalogProduct[];
  /** The products above the strip, which the shopper has scrolled past. */
  passed: CatalogProduct[];
};

/**
 * A breather mid-grid for shoppers who have scrolled a while without
 * finding a fit. It names what they've passed, offers the usual reasons
 * nothing clicked, and hands each one to the advisor with the shelf as
 * context.
 */
export function PlpScrollBreak({ shelfLabel, products, passed }: PlpScrollBreakProps) {
  const { ref, ready } = useRevealOnView<HTMLElement>();
  const [draft, setDraft] = useState("");
  const shelf = shelfLabel.toLowerCase();
  const total = products.length;
  const picks = topPassed(passed);
  const ceiling = budgetCeiling(products);

  const reasons: { label: string; prompt: string }[] = [
    {
      label: "Where do I even start?",
      prompt: `I've been scrolling the ${shelf} shelf (${total} products) and nothing stands out. Ask me a couple of quick questions about my skin, then narrow it to three.`,
    },
    {
      label: "Not sure it suits my skin",
      prompt: `Which of the ${shelf} products actually suit my skin type and concerns? Ask me what you need to know first.`,
    },
    ...(ceiling
      ? [
          {
            label: `Something under $${ceiling}`,
            prompt: `Show me the best ${shelf} products under $${ceiling} and what I'd give up versus the pricier ones.`,
          },
        ]
      : []),
  ];

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    askAdvisor(`I'm browsing ${shelf}. ${text}`);
    setDraft("");
  };

  return (
    <aside
      ref={ref}
      className={
        ready
          ? "plp-explainer plp-scroll-break plp-scroll-break--ready"
          : "plp-explainer plp-explainer--loading plp-scroll-break plp-scroll-break--loading"
      }
      aria-label="Help finding the right product"
      aria-busy={!ready}
    >
      <div className="plp-scroll-break__lead">
        <span className="plp-scroll-break__icon" aria-hidden="true">
          <SparkleIcon width={18} height={18} />
        </span>
        {ready ? (
          <div className="plp-scroll-break__copy">
            <h2 className="plp-scroll-break__title">
              {passed.length} products in, nothing quite right?
            </h2>
            <p className="plp-scroll-break__body">
              Tell me what's missing and I'll narrow these {total} down to the few worth your time.
            </p>
          </div>
        ) : (
          <div className="plp-scroll-break__copy" aria-hidden="true">
            <span className="plp-explainer__status">Reading the shelf</span>
            <span className="plp-skel plp-skel--line" style={{ width: "70%" }} />
          </div>
        )}
      </div>

      {ready && (
        <div className="plp-scroll-break__actions">
          {picks.length >= 2 && (
            <button
              type="button"
              className="plp-scroll-break__compare"
              onClick={() =>
                askAdvisor(
                  `Compare ${picks.map((p) => p.title).join(", ")} for me and tell me which one suits my skin best.`,
                )
              }
            >
              <span className="plp-scroll-break__thumbs" aria-hidden="true">
                {picks.map((p) => (
                  <img key={p.slug} src={p.imageUrl} alt="" loading="lazy" />
                ))}
              </span>
              <span className="plp-scroll-break__compare-text">
                <span className="plp-scroll-break__compare-title">
                  Compare the top {picks.length} you've passed
                </span>
                <span className="plp-scroll-break__compare-meta">Side by side, for your skin</span>
              </span>
            </button>
          )}

          <ul className="plp-scroll-break__reasons" aria-label="What's not working">
            {reasons.map((r, i) => (
              <li key={r.label} style={{ animationDelay: `${80 + i * 70}ms` }}>
                <button
                  type="button"
                  className="plp-explainer__pill"
                  onClick={() => askAdvisor(r.prompt)}
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>

          <form className="plp-scroll-break__ask" onSubmit={onSubmit}>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Or describe it, like “light, for oily skin”"
              aria-label={`Describe the ${shelf} you're after`}
            />
            <button type="submit" aria-label="Ask the Beauty Advisor" disabled={!draft.trim()}>
              <SendHorizontalIcon width={16} height={16} />
            </button>
          </form>
        </div>
      )}
    </aside>
  );
}
