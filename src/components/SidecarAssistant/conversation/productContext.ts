import { normalizeMatchText } from "../../../catalog/catalog";

/**
 * Deterministic page vs conversation product resolution.
 *
 * Hierarchy: explicit mention in the shopper's text > conversation slugs >
 * current PDP > none. Agent output never writes these values; callers must
 * only persist conversation slugs from shopper turns.
 */

export type ProductContextItem = {
  slug: string;
  title: string;
  model?: string | null;
  isBundle?: boolean;
};

export type ResolvedProductContext =
  | { kind: "explicit"; slugs: string[] }
  | { kind: "conversation"; slugs: string[] }
  | { kind: "page"; slugs: string[] }
  | { kind: "ambiguous"; slugs: string[] }
  | { kind: "none"; slugs: [] };

export type ResolveActiveProductContextInput = {
  text: string;
  conversationSlugs: string[];
  pageSlug: string | null;
  products: ProductContextItem[];
};

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "with",
  "for",
  "of",
  "this",
  "that",
  "it",
  "its",
]);

export function compactProductTitle(title: string): string {
  return title
    .replace(/^(Shiseido)\s+/i, "")
    .replace(/\s+\(.*?\)\s*$/, "")
    .trim();
}

export function isPronounProductQuestion(text: string): boolean {
  return /\b(this|that|it|its)\b/i.test(text);
}

export function isMultiProductRelationQuery(text: string): boolean {
  return (
    /\b(which|both|together|compare|versus|layer)\b/i.test(text) ||
    /\bvs\.?\b/i.test(text) ||
    /\balong with\b/i.test(text) ||
    /\bwith the\b/i.test(text) ||
    /\band the\b/i.test(text)
  );
}

const LISTING_PHRASES =
  /\b(show me|find me|looking for|browse|recommend|recommendation|suggest|help me (find|pick|choose)|alternatives?|options?|under \$?\d|cheaper than|less than)\b/i;

/** "a good sunscreen", "any serums" - an indefinite determiner in front of a
 * category is a request for candidates, not a question about one product. */
const BROWSE_NOUN_PHRASE =
  /\b(a|an|any|another|some|good|best)\s+(?:\w+\s+){0,2}(sunscreens?|serums?|creams?|cleansers?|moisturi[sz]ers?|masks?|toners?|softeners?|lotions?|oils?|essences?|treatments?|products?|sets?|bundles?)\b/i;

/** "show sunscreens", "need cleansers" - a shopping verb aimed at a category
 * rather than at one product. */
const LISTING_VERB = /\b(show|find|need|want|explore|compare)\b/i;
const PLURAL_CATEGORY =
  /\b(sunscreens|serums|creams|cleansers|moisturizers|masks|toners|softeners|lotions|oils|essences|treatments|products|sets|bundles)\b/i;

/** Shopping/listing language should not become a single-SKU FAQ even when
 * a product name also appears in the utterance. */
export function isProductListingQuery(text: string): boolean {
  if (LISTING_PHRASES.test(text) || BROWSE_NOUN_PHRASE.test(text)) return true;
  return LISTING_VERB.test(text) && PLURAL_CATEGORY.test(text);
}

const QUESTION_OPENERS =
  /^(is|are|was|were|does|do|did|can|could|will|would|should|has|have|had|how|what|which|why|when|where|who|tell me|explain)\b/i;

/** Distinguishes a question aimed at one product ("is the eye cream
 * waterproof?") from a browse request that merely names a category
 * ("sunscreen for oily skin"). Only the former can be answered from a single
 * SKU's specs. */
export function isProductQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return trimmed.endsWith("?") || QUESTION_OPENERS.test(trimmed);
}

export function buildProductClarification(
  products: ProductContextItem[],
): string {
  const names = products
    .slice(0, 2)
    .map((product) => compactProductTitle(product.title));
  if (names.length < 2) return "Which product do you mean?";
  return `Do you mean the ${names[0]} or the ${names[1]}?`;
}

function uniqueSlugs(slugs: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const slug of slugs) {
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    next.push(slug);
  }
  return next;
}

function titleNeedles(product: ProductContextItem): string[] {
  const compact = compactProductTitle(product.title);
  const needles = [product.title, compact];
  if (product.model) {
    needles.push(`${product.model} ${compact}`);
  }
  return [
    ...new Set(
      needles
        .map((needle) => normalizeMatchText(needle))
        .filter((needle) => needle.length >= 8),
    ),
  ];
}

function titleBlob(product: ProductContextItem): string {
  const compact = compactProductTitle(product.title);
  const parts = [product.title, compact];
  if (product.model) parts.push(product.model);
  return normalizeMatchText(parts.join(" "));
}

function productHasPhrase(
  product: ProductContextItem,
  phrase: string,
): boolean {
  if (!phrase) return false;
  return titleBlob(product).includes(phrase);
}

/**
 * Longest unique title / compact-title / alias substring in the shopper text.
 * Short phrases such as "eye cream" only count when they uniquely identify a
 * SKU among {page, conversation} first, otherwise among the catalog.
 */
