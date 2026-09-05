/**
 * Ordinal compare against the latest PLP / routine carousel ("compare the
 * 1st and 3rd product") without requiring checkbox selection.
 */

export type OrdinalCompareAsk = {
  /** 1-based positions the shopper named (2–3 values). */
  ordinals: number[];
  /** Category/step cue when present ("cleanser", "moisturizers"). */
  categoryHint: string | null;
};

export type ListingSection = {
  stepLabel: string;
  categoryTitle: string;
  /** Catalog category key when known (e.g. "Cleansers"). */
  categoryKey?: string;
  /** Slugs currently shown in this section's carousel, left-to-right. */
  slugs: string[];
};

export type LatestListing =
  | { kind: "plp"; slugs: string[] }
  | { kind: "routine"; accordion: boolean; sections: ListingSection[] };

export type OrdinalResolveOk = {
  kind: "ok";
  slugs: string[];
  sectionLabel?: string;
};

export type OrdinalResolveClarify = {
  kind: "clarify";
  ordinals: number[];
  /** Chip labels like "1st & 3rd Cleansers". */
  chips: string[];
  body: string;
};

export type OrdinalResolveError = {
  kind: "error";
  body: string;
};

export type OrdinalResolveResult =
  | OrdinalResolveOk
  | OrdinalResolveClarify
  | OrdinalResolveError;

const ORDINAL_WORD: Record<string, number> = {
  first: 1,
  "1st": 1,
  "1": 1,
  second: 2,
  "2nd": 2,
  "2": 2,
  third: 3,
  "3rd": 3,
  "3": 3,
  fourth: 4,
  "4th": 4,
  "4": 4,
  fifth: 5,
  "5th": 5,
  "5": 5,
};

const COMPARE_CUE =
  /\b(compare|comparison|versus|vs\.?|side[-\s]?by[-\s]?side|which\s+(one|is)\s+better)\b/i;

/** Loose category / step tokens → normalized hint for section matching. */
const CATEGORY_PATTERNS: { hint: string; pattern: RegExp }[] = [
  { hint: "cleanser", pattern: /\bcleans(?:e|er|ers|ing)?\b/i },
  { hint: "softener", pattern: /\bsoften(?:er|ers|ing)?\b|\btoner(?:s)?\b/i },
  {
    hint: "serum",
    pattern: /\bserum(?:s)?\b|\btreat(?:ment|ments)?\b|\bessence(?:s)?\b/i,
  },
  {
    hint: "moisturizer",
    pattern: /\bmoisturi[sz](?:e|er|ers|ing)?\b|\bcream(?:s)?\b|\blotion(?:s)?\b/i,
  },
  {
    hint: "sunscreen",
    pattern: /\bsunscreen(?:s)?\b|\bsun\s*protect\w*\b|\bspf\b|\bprotect\b/i,
  },
  { hint: "eye", pattern: /\beye(?:\s*cream)?s?\b|\blip\b/i },
  { hint: "mask", pattern: /\bmask(?:s)?\b/i },
];

function uniqueSortedOrdinals(values: number[]): number[] {
  return [...new Set(values.filter((n) => n >= 1 && n <= 12))].sort(
    (a, b) => a - b,
  );
}

function extractOrdinals(text: string): number[] {
  const found: number[] = [];
  const wordRe =
    /\b(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = wordRe.exec(text)) != null) {
    const n = ORDINAL_WORD[match[1].toLowerCase()];
    if (n) found.push(n);
  }
  // "1 and 3", "products 1 and 3", "1st & 3rd" (digits already partly covered)
  const digitRe = /\b([1-5])(?:st|nd|rd|th)?\b/gi;
  while ((match = digitRe.exec(text)) != null) {
    const n = Number(match[1]);
    if (n >= 1) found.push(n);
  }
  return uniqueSortedOrdinals(found);
}

function extractCategoryHint(text: string): string | null {
  for (const { hint, pattern } of CATEGORY_PATTERNS) {
    if (pattern.test(text)) return hint;
  }
  return null;
}

/**
 * Detect a compare-by-position ask. Requires a compare cue and at least two
 * ordinals, or a clarify-chip shape like "1st & 3rd Cleansers".
 */
export function detectOrdinalCompare(text: string): OrdinalCompareAsk | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const ordinals = extractOrdinals(trimmed);
  if (ordinals.length < 2) return null;
  const categoryHint = extractCategoryHint(trimmed);
  const chipShape =
    /^\s*(?:\d(?:st|nd|rd|th)?|first|second|third)\b/i.test(trimmed) &&
    Boolean(categoryHint);
  if (!COMPARE_CUE.test(trimmed) && !chipShape) return null;
  return {
    ordinals: ordinals.slice(0, 3),
    categoryHint,
  };
}

/** Category-only reply after a clarify turn ("cleansers", "Cleanse"). */
export function detectCategoryOnlyReply(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 48) return null;
  // Ignore full compare sentences — those go through detectOrdinalCompare.
  if (COMPARE_CUE.test(trimmed) && extractOrdinals(trimmed).length >= 2) {
    return null;
  }
  return extractCategoryHint(trimmed);
}

