import { useEffect, useMemo, useState } from "react";
import { useCatalog } from "../../catalog/CatalogContext";
import { dismissProactiveBadge } from "../../hooks/useProactiveNudge";
import type { AskAssistantEventDetail } from "../../pages/ProductDetailPage/PdpNbaPanel";
import { ROUTES, usePrototypeNavigation } from "../../prototypeRoutes";
import { useAgentMode } from "../AgentModeBar/AgentModeContext";
import "./FabQuestionChips.css";

/**
 * A light, proactive offer of help: once the shopper has spent a few seconds
 * on the home page, a listing, a product or the cart, three short questions
 * fade in above the advisor FAB. Tapping one asks the advisor; the close
 * button (or opening the advisor any other way) puts them away. Each page
 * offers them once per visit, so they never come back after being dismissed.
 */

/** How long the shopper stays on a page before the questions appear. */
const DWELL_MS = 3500;

type PageKind = "home" | "listing" | "product" | "cart";

const QUESTIONS: Record<PageKind, string[]> = {
  home: [
    "What suits my skin type?",
    "Build me a simple routine",
    "What's new this season?",
  ],
  listing: [
    "Help me narrow these down",
    "Which one is best for dry skin?",
    "What do shoppers love most?",
  ],
  product: [
    "Is this right for my skin?",
    "How do I fit it into my routine?",
    "What pairs well with it?",
  ],
  cart: [
    "Am I missing a routine step?",
    "Will these work well together?",
    "Any samples or offers for me?",
  ],
};

/** Pages already offered this visit; each one offers once. */
const offered = new Set<string>();

function pageKindFor(route: string): PageKind | null {
  if (route === ROUTES.home) return "home";
  if (route === ROUTES.productListing) return "listing";
  if (route === ROUTES.productDetail) return "product";
  if (route === ROUTES.cart) return "cart";
  return null;
}

type FabQuestionChipsProps = {
  /** False while the advisor is open or the FAB is hidden. */
  active: boolean;
};

export function FabQuestionChips({ active }: FabQuestionChipsProps) {
  const { currentRoute, currentProductSlug } = usePrototypeNavigation();
  const { cartLines } = useCatalog();
  const { contextualNbas } = useAgentMode();
  // Switching the gate off resets the once-per-page record, so turning it
  // back on in the control panel offers the questions again.
  useEffect(() => {
    if (!contextualNbas) offered.clear();
  }, [contextualNbas]);
  active = active && contextualNbas;
  const kind = pageKindFor(currentRoute);
  const productSlug = kind === "product" ? currentProductSlug : null;
  // An empty cart has nothing to ask about.
  const eligible = kind !== null && (kind !== "cart" || cartLines.length > 0);
  const pageKey = kind ? `${kind}:${productSlug ?? ""}` : null;

  const [shownKey, setShownKey] = useState<string | null>(null);

  // Re-arm on every page: wait out the dwell, then offer once.
  useEffect(() => {
    setShownKey(null);
    if (!active || !eligible || !pageKey || offered.has(pageKey)) return;
    const timer = window.setTimeout(() => {
      offered.add(pageKey);
      setShownKey(pageKey);
    }, DWELL_MS);
    return () => window.clearTimeout(timer);
  }, [active, eligible, pageKey]);

  const questions = useMemo(() => (kind ? QUESTIONS[kind] : []), [kind]);
  const visible = active && shownKey !== null && shownKey === pageKey;
  if (!visible) return null;

  const ask = (prompt: string) => {
    setShownKey(null);
    // The chip already asks about this page, so the entry-point badge is spent.
    dismissProactiveBadge();
    const detail: AskAssistantEventDetail = productSlug
      ? { prompt, productSlug, pillKind: "faq" }
      : { prompt };
    document.dispatchEvent(
      new CustomEvent<AskAssistantEventDetail>("agentic:ask-assistant", { detail }),
    );
  };

  return (
    <div className="fab-questions" role="group" aria-label="Suggested questions for the Beauty Advisor">
      <button
        type="button"
        className="fab-questions__close"
        aria-label="Dismiss suggestions"
        onClick={() => setShownKey(null)}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {questions.map((question, index) => (
        <button
          key={question}
          type="button"
          className="fab-questions__chip"
          style={{ animationDelay: `${index * 90}ms` }}
          onClick={() => ask(question)}
        >
          {question}
        </button>
      ))}
    </div>
  );
}

export default FabQuestionChips;
