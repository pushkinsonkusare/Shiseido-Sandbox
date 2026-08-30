import type { CatalogProduct } from "../../../catalog/catalog";

/* =============================================================
 * Ingredient intent detection for free-text shopping queries.
 *
 * Catalog products carry a free-text `ingredients` field (hero bullets
 * + INCI). We match aliases case-insensitively — not a structured
 * INCI parser. Used by classifyIntent / filterProducts / clarify flow.
 * ============================================================= */

export type IngredientPolarity = "include" | "exclude" | "unknown";

export type IngredientDetection = {
  /** Canonical id, e.g. `niacinamide`, `salicylic acid`. */
  ingredientId: string;
  /** Display label for copy / NBA pills. */
  label: string;
  polarity: IngredientPolarity;
  /** Alias strings that matched (for debugging / soft ranking). */
  aliases: string[];
};

type IngredientEntry = {
  id: string;
  label: string;
  /** Longer aliases first so "salicylic acid" wins over "salicylic". */
  aliases: string[];
  /**
   * Concern key used only when the catalog has zero include-hits for
   * this ingredient (e.g. salicylic acid). Soft-ranks related picks.
   */
  fallbackConcern?: "oily" | "texture" | "dark-spots" | "wrinkles" | "dryness";
};

/**
 * Curated actives shoppers name in testing. Order within an entry:
 * longest alias first. Entry order: more specific ids before generic.
 */
const INGREDIENT_LEXICON: IngredientEntry[] = [
  {
    id: "salicylic acid",
    label: "salicylic acid",
    aliases: ["salicylic acid", "salicylic", "bha"],
    fallbackConcern: "oily",
  },
  {
    id: "glycolic acid",
    label: "glycolic acid",
    aliases: ["glycolic acid", "glycolic", "aha"],
    fallbackConcern: "texture",
  },
  {
    id: "hyaluronic acid",
    label: "hyaluronic acid",
    aliases: [
      "hyaluronic acid",
      "sodium hyaluronate",
      "hyaluronic",
      "hyaluronate",
    ],
    fallbackConcern: "dryness",
  },
  {
    id: "niacinamide",
    label: "niacinamide",
    aliases: ["niacinamide", "niacinamyde", "niaccinamide", "nicotinamide", "vitamin b3"],
  },
  {
    id: "retinol",
    label: "retinol",
    aliases: ["retinol", "retinoid", "retinal", "retinyl"],
    fallbackConcern: "wrinkles",
  },
  {
    id: "vitamin c",
    label: "vitamin C",
    aliases: [
      "vitamin c",
      "ascorbic acid",
      "ascorbyl",
      "ascorbic",
      "vit c",
      "vit\\. c",
    ],
    fallbackConcern: "dark-spots",
  },
  {
    id: "ceramides",
    label: "ceramides",
    aliases: ["ceramides", "ceramide"],
    fallbackConcern: "dryness",
  },
  {
    id: "peptides",
    label: "peptides",
    aliases: ["peptides", "peptide"],
    fallbackConcern: "wrinkles",
  },
  {
    id: "caffeine",
    label: "caffeine",
    aliases: ["caffeine"],
  },
  {
    id: "fragrance",
    label: "fragrance",
    aliases: ["fragrance", "parfum", "perfume", "scented"],
  },
  {
    id: "paraben",
    label: "parabens",
    aliases: ["parabens", "paraben"],
  },
  {
    id: "zinc oxide",
    label: "zinc oxide",
    aliases: ["zinc oxide", "zincoxide"],
  },
  {
    id: "titanium dioxide",
    label: "titanium dioxide",
    aliases: ["titanium dioxide", "titanium"],
  },
];

const EXCLUDE_CUE =
  /\b(without|with\s*out|no|free\s*of|free-of|exclude|excluding|avoid|doesn't\s*have|does\s*not\s*have|dont\s*have|don't\s*have|minus)\b/i;
