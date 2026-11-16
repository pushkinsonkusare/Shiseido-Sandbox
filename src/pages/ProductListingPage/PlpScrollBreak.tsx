import { useEffect, useRef, useState } from "react";
import type { CatalogProduct } from "../../catalog/catalog";
import { humanFiltersFor, type HumanFilter } from "./plpHumanFilters";

/** A short beat before the chips settle in once the strip scrolls into view. */
const SETTLE_MS = 500;

/**
 * Starts the reveal only when the strip actually reaches the shopper, so it
 * reads as a response to their scrolling.
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
    const t = window.setTimeout(() => setReady(true), SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [seen]);
  return { ref, ready };
}

type PlpScrollBreakProps = {
  /** Every product on the shelf. */
  products: CatalogProduct[];
  /** The products above the strip, which the shopper has scrolled past. */
  passed: CatalogProduct[];
  /** Narrows the grid to the chosen filter. */
  onFilter: (filter: HumanFilter) => void;
};

/**
 * A breather mid-grid for shoppers who have scrolled a while without
 * finding a fit. Shoppers still scrolling would rather browse than chat, so
 * it offers a few plain-language filters that narrow the grid in place
 * instead of handing them to the advisor.
 */
export function PlpScrollBreak({ products, passed, onFilter }: PlpScrollBreakProps) {
  const { ref, ready } = useRevealOnView<HTMLElement>();
  const filters = humanFiltersFor(products);
  if (filters.length === 0) return null;

  return (
    <aside
      ref={ref}
      className={
        ready
          ? "plp-explainer plp-scroll-break plp-scroll-break--ready"
          : "plp-explainer plp-scroll-break plp-scroll-break--loading"
      }
      aria-label="Narrow these products down"
    >
      <div className="plp-scroll-break__lead">
        <div className="plp-scroll-break__copy">
          <h2 className="plp-scroll-break__title">
            {passed.length} in and still looking?
          </h2>
          <p className="plp-scroll-break__body">
            Tell us what's going on with your skin and we'll trim the shelf to match.
          </p>
        </div>
      </div>

      <ul className="plp-scroll-break__reasons" aria-label="What sounds like you">
        {filters.map((f, i) => (
          <li key={f.id} style={{ animationDelay: `${60 + i * 60}ms` }}>
            <button
              type="button"
              className="plp-explainer__pill"
              onClick={() => onFilter(f)}
            >
              {f.label}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