export function matchProductsInText(
  text: string,
  products: ProductContextItem[],
  options?: { conversationSlugs?: string[]; pageSlug?: string | null },
): string[] {
  const query = normalizeMatchText(text);
  if (!query) return [];

  const bySlug = new Map(products.map((product) => [product.slug, product]));
  const contained: { slug: string; needle: string }[] = [];
  for (const product of products) {
    for (const needle of titleNeedles(product)) {
      if (query.includes(needle)) {
        contained.push({ slug: product.slug, needle });
      }
    }
  }
  contained.sort((a, b) => b.needle.length - a.needle.length);
  const kept: string[] = [];
  const keptNeedles: string[] = [];
  for (const hit of contained) {
    const subsumed = keptNeedles.some((needle) => needle.includes(hit.needle));
    if (subsumed && !kept.includes(hit.slug)) continue;
    if (!kept.includes(hit.slug)) {
      kept.push(hit.slug);
      keptNeedles.push(hit.needle);
    }
  }
  if (kept.length > 0) return kept.slice(0, 2);

  const windowHits: { slug: string; phrase: string }[] = [];
  for (const product of products) {
    const tokens = normalizeMatchText(compactProductTitle(product.title))
      .split(/\s+/)
      .filter(Boolean);
    for (let size = tokens.length; size >= 3; size -= 1) {
      for (let index = 0; index + size <= tokens.length; index += 1) {
        const phrase = tokens.slice(index, index + size).join(" ");
        if (phrase.length < 12 || !query.includes(phrase)) continue;
        windowHits.push({ slug: product.slug, phrase });
      }
    }
  }
  windowHits.sort((a, b) => b.phrase.length - a.phrase.length);
  const uniqueWindows: string[] = [];
  for (const hit of windowHits) {
    const others = products.filter((product) =>
      productHasPhrase(product, hit.phrase),
    );
    if (
      others.length === 1 &&
      others[0].slug === hit.slug &&
      !uniqueWindows.includes(hit.slug)
    ) {
      uniqueWindows.push(hit.slug);
    }
  }
  if (uniqueWindows.length > 0) return uniqueWindows.slice(0, 2);

  const pool = uniqueSlugs([
    ...(options?.conversationSlugs ?? []),
    options?.pageSlug,
  ])
    .map((slug) => bySlug.get(slug))
    .filter((product): product is ProductContextItem => Boolean(product));

  const queryTokens = query.split(/\s+/).filter(Boolean);
  const phrases: string[] = [];
  for (let index = 0; index < queryTokens.length - 1; index += 1) {
    const bigram = `${queryTokens[index]} ${queryTokens[index + 1]}`;
    if (bigram.length >= 7) phrases.push(bigram);
  }
  for (const token of queryTokens) {
    if (!STOP.has(token) && token.length >= 4) phrases.push(token);
  }
  phrases.sort((a, b) => b.length - a.length);

  const pickUnique = (candidates: ProductContextItem[]): string[] => {
    const singles = candidates.filter((product) => !product.isBundle);
    if (singles.length === 1) return [singles[0].slug];
    if (candidates.length === 1) return [candidates[0].slug];
    if (singles.length >= 2) return singles.slice(0, 2).map((product) => product.slug);
    if (candidates.length >= 2) {
      return candidates.slice(0, 2).map((product) => product.slug);
    }
    return [];
  };

  const matched: string[] = [];
  for (const phrase of phrases) {
    const inPool = pool.filter((product) => productHasPhrase(product, phrase));
    if (inPool.length === 1) {
      if (!matched.includes(inPool[0].slug)) matched.push(inPool[0].slug);
      continue;
    }
    if (inPool.length >= 2) {
      for (const product of inPool) {
        if (!matched.includes(product.slug)) matched.push(product.slug);
      }
      continue;
    }
    /* Single words are far too blunt to name a SKU catalog-wide: "skin" in
     * "show sunscreens for oily skin" would otherwise resolve to whichever
     * lone title happens to contain it. Against the page / conversation pool
     * above they are safe, because the shopper is already on that product. */
    if (!phrase.includes(" ")) continue;
    const inCatalog = products.filter((product) =>
      productHasPhrase(product, phrase),
    );
    const unique = pickUnique(inCatalog);
    if (unique.length === 1 && !matched.includes(unique[0])) {
      matched.push(unique[0]);
    }
  }

  return matched.slice(0, 2);
}

export function resolveActiveProductContext(
  input: ResolveActiveProductContextInput,
): ResolvedProductContext {
  const conversationSlugs = uniqueSlugs(input.conversationSlugs).slice(0, 2);
  const pageSlug = input.pageSlug || null;
  const mentioned = matchProductsInText(input.text, input.products, {
    conversationSlugs,
    pageSlug,
  });

  if (mentioned.length > 0) {
    return { kind: "explicit", slugs: mentioned.slice(0, 2) };
  }

  if (
    conversationSlugs.length >= 2 &&
    isPronounProductQuestion(input.text) &&
    !isMultiProductRelationQuery(input.text)
  ) {
    return { kind: "ambiguous", slugs: conversationSlugs };
  }

  if (conversationSlugs.length > 0) {
    return { kind: "conversation", slugs: conversationSlugs };
  }

  if (pageSlug) {
    return { kind: "page", slugs: [pageSlug] };
  }

  return { kind: "none", slugs: [] };
}
