import type { CatalogProduct } from "../../../catalog/catalog";

/**
 * Facts and copy for the follow-up row under a comparison table.
 *
 * The comparison card already lays out the attributes and offers a per-column
 * "Add to cart", so the follow-ups exist to answer what the table cannot: why
 * the closing recommendation picked the column it did, which column fits this
 * shopper, and whether two of them can be used together.
 *
 * The fact helpers are shared with `buildCompareNbas` in `flow.ts` so a pill is
 * only ever offered when there is a grounded answer behind it (the fit chip
 * appears because the skin-type rows genuinely differ, "Can I use both?"
 * because the pair really is a sequence).
 */

/** Skin types in the dataset, ordered by how often shoppers self-identify with
 *  them, so a fit question leads with the most useful split. */
const SKIN_TYPES = ["Oily", "Dry", "Combination", "Normal"] as const;

export type SkinType = (typeof SKIN_TYPES)[number];

/** Routine order used to tell a genuine two-step pair from two products that
 *  compete for the same slot. */
const CATEGORY_SEQUENCE = [
  "Cleansers",
  "Softeners",
  "Masks",
  "Serums & Treatments",
  "Eye & Lip Care",
  "Moisturizers",
  "Sunscreen",
];

/** Oil-based first cleanse, then the water-based second cleanse. */
const FIRST_CLEANSE = /\b(oil|balm|makeup remover)\b/i;
const SECOND_CLEANSE = /\b(foam|microfoam|wash|gel|water|milk)\b/i;

function specValue(product: CatalogProduct, label: string): string | null {
  const spec = product.specs.find((entry) => entry.label === label);
  return spec && spec.value ? spec.value : null;
}

