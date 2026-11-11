/** Spend milestones shared by the agent cart and the storefront cart. The
 *  highest one the subtotal reaches applies itself; dropping below a line
 *  falls back to the tier beneath it. */
export const SPEND_TIERS = [
  { threshold: 100, code: "SPEND100", fraction: 0.15 },
  { threshold: 200, code: "SPEND200", fraction: 0.2 },
  { threshold: 300, code: "SPEND300", fraction: 0.25 },
] as const;

export const SPEND_TIER_CODES = new Set<string>(SPEND_TIERS.map((tier) => tier.code));

export type CartPromo = { code: string; fraction: number };

export function spendTierFor(subtotal: number) {
  return [...SPEND_TIERS].reverse().find((tier) => subtotal >= tier.threshold);
}

/** The promo a cart pays out: the earned spend tier, unless a code the
 *  shopper entered themselves is stronger. Codes never stack. */
export function resolveCartPromo(
  subtotal: number,
  manual?: CartPromo | null,
): CartPromo | undefined {
  const own = manual && !SPEND_TIER_CODES.has(manual.code) ? manual : undefined;
  const tier = spendTierFor(subtotal);
  if (tier && (!own || own.fraction < tier.fraction)) {
    return { code: tier.code, fraction: tier.fraction };
  }
  return own;
}

/** Discount in dollars, rounded to cents the same way on every surface. */
export function cartPromoDiscount(subtotal: number, promo?: CartPromo): number {
  return promo ? Math.round(subtotal * promo.fraction * 100) / 100 : 0;
}