const INCLUDE_CUE =
  /\b(with|contains?|containing|including|include[sd]?|has|have|featuring|that\s*has|that\s*contain)\b/i;
const FREE_SUFFIX = /[- ]free\b/i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function aliasPattern(alias: string): RegExp {
  // Allow pre-escaped word-boundary aliases like `\bha\b`.
  if (alias.startsWith("\\b") && alias.endsWith("\\b")) {
    return new RegExp(alias, "i");
  }
  return new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i");
}

function findLexiconHit(
  text: string,
): { entry: IngredientEntry; matchedAlias: string } | null {
  const lower = text.toLowerCase();
  for (const entry of INGREDIENT_LEXICON) {
    for (const alias of entry.aliases) {
      if (aliasPattern(alias).test(lower)) {
        return { entry, matchedAlias: alias.replace(/\\b/g, "") };
      }
    }
  }
  return null;
}

function detectPolarity(text: string, matchedAlias: string): IngredientPolarity {
  const lower = text.toLowerCase();
  // "fragrance-free" / "paraben free" → exclude that ingredient.
  if (FREE_SUFFIX.test(lower) && lower.includes(matchedAlias.toLowerCase().replace(/\\b/g, ""))) {
    return "exclude";
  }

  // Window around the matched alias for local with/without cues.
  const aliasRe = aliasPattern(matchedAlias);
  const match = aliasRe.exec(lower);
  if (match && match.index != null) {
    const start = Math.max(0, match.index - 48);
    const end = Math.min(lower.length, match.index + match[0].length + 16);
    const window = lower.slice(start, end);
    if (EXCLUDE_CUE.test(window)) return "exclude";
    if (INCLUDE_CUE.test(window)) return "include";
  }

  if (EXCLUDE_CUE.test(lower) && !INCLUDE_CUE.test(lower)) return "exclude";
  if (INCLUDE_CUE.test(lower)) return "include";
  return "unknown";
}

/** Detect a named ingredient (+ with/without polarity) in free text. */
export function detectIngredientIntent(
  text: string,
): IngredientDetection | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const hit = findLexiconHit(trimmed);
  if (!hit) return null;
  const polarity = detectPolarity(trimmed, hit.matchedAlias);
  return {
    ingredientId: hit.entry.id,
    label: hit.entry.label,
    polarity,
    aliases: hit.entry.aliases.map((a) => a.replace(/\\b/g, "")),
  };
}

/** Canonical aliases used for substring matching on product copy. */
export function ingredientMatchTerms(ingredientId: string): string[] {
  const entry = INGREDIENT_LEXICON.find((e) => e.id === ingredientId);
  if (!entry) return [ingredientId];
  return entry.aliases
    .map((a) => a.replace(/\\b/g, "").toLowerCase())
    .filter((a) => a.length > 1 && a !== "aha"); // AHA alone is too noisy in INCI
}

export function productContainsIngredient(
  product: CatalogProduct,
  ingredientId: string,
): boolean {
  const haystack = `${product.ingredients ?? ""} ${product.title} ${product.overview ?? ""}`.toLowerCase();
  if (!haystack.trim()) return false;
  return ingredientMatchTerms(ingredientId).some((term) => {
    if (term.length <= 3) {
      return new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(haystack);
    }
    return haystack.includes(term);
  });
}

export function productMatchesIngredient(
  product: CatalogProduct,
  ingredientId: string,
  polarity: "include" | "exclude",
): boolean {
  const has = productContainsIngredient(product, ingredientId);
  return polarity === "include" ? has : !has;
}

/** Concern used to soft-rank when include-filter finds zero catalog hits. */
export function ingredientFallbackConcern(
  ingredientId: string,
): "oily" | "texture" | "dark-spots" | "wrinkles" | "dryness" | undefined {
  return INGREDIENT_LEXICON.find((e) => e.id === ingredientId)?.fallbackConcern;
}

