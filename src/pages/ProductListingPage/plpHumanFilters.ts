import type { CatalogProduct } from "../../catalog/catalog";

/**
 * Plain-language shelf filters for the mid-grid break. Each one reads like
 * something a shopper would say about their skin and narrows the grid in
 * place, without opening the advisor.
 */
export type HumanFilter = {
  id: string;
  /** What the shopper taps, in their words. */
  label: string;
  /** The small heading shown over the filtered grid, e.g. "For dry, tight skin". */
  heading: string;
  test: (product: CatalogProduct) => boolean;
};

/** Name, short description, benefits and concern tags, lowercased. */
function copyOf(p: CatalogProduct) {
  return [p.title, p.shortDescription, p.keyBenefits.join(" "), p.primaryActivities.join(" ")]
    .join(" ")
    .toLowerCase();
}

function mentions(pattern: RegExp) {
  return (p: CatalogProduct) => pattern.test(copyOf(p));
}

/** Tagged for one skin type and not its opposite, so "oily" doesn't also mean "dry". */
function onlyFor(type: string, opposite: string) {
  return (p: CatalogProduct) => p.subtypes.includes(type) && !p.subtypes.includes(opposite);
}

/** A friendly price ceiling a little under the shelf's middle price. */
export function budgetCeiling(products: CatalogProduct[]) {
  const prices = products
    .map((p) => p.price)
    .filter((p): p is number => typeof p === "number" && p > 0)
    .sort((a, b) => a - b);
  if (prices.length < 4) return null;
  const median = prices[Math.floor(prices.length / 2)];
  const ceiling = Math.max(20, Math.floor((median * 0.75) / 10) * 10);
  return prices[0] < ceiling ? ceiling : null;
}

function candidates(products: CatalogProduct[]): HumanFilter[] {
  const ceiling = budgetCeiling(products);
  const dry = mentions(/hydrat|moistur|dryness|dry skin|dehydrat|plump|nourish/);
  const dryOnly = onlyFor("dry", "oily");
  const shine = mentions(/oil[- ]control|shine|pore|matte|sebum|oily/);
  const oilyOnly = onlyFor("oily", "dry");
  return [
    {
      id: "dry",
      label: "My skin feels dry and tight",
      heading: "For dry, tight skin",
      test: (p) => dry(p) || dryOnly(p),
    },
    {
      id: "tired",
      label: "I'm looking a bit tired",
      heading: "For a brighter, more rested look",
      test: mentions(/radian|bright|glow|dull|fatigue|revitaliz|energi/),
    },
    {
      id: "lines",
      label: "Fine lines are starting to show",
      heading: "For fine lines and firmness",
      test: mentions(/wrinkle|fine line|firm|lift|sagg|anti-aging|elastic/),
    },
    {
      id: "shine",
      label: "I get shiny by midday",
      heading: "For shine and pores",
      test: (p) => shine(p) || oilyOnly(p),
    },
    ...(ceiling
      ? [
          {
            id: "budget",
            label: `I'd rather stay under $${ceiling}`,
            heading: `Under $${ceiling}`,
            test: (p: CatalogProduct) => typeof p.price === "number" && p.price < ceiling,
          },
        ]
      : []),
    {
      id: "sensitive",
      label: "My skin reacts easily",
      heading: "Gentle on reactive skin",
      test: mentions(/sensitive|gentle|sooth|calm|irritat/),
    },
    {
      id: "loved",
      label: "Show me what people love",
      heading: "Shopper favourites",
      test: (p) => (p.rating ?? 0) >= 4.6 && (p.reviewCount ?? 0) >= 50,
    },
  ];
}

/**
 * The filters worth offering on this shelf: each must leave at least two
 * products and actually narrow the grid. Capped so the row stays short.
 */
export function humanFiltersFor(products: CatalogProduct[], max = 6): HumanFilter[] {
  return candidates(products)
    .filter((f) => {
      const n = products.filter(f.test).length;
      return n >= 2 && n < products.length;
    })
    .slice(0, max);
}

export function findHumanFilter(products: CatalogProduct[], id: string | null) {
  if (!id) return null;
  return candidates(products).find((f) => f.id === id) ?? null;
}