export function sectionMatchesHint(
  section: ListingSection,
  hint: string | null,
): boolean {
  if (!hint) return false;
  const blob = `${section.stepLabel} ${section.categoryTitle} ${section.categoryKey ?? ""}`.toLowerCase();
  const h = hint.toLowerCase();
  if (h === "cleanser") return /cleans/.test(blob);
  if (h === "softener") return /soften|toner/.test(blob);
  if (h === "serum") return /serum|treat|essence/.test(blob);
  if (h === "moisturizer") return /moisturi|cream|lotion/.test(blob);
  if (h === "sunscreen") return /sun|spf|protect/.test(blob);
  if (h === "eye") return /\beye\b|\blip\b/.test(blob);
  if (h === "mask") return /mask/.test(blob);
  return blob.includes(h);
}

export function formatOrdinalPhrase(ordinals: number[]): string {
  const labels = ordinals.map((n) => {
    if (n === 1) return "1st";
    if (n === 2) return "2nd";
    if (n === 3) return "3rd";
    return `${n}th`;
  });
  if (labels.length === 2) return `${labels[0]} & ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} & ${labels[labels.length - 1]}`;
}

export function buildOrdinalClarifyChips(
  ordinals: number[],
  sections: ListingSection[],
): string[] {
  const phrase = formatOrdinalPhrase(ordinals);
  return sections
    .filter((section) => section.slugs.length > 0)
    .map((section) => `${phrase} ${section.categoryTitle}`);
}

function pickSlugsAtOrdinals(
  slugs: string[],
  ordinals: number[],
): { ok: string[] } | { error: string } {
  if (slugs.length === 0) {
    return { error: "I don't have products in that row to compare yet." };
  }
  const picked: string[] = [];
  for (const n of ordinals) {
    const slug = slugs[n - 1];
    if (!slug) {
      return {
        error: `I only see ${slugs.length} product${slugs.length === 1 ? "" : "s"} in this row — try numbers within that range.`,
      };
    }
    if (!picked.includes(slug)) picked.push(slug);
  }
  if (picked.length < 2) {
    return {
      error: "I need at least two different products to compare.",
    };
  }
  return { ok: picked };
}

/**
 * Resolve ordinals against the latest listing + open accordion index.
 * `openIndex` is only used when listing is a routine with accordion on.
 */
export function resolveOrdinalCompare(
  ask: OrdinalCompareAsk,
  listing: LatestListing | null,
  openIndex: number | null,
): OrdinalResolveResult {
  if (!listing) {
    return {
      kind: "error",
      body: "I don't have a product row open to pick from. Browse a few options first, then tell me which positions to compare.",
    };
  }

  if (listing.kind === "plp") {
    const picked = pickSlugsAtOrdinals(listing.slugs, ask.ordinals);
    if ("error" in picked) return { kind: "error", body: picked.error };
    return { kind: "ok", slugs: picked.ok };
  }

  const { sections, accordion } = listing;
  if (sections.length === 0) {
    return {
      kind: "error",
      body: "I don't have routine steps loaded yet. Give me a moment for the recommendations to land.",
    };
  }

  // Named category always wins when it matches a section.
  if (ask.categoryHint) {
    const match = sections.find((section) =>
      sectionMatchesHint(section, ask.categoryHint),
    );
    if (!match) {
      return {
        kind: "error",
        body: `I couldn't find a ${ask.categoryHint} step in this routine. Try one of the categories shown.`,
      };
    }
    const picked = pickSlugsAtOrdinals(match.slugs, ask.ordinals);
    if ("error" in picked) return { kind: "error", body: picked.error };
    return {
      kind: "ok",
      slugs: picked.ok,
      sectionLabel: match.categoryTitle,
    };
  }

  if (accordion) {
    if (openIndex == null || !sections[openIndex]) {
      return {
        kind: "clarify",
        ordinals: ask.ordinals,
        chips: buildOrdinalClarifyChips(ask.ordinals, sections),
        body: `Which step should I use for the ${formatOrdinalPhrase(ask.ordinals)} — open a category fold, or pick one below?`,
      };
    }
    const section = sections[openIndex];
    const picked = pickSlugsAtOrdinals(section.slugs, ask.ordinals);
    if ("error" in picked) return { kind: "error", body: picked.error };
    return {
      kind: "ok",
      slugs: picked.ok,
      sectionLabel: section.categoryTitle,
    };
  }

  // All sections open — need a category.
  return {
    kind: "clarify",
    ordinals: ask.ordinals,
    chips: buildOrdinalClarifyChips(ask.ordinals, sections),
    body: `Which category should I use for the ${formatOrdinalPhrase(ask.ordinals)}?`,
  };
}

/** Build listing snapshot from the latest PLP or routine chat message. */
export function listingFromMessages(
  messages: ReadonlyArray<{
    kind: string;
    products?: { id?: string; slug?: string }[];
    sections?: {
      stepLabel: string;
      categoryTitle: string;
      categoryKey?: string;
      products: { id?: string; slug?: string }[];
    }[];
  }>,
  accordion: boolean,
): LatestListing | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.kind === "agent_plp" && message.products) {
      const slugs = message.products
        .map((p) => p.id ?? p.slug)
        .filter((slug): slug is string => Boolean(slug));
      if (slugs.length > 0) return { kind: "plp", slugs };
    }
    if (message.kind === "agent_routine" && message.sections?.length) {
      return {
        kind: "routine",
        accordion,
        sections: message.sections.map((section) => ({
          stepLabel: section.stepLabel,
          categoryTitle: section.categoryTitle,
          categoryKey: section.categoryKey,
          slugs: section.products
            .map((p) => p.id ?? p.slug)
            .filter((slug): slug is string => Boolean(slug)),
        })),
      };
    }
  }
  return null;
}