function splitValues(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

/** Skin types a product claims. "All" is expanded so coverage comparisons
 *  between a universal product and a targeted one behave sensibly. */
function skinTypeCoverage(product: CatalogProduct): Set<SkinType> {
  const listed = splitValues(specValue(product, "Skin type"));
  if (listed.some((value) => /^all$/i.test(value))) {
    return new Set(SKIN_TYPES);
  }
  const covered = new Set<SkinType>();
  for (const value of listed) {
    const match = SKIN_TYPES.find(
      (type) => type.toLowerCase() === value.toLowerCase(),
    );
    if (match) covered.add(match);
  }
  return covered;
}

function joinNatural(parts: string[]): string {
  const clean = parts.map((part) => part.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
}

function joinSentences(parts: Array<string | null>): string {
  return parts.filter((part): part is string => Boolean(part)).join(" ");
}

function typeLabel(product: CatalogProduct): string {
  return `${specValue(product, "Type") ?? ""} ${product.title}`;
}

/**
 * A skin type that splits the compared products: some cover it, some don't.
 * Null when every column claims the same coverage, in which case there is no
 * honest fit question to ask.
 */
export function differentiatingSkinType(
  products: CatalogProduct[],
): SkinType | null {
  if (products.length < 2) return null;
  for (const type of SKIN_TYPES) {
    const covering = products.filter((product) =>
      skinTypeCoverage(product).has(type),
    );
    if (covering.length > 0 && covering.length < products.length) {
      return type;
    }
  }
  return null;
}

export type PriceSpread = {
  cheapest: CatalogProduct;
  dearest: CatalogProduct;
  /** How much of the top price the gap represents, 0 when they all match. */
  fraction: number;
};

export function priceSpread(products: CatalogProduct[]): PriceSpread | null {
  const priced = products.filter((product) => (product.price ?? 0) > 0);
  if (priced.length < 2) return null;
  const sorted = [...priced].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  const cheapest = sorted[0];
  const dearest = sorted[sorted.length - 1];
  const top = dearest.price ?? 0;
  if (top <= 0) return null;
  return {
    cheapest,
    dearest,
    fraction: ((top - (cheapest.price ?? 0)) / top),
  };
}

/**
 * Two compared products that occupy different steps, ordered as they'd be
 * used. Covers the double cleanse (an oil paired with a foam, which the
 * category alone can't tell apart) and any cross-category pair. Null when the
 * products compete for the same slot, so "Can I use both?" is never offered
 * for a pair where the honest answer is "pick one".
 */
export function complementaryPair(
  products: CatalogProduct[],
): [CatalogProduct, CatalogProduct] | null {
  const firstStep = products.find((product) =>
    FIRST_CLEANSE.test(typeLabel(product)),
  );
  const secondStep = products.find(
    (product) =>
      product !== firstStep && SECOND_CLEANSE.test(typeLabel(product)),
  );
  if (
    firstStep &&
    secondStep &&
    firstStep.category === "Cleansers" &&
    secondStep.category === "Cleansers"
  ) {
    return [firstStep, secondStep];
  }

  const ranked = products
    .map((product) => ({
      product,
      rank: CATEGORY_SEQUENCE.indexOf(product.category),
    }))
    .filter((entry) => entry.rank >= 0)
    .sort((a, b) => a.rank - b.rank);
  const earliest = ranked[0];
  const latest = ranked[ranked.length - 1];
  if (earliest && latest && earliest.rank !== latest.rank) {
    return [earliest.product, latest.product];
  }
  return null;
}

function ratingPhrase(product: CatalogProduct): string | null {
  if (product.rating == null) return null;
  const reviews =
    product.reviewCount != null ? ` from ${product.reviewCount} reviews` : "";
  return `${product.rating.toFixed(1)}${reviews}`;
}

/** "both" reads better than "all" for a two-column comparison. */
function quantifier(count: number): string {
  return count === 2 ? "both" : "all";
}

/** Spelled-out counts, since a comparison never runs past a handful of
 *  columns and "All 3 are $39.00" reads like a spreadsheet. */
const COUNT_WORDS = ["", "one", "two", "three", "four", "five"];

function countWord(count: number): string {
  return COUNT_WORDS[count] ?? String(count);
}

function lowercaseTypes(types: Iterable<SkinType>): string[] {
  return [...types].map((type) => type.toLowerCase());
}

/** Skin types a product claims that a given set of rivals does not. */
function skinTypeEdge(
  product: CatalogProduct,
  rivals: CatalogProduct[],
): SkinType[] {
  const coverage = skinTypeCoverage(product);
  return [...coverage].filter((type) =>
    rivals.every((rival) => !skinTypeCoverage(rival).has(type)),
  );
}

/**
 * Why the recommended column won. Names the axes where it actually leads
 * rather than restating the rating, and concedes the axis where another
 * column is stronger so the shopper can overrule it.
 */
export function buildCompareRationale(
  products: CatalogProduct[],
  recommended: CatalogProduct,
): string {
  const others = products.filter(
    (product) => product.slug !== recommended.slug,
  );
  if (others.length === 0) {
    return `The ${recommended.title} is the only option here, so there's nothing to weigh it against.`;
  }

  const leads: string[] = [];

  const rating = ratingPhrase(recommended);
  const bestOther = Math.max(...others.map((product) => product.rating ?? 0));
  const tied = others.filter(
    (product) =>
      product.rating != null && product.rating === (recommended.rating ?? null),
  );
  if (rating && (recommended.rating ?? 0) >= bestOther) {
    leads.push(
      tied.length > 0
        ? `it matches the ${joinNatural(
            tied.map((product) => product.title),
          )} on rating (${rating})`
        : `it's the highest rated of the set at ${rating}`,
    );
  }

  // Where the pick ties on rating, the skin-type edge over the product it ties
  // with is the actual reason to prefer it, so measure against those rivals.
  const coverage = skinTypeCoverage(recommended);
  const uniqueTypes = skinTypeEdge(recommended, others);
  const edgeOverTied = tied.length > 0 ? skinTypeEdge(recommended, tied) : [];
  const widestOther = Math.max(
    ...others.map((product) => skinTypeCoverage(product).size),
  );
  if (uniqueTypes.length > 0) {
    leads.push(
      `it's the only one here that suits ${joinNatural(
        lowercaseTypes(uniqueTypes),
      )} skin`,
    );
  } else if (edgeOverTied.length > 0) {
    // The tied product was just named in the rating clause, so refer back to
    // it rather than repeating the title in the same sentence.
    leads.push(
      `it also covers ${joinNatural(
        lowercaseTypes(edgeOverTied),
      )} skin, which ${tied.length === 1 ? "that one doesn't" : "those don't"}`,
    );
  } else if (coverage.size > widestOther && coverage.size > 0) {
    leads.push(
      `it covers the widest range of skin types (${joinNatural(
        lowercaseTypes(coverage),
      )})`,
    );
  }

  const targets = splitValues(specValue(recommended, "Targets"));
  const broadestOther = Math.max(
    ...others.map(
      (product) => splitValues(specValue(product, "Targets")).length,
    ),
  );
  if (targets.length > broadestOther && targets.length > 0) {
    leads.push(
      `it takes on the most concerns (${joinNatural(
        targets.map((target) => target.toLowerCase()),
      )})`,
    );
  }

  const spread = priceSpread(products);
  const samePrice = spread != null && spread.fraction === 0;
  if (spread && !samePrice && spread.cheapest.slug === recommended.slug) {
    leads.push(`it's also the least expensive at ${recommended.priceFormatted}`);
  }

  const lead =
    leads.length > 0
      ? // Three reasons is the most a shopper will read in one breath.
        `I'd point you to the ${recommended.title} because ${joinNatural(
          leads.slice(0, 3),
        )}.`
      : `I'd point you to the ${recommended.title}, though it's a close call across the board.`;
  // Price parity is its own sentence: folded into the "because" list it reads
  // as a reason for the pick rather than a non-factor.
  const priceNote = samePrice
    ? `${
        products.length === 2 ? "Both" : `All ${countWord(products.length)}`
      } are ${recommended.priceFormatted}, so price isn't the deciding factor.`
    : null;

  // Concede the strongest counter-argument so the pick reads as a judgement
  // the shopper can overrule, not a verdict.
  let counterpoint: string | null = null;
  if (spread && !samePrice && spread.cheapest.slug !== recommended.slug) {
    counterpoint = `If price matters most, the ${spread.cheapest.title} is ${spread.cheapest.priceFormatted}.`;
  } else {
    const differentiator = differentiatingSkinType(products);
    const missedBy =
      differentiator && !coverage.has(differentiator)
        ? others.find((product) =>
            skinTypeCoverage(product).has(differentiator),
          )
        : undefined;
    if (differentiator && missedBy) {
      counterpoint = `For ${differentiator.toLowerCase()} skin specifically, the ${missedBy.title} is the better match.`;
    }
  }

  return joinSentences([lead, priceNote, counterpoint]);
}

/** Which compared product suits a given skin type, and which doesn't. */
export function buildCompareFitAnswer(
  products: CatalogProduct[],
  skinType: SkinType,
): string {
  const lower = skinType.toLowerCase();
  const covering = products.filter((product) =>
    skinTypeCoverage(product).has(skinType),
  );
  const missing = products.filter(
    (product) => !skinTypeCoverage(product).has(skinType),
  );

  if (covering.length === 0) {
    return `None of these list ${lower} skin on their label. Tell me a bit more about your skin and I'll find something built for it.`;
  }

  const describeMissing = (product: CatalogProduct): string => {
    const listed = splitValues(specValue(product, "Skin type"));
    return listed.length > 0
      ? `${product.title} (${joinNatural(
          listed.map((value) => value.toLowerCase()),
        )})`
      : product.title;
  };
  const missingNote =
    missing.length === 0
      ? null
      : missing.length === 1
        ? `The ${describeMissing(missing[0])} is built for other skin instead.`
        : `The ${joinNatural(missing.map(describeMissing))} are built for other skin.`;

  if (covering.length === 1) {
    const pick = covering[0];
    return joinSentences([
      `For ${lower} skin, go with the ${pick.title} — it's the only one here that lists ${lower} skin.`,
      missingNote,
    ]);
  }

  const ranked = [...covering].sort(
    (a, b) =>
      (b.rating ?? 0) - (a.rating ?? 0) ||
      (b.reviewCount ?? 0) - (a.reviewCount ?? 0),
  );
  const best = ranked[0];
  const bestRating = ratingPhrase(best);
  return joinSentences([
    `The ${joinNatural(
      covering.map((product) => product.title),
    )} ${quantifier(covering.length)} list ${lower} skin.`,
    bestRating
      ? `Of those I'd take the ${best.title}, which rates ${bestRating}.`
      : `Of those I'd take the ${best.title}.`,
    missingNote,
  ]);
}

const SINGULAR_CATEGORY: Record<string, string> = {
  Cleansers: "cleanser",
  Softeners: "softener",
  "Serums & Treatments": "serum",
  Moisturizers: "moisturizer",
  "Eye & Lip Care": "eye and lip product",
  Masks: "mask",
  Sunscreen: "sunscreen",
  "Sets & Bundles": "set",
};

function singularCategory(category: string): string {
  return SINGULAR_CATEGORY[category] ?? category.toLowerCase().replace(/s$/, "");
}

/** Said when nothing in the catalog undercuts the compared set. */
export function buildNoCheaperAnswer(cheapest: CatalogProduct): string {
  return `The ${cheapest.title} at ${cheapest.priceFormatted} is the most affordable ${singularCategory(
    cheapest.category,
  )} I carry. Tell me your budget and I'll look beyond this category.`;
}

/**
 * Fallback for the fit chip when every column claims the same skin types:
 * spell out what each one actually is, since the difference is then the
 * product shape rather than the audience.
 */
export function buildCompareDifferenceAnswer(
  products: CatalogProduct[],
): string {
  const shapeOf = (product: CatalogProduct): string => {
    const type = specValue(product, "Type");
    if (!type) return singularCategory(product.category);
    // "Cleanser (oil)" reads better as "oil cleanser".
    const parenthetical = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(type);
    const shape = parenthetical
      ? `${parenthetical[2]} ${parenthetical[1]}`
      : type;
    return shape.toLowerCase();
  };
  const audienceOf = (product: CatalogProduct): string => {
    const listed = splitValues(specValue(product, "Skin type")).filter(
      (value) => !/^all$/i.test(value),
    );
    return listed.length > 0
      ? joinNatural(listed.map((value) => value.toLowerCase()))
      : "";
  };

  const shapes = products.map(shapeOf);
  const audiences = products.map(audienceOf);
  const sameShape = new Set(shapes).size === 1;
  const sameAudience = new Set(audiences).size === 1;

  const lead = sameShape
    ? `${quantifier(products.length) === "both" ? "Both" : "They"} are ${
        shapes[0]
      }${shapes[0].endsWith("s") ? "" : "s"}${
        sameAudience && audiences[0] ? ` for ${audiences[0]} skin` : ""
      }.`
    : `Side by side, ${joinNatural(
        products.map((product, index) => {
          const shape = shapes[index];
          const audience =
            !sameAudience && audiences[index]
              ? ` for ${audiences[index]} skin`
              : "";
          return `the ${product.title} is ${
            /^[aeiou]/.test(shape) ? "an" : "a"
          } ${shape}${audience}`;
        }),
      )}.`;

  // With the shape and audience matching, the concerns each one targets are
  // the only substantive difference left on the table.
  let targetsNote: string | null = null;
  if (sameShape && sameAudience) {
    const targets = products.map((product) => ({
      product,
      list: splitValues(specValue(product, "Targets")),
    }));
    const distinct = new Set(targets.map((entry) => entry.list.join("|")));
    if (distinct.size > 1) {
      targetsNote = `Where they part company is what they treat: ${joinNatural(
        targets.map((entry) =>
          entry.list.length > 0
            ? `the ${entry.product.title} is aimed at ${joinNatural(
                entry.list.map((value) => value.toLowerCase()),
              )}`
            : `the ${entry.product.title} makes no specific claim`,
        ),
      )}.`;
    }
  }

  const spread = priceSpread(products);
  const priceNote = !spread
    ? null
    : spread.fraction === 0
      ? `${quantifier(products.length) === "both" ? "Both" : "They"} cost ${
          spread.cheapest.priceFormatted
        }, so it comes down to which formula you want.`
      : `On price, the ${spread.dearest.title} is ${spread.dearest.priceFormatted} against ${spread.cheapest.priceFormatted} for the ${spread.cheapest.title}.`;

  return joinSentences([lead, targetsNote, priceNote]);
}

/** Whether two compared products can be used together, and in what order. */
export function buildUseBothAnswer(products: CatalogProduct[]): string {
  const pair = complementaryPair(products);
  if (!pair) {
    const category = (products[0]?.category ?? "products").toLowerCase();
    return `You only need one of these. They sit at the same step of a routine, so a second ${category.replace(/s$/, "")} won't add much. Pick the one that matches your skin type and put the budget towards the next step instead.`;
  }

  const [first, second] = pair;
  if (first.category === "Cleansers" && second.category === "Cleansers") {
    return `Yes, and together they're a double cleanse. Use the ${first.title} first on dry skin to break down sunscreen and makeup, then follow with the ${second.title} to wash everything away. That pairing is an evening routine; in the morning the ${second.title} on its own is plenty.`;
  }

  return `Yes, they work at different steps. Use the ${first.title} first, then follow with the ${second.title} once it has absorbed.`;
}