export function ingredientDisplayLabel(ingredientId: string): string {
  return (
    INGREDIENT_LEXICON.find((e) => e.id === ingredientId)?.label ?? ingredientId
  );
}

/** True when `text` is essentially just naming an ingredient (optional with/without). */
export function isMostlyIngredientUtterance(text: string): boolean {
  const detection = detectIngredientIntent(text);
  if (!detection) return false;
  // Strip polarity cues + the matched ingredient aliases; leftover should be thin.
  let rest = text.toLowerCase();
  for (const alias of detection.aliases) {
    rest = rest.replace(aliasPattern(alias), " ");
  }
  rest = rest
    .replace(EXCLUDE_CUE, " ")
    .replace(INCLUDE_CUE, " ")
    .replace(FREE_SUFFIX, " ")
    .replace(
      /\b(show|me|something|products?|looking|for|want|need|please|that|does|not|have|any|a|an|the|of|to|in|my|skincare|skin|care)\b/gi,
      " ",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return rest.length === 0;
}

/**
 * Deictic presence ask about the product in context ("does this have X?").
 * Distinct from browse asks like "show me something with niacinamide".
 */
export function isIngredientPresenceQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (!detectIngredientIntent(trimmed)) return false;
  // Browse / find language → shopping flow, not Yes/No about "this".
  if (
    /\b(show\s+me|find\s+me|looking\s+for|i\s+want|i\s+need|recommend|suggest)\b/i.test(
      trimmed,
    )
  ) {
    return false;
  }
  return (
    /\bdoes\s+(this|it)\s+(have|contain|include)\b/i.test(trimmed) ||
    /\b(is|are)\s+there\b.+\bin\s+(this|it)\b/i.test(trimmed) ||
    /\bany\b.+\bin\s+(this|it)\b/i.test(trimmed) ||
    /\b(has|have|contains?|includes?)\s+(this|it)\s+(got|got\s+any)?\b/i.test(
      trimmed,
    ) ||
    /\bis\s+(this|it)\s+(formulated\s+with|made\s+with)\b/i.test(trimmed) ||
    /\b(this|it)\s+(have|has|contain|contains)\b/i.test(trimmed)
  );
}

function productCategoryNoun(product: CatalogProduct): string {
  const category = (product.category ?? "").toLowerCase();
  if (category.includes("moisturi")) return "moisturizer";
  if (category.includes("serum") || category.includes("treatment")) return "serum";
  if (category.includes("cleanser")) return "cleanser";
  if (category.includes("sunscreen")) return "sunscreen";
  if (category.includes("softener") || category.includes("toner")) return "softener";
  if (category.includes("mask")) return "mask";
  if (category.includes("eye") || category.includes("lip")) return "eye cream";
  if (category.includes("set") || category.includes("bundle")) return "set";
  // Title fallback for cream/oil naming.
  const title = product.title.toLowerCase();
  if (/\bcream\b/.test(title)) return "cream";
  if (/\boil\b/.test(title)) return "oil";
  return "product";
}

export type IngredientPresenceAnswer = {
  body: string;
  hasIngredient: boolean;
  detection: IngredientDetection;
};

/** Yes/No answer for "does this have X?" grounded in product ingredients. */
export function buildIngredientPresenceAnswer(
  product: CatalogProduct,
  text: string,
): IngredientPresenceAnswer | null {
  if (!isIngredientPresenceQuestion(text)) return null;
  const detection = detectIngredientIntent(text);
  if (!detection) return null;
  const hasIngredient = productContainsIngredient(product, detection.ingredientId);
  const name = detection.label;
  if (hasIngredient) {
    return {
      body: `Yes — the ${product.title} includes ${name}.`,
      hasIngredient: true,
      detection,
    };
  }
  const noun = productCategoryNoun(product);
  return {
    body: `No — this ${noun} does not have ${name}. I can help you find products with ${name}. Would you like to see moisturizers specifically, or are you looking for a full routine?`,
    hasIngredient: false,
    detection,
  };
}

