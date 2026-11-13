import type { CatalogProduct } from "./catalog";
import { SPEND_TIERS, spendTierFor } from "./spendTiers";

/** What the cart gets at the next spend line, and what it costs to get there. */
export type TierStep = {
  subtotal: number;
  current: (typeof SPEND_TIERS)[number] | undefined;
  next: (typeof SPEND_TIERS)[number] | undefined;
  /** Dollars still needed to reach `next` (0 at the top tier). */
  gap: number;
  /** The range worth suggesting: enough to clear the line, not much more. */
  budget: { min: number; max: number };
};

export function tierStep(subtotal: number): TierStep {
  const current = spendTierFor(subtotal);
  const next = SPEND_TIERS.find((tier) => subtotal < tier.threshold);
  const gap = next ? Math.max(0, Math.ceil(next.threshold - subtotal)) : 0;
  // Headroom of half the gap, $10-$25, so a $35 gap looks at $35-$55.
  const slack = Math.min(25, Math.max(10, gap * 0.5));
  const budget = { min: gap, max: Math.ceil((gap + slack) / 5) * 5 };
  return { subtotal, current, next, gap, budget };
}

/**
 * Which routine steps complete a cart category, best match first. Keyed by
 * the dataset's category names.
 */
const COMPLEMENTS: Record<string, string[]> = {
  Moisturizers: ["Serums & Treatments", "Sunscreen", "Eye & Lip Care", "Cleansers"],
  "Serums & Treatments": ["Moisturizers", "Sunscreen", "Eye & Lip Care", "Softeners"],
  Cleansers: ["Softeners", "Moisturizers", "Masks"],
  Sunscreen: ["Cleansers", "Moisturizers", "Serums & Treatments"],
  Softeners: ["Serums & Treatments", "Moisturizers", "Cleansers"],
  "Eye & Lip Care": ["Serums & Treatments", "Moisturizers", "Sunscreen"],
  Masks: ["Softeners", "Moisturizers", "Serums & Treatments"],
  "Sets & Bundles": ["Sunscreen", "Eye & Lip Care", "Cleansers"],
};

/** Used when nothing in the cart maps to a routine step. */
const DEFAULT_SHELVES = ["Sunscreen", "Serums & Treatments", "Moisturizers", "Cleansers"];

/** How each shelf reads on a pill and in a prompt. */
export const SHELF_NAMES: Record<string, string> = {
  Moisturizers: "moisturizers",
  "Serums & Treatments": "serums",
  Cleansers: "cleansers",
  Sunscreen: "sunscreen",
  Softeners: "softeners",
  "Eye & Lip Care": "eye care",
  Masks: "masks",
};

/**
 * The shelves that complete the cart's routine, best first. A shelf the
 * cart already covers never comes back: a moisturizer in the cart suggests
 * serums and sunscreen, not more moisturizers.
 */
export function nextShelves(cart: CatalogProduct[], limit = 3): string[] {
  const cartCats = new Set(cart.map((p) => p.category));
  const rank = new Map<string, number>();
  for (const item of cart) {
    (COMPLEMENTS[item.category] ?? []).forEach((cat, i) => {
      const prev = rank.get(cat);
      // Lower is better; a shelf several items point to rises.
      rank.set(cat, (prev ?? 10) - (10 - i));
    });
  }
  const ranked = [...rank.entries()].sort((a, b) => a[1] - b[1]).map(([cat]) => cat);
  const shelves = [...ranked, ...DEFAULT_SHELVES].filter(
    (cat, i, all) => SHELF_NAMES[cat] && !cartCats.has(cat) && all.indexOf(cat) === i,
  );
  return shelves.slice(0, limit);
}

/**
 * Products that clear the next line without overshooting it, for the
 * advisor to show. With a shelf, only that shelf; without one, a mix
 * across the shelves that complete the cart. Never anything already in
 * the cart, never a bundle.
 */
export function tierPicks(
  cart: CatalogProduct[],
  catalog: CatalogProduct[],
  step: TierStep,
  shelf?: string,
  limit = 8,
): CatalogProduct[] {
  const { gap, budget } = step;
  if (gap <= 0) return [];
  const inCart = new Set(cart.map((p) => p.slug));
  const shelves = shelf ? [shelf] : nextShelves(cart, 5);
  const pool = catalog.filter(
    (p) =>
      shelves.includes(p.category) &&
      !inCart.has(p.slug) &&
      !p.isBundle &&
      typeof p.price === "number" &&
      p.price >= gap,
  );
  const within = (hi: number) => pool.filter((p) => (p.price as number) <= hi);
  // Strictly the budget: a $45 gap never comes back with $80 serums. A
  // shelf with nothing in range simply doesn't get a pill.
  const picks = within(budget.max);

  const score = (p: CatalogProduct) =>
    -((p.price as number) - gap) / 20 +
    ((p.rating ?? 4) - 4) +
    Math.log10((p.reviewCount ?? 0) + 1) / 3 -
    (shelf ? 0 : shelves.indexOf(p.category) * 0.4);
  const ranked = [...picks].sort((a, b) => score(b) - score(a));
  if (shelf) return ranked.slice(0, limit);

  // A mix: take the best of each shelf in turn so it reads as an assortment.
  const byShelf = shelves.map((cat) => ranked.filter((p) => p.category === cat));
  const mixed: CatalogProduct[] = [];
  for (let round = 0; mixed.length < limit && byShelf.some((list) => list.length > round); round++) {
    for (const list of byShelf) {
      if (list[round] && mixed.length < limit) mixed.push(list[round]);
    }
  }
  return mixed;
}
