/* =============================================================
 * Category explainers for the PLP.
 *
 * Listing pages tell shoppers what's on the shelf, never what the
 * shelf is. Each explainer teaches the category in two lines, drawn
 * from Shiseido's own skincare blog (cited via `source`), then offers
 * pills that open the advisor to narrow things down.
 *
 * Pill prompts are written as the shopper would say them, because
 * they appear as the shopper's own message in the chat.
 * ============================================================= */

import { SKIN_GUIDES, TARGETED } from "./plpTargetedExplainers";

export type PlpPill = {
  label: string;
  prompt: string;
};

export type PlpExplainer = {
  id: string;
  title: string;
  body: string;
  /** In-store Skincare Blog article the copy is drawn from. */
  source?: { label: string; slug: string };
  /**
   * Photo for the strip's thumbnail. Falls back to the cited article's
   * photo, so give one wherever several guides cite the same article.
   */
  image?: { src: string; alt: string; position?: string };
  pills: PlpPill[];
};

const SUNSCREEN: PlpExplainer = {
  id: "sunscreen",
  title: "The most effective anti-aging step there is",
  body:
    "It shields skin from UVA and UVB rays, which reach you all year, even through windows, and cause early aging and dark spots. Chemical formulas absorb UV and vanish on skin; mineral formulas sit on top and reflect it.",
  source: { label: "Mineral vs. chemical sunscreen", slug: "mineral-vs-chemical-sunscreen" },
  pills: [
    { label: "Mineral or chemical for me?", prompt: "Should I use a mineral or a chemical sunscreen? Help me pick one for my skin." },
    { label: "Holds up to sweat and water", prompt: "Help me find a sunscreen that holds up to sweat and water for workouts and beach days." },
    { label: "Invisible under makeup", prompt: "Help me find a sunscreen that's invisible under makeup, with no white cast." },
    { label: "Won't make me shiny", prompt: "I have oily skin. Help me find a sunscreen that won't make me shiny." },
  ],
};

const MOISTURIZERS: PlpExplainer = {
  id: "moisturizers",
  title: "Even oily skin needs moisture",
  body:
    "It's a blend of oil, water and nourishing ingredients that restores moisture and locks it in. Oily skin needs it too: skin that's too dry makes even more oil.",
  source: { label: "Moisturizer guide", slug: "moisturizer-guide" },
  pills: [
    { label: "Right for my skin type", prompt: "Help me find the right moisturizer for my skin type." },
    { label: "Day cream with SPF", prompt: "Help me pick a day cream with SPF so I can moisturize and protect in one step." },
    { label: "Night cream that repairs", prompt: "Help me pick a night cream that hydrates and smooths while I sleep." },
    { label: "Lift and firm", prompt: "My skin is losing firmness. Help me find a moisturizer that lifts and firms." },
  ],
};

const SERUMS: PlpExplainer = {
  id: "serums",
  title: "Where the targeted work happens",
  body:
    "A serum treats one concern, like fine lines, dark spots or lost firmness, with concentrated ingredients. It goes on after cleansing and softening, before moisturizer, and you can layer more than one.",
  source: { label: "The Japanese skincare routine", slug: "japanese-skincare-routine" },
  pills: [
    { label: "Smooth fine lines", prompt: "Help me find a serum to smooth fine lines and wrinkles." },
    { label: "Fade dark spots", prompt: "Help me find a serum that fades dark spots and evens my skin tone." },
    { label: "Firm and lift", prompt: "My skin is starting to sag. Help me find a serum that firms and lifts." },
    { label: "Can I layer two?", prompt: "Can I layer two serums? Help me pair the right ones and tell me the order." },
  ],
};

const CLEANSERS: PlpExplainer = {
  id: "cleansers",
  title: "Everything works better on clean skin",
  body:
    "Cleansing clears away makeup, dirt and oil so the rest of your routine can work, without stripping moisture. Wear long-wear makeup? Dissolve it first with a remover or oil, then follow with a foam.",
  source: { label: "The Japanese skincare routine", slug: "japanese-skincare-routine" },
  pills: [
    { label: "Takes off waterproof makeup", prompt: "Help me find a cleanser that takes off waterproof and long-wear makeup." },
    { label: "Gentle for dry skin", prompt: "My skin feels tight after washing. Help me find a gentle cleanser for dry skin." },
    { label: "For oily, blemish-prone skin", prompt: "Help me find a cleanser for oily, blemish-prone skin." },
    { label: "Do I need to double cleanse?", prompt: "Do I need to double cleanse? Help me pick the two cleansers if I do." },
  ],
};

const SOFTENERS: PlpExplainer = {
  id: "softeners",
  title: "The Japanese step most routines skip",
  body:
    "A step unique to Japanese skincare: a water-light lotion that hydrates and preps skin to absorb everything after it. Sweep it on with a cotton pad right after cleansing.",
  source: { label: "The Japanese skincare routine", slug: "japanese-skincare-routine" },
  pills: [
    { label: "Is it the same as toner?", prompt: "Is a softener the same as a toner? Help me understand if I need one." },
    { label: "For dry skin", prompt: "Help me pick a softener for normal to dry skin." },
    { label: "For oily skin", prompt: "Help me pick a softener for normal to oily skin." },
    { label: "Where does it go?", prompt: "Where does a softener go in my routine? Help me put my steps in order." },
  ],
};

const EYE_LIP: PlpExplainer = {
  id: "eye-lip",
  title: "The first place skin shows tiredness",
  body:
    "The skin around your eyes is thinner and more delicate, so it shows lines, puffiness and tiredness first. Creams care for it every day; eye masks give a 10-minute boost.",
  source: { label: "How to tighten skin", slug: "how-to-tighten-skin" },
  pills: [
    { label: "Puffiness and dark circles", prompt: "I have puffiness and dark circles. Help me find the right eye treatment." },
    { label: "Fine lines and crow's feet", prompt: "Help me smooth fine lines and crow's feet around my eyes." },
    { label: "Eye cream or eye mask?", prompt: "Should I use an eye cream or an eye mask? Help me choose." },
    { label: "Firm the eye area", prompt: "Help me firm and lift the skin around my eyes." },
  ],
};

const MASKS: PlpExplainer = {
  id: "masks",
  title: "A ten-minute boost when skin needs it",
  body:
    "A mask is a concentrated boost on top of your routine: minutes to firm, clear pores or recharge overnight. A lifting face-and-neck mask works in about 10 minutes, right before your serum.",
  source: { label: "How to tighten skin", slug: "how-to-tighten-skin" },
  pills: [
    { label: "Glow before an event", prompt: "I have an event tomorrow. Help me pick a mask for a quick glow." },
    { label: "Clear my pores", prompt: "Help me find a mask that clears my pores." },
    { label: "Lift and firm", prompt: "Help me find a mask that lifts and firms." },
    { label: "How often should I mask?", prompt: "How often should I use a face mask? Help me fit one into my routine." },
  ],
};

const SETS: PlpExplainer = {
  id: "sets",
  title: "A complete routine, already matched",
  body:
    "Sets pair products that are made to work together, so you get a full routine, or a ready-made gift, for less than buying each one. Each is built around a goal, from lifting to sun protection.",
  source: { label: "The Japanese skincare routine", slug: "japanese-skincare-routine" },
  pills: [
    { label: "A gift for someone special", prompt: "Help me choose a skincare gift set for someone special." },
    { label: "Start a full routine", prompt: "Help me start a full skincare routine with one set." },
    { label: "Gifts for him", prompt: "Help me pick a skincare set for a man." },
    { label: "Under $100", prompt: "Help me find a skincare set under $100." },
  ],
};

const ROUTINE: PlpExplainer = {
  id: "routine",
  title: "Fewer products, in the right order",
  body:
    "Layer from lightest to richest: cleanse, soften, strengthen, treat, moisturize, then protect. Each step preps skin for the next, so you don't need dozens of products to see results.",
  source: { label: "The Japanese skincare routine", slug: "japanese-skincare-routine" },
  pills: [
    { label: "Build my routine", prompt: "Help me build a skincare routine for my skin, morning and night." },
    { label: "Where do I start?", prompt: "I'm new to Shiseido. Help me figure out which products to start with." },
    { label: "Anti-aging essentials", prompt: "Help me build an anti-aging routine with the essentials." },
    { label: "A simple routine for him", prompt: "Help me build a simple skincare routine for a man." },
  ],
};

/** Strongest match first: specific shelves before broad words. */
const TOPICS: { test: RegExp; explainer: PlpExplainer }[] = [
  { test: /\bsun|spf|uv\b/i, explainer: SUNSCREEN },
  { test: /\beye|lip/i, explainer: EYE_LIP },
  { test: /\bmask/i, explainer: MASKS },
  { test: /serum|treatment|essence|concentrate/i, explainer: SERUMS },
  { test: /cleans|makeup remover|face wash/i, explainer: CLEANSERS },
  { test: /soften|toner|lotion/i, explainer: SOFTENERS },
  { test: /moistur|cream/i, explainer: MOISTURIZERS },
  { test: /\bsets?\b|bundle|gift/i, explainer: SETS },
];

export type SkinProfile = "oily" | "dry" | "sensitive" | "combination" | "mature";

/** Words shoppers use for each skin profile. Combination first, so "oily T-zone, dry cheeks" lands there. */
const SKIN_WORDS: [SkinProfile, RegExp][] = [
  ["combination", /combination|combo skin|t-?zone|oily and dry|dry and oily/i],
  ["sensitive", /sensitiv|redness|\bred(ness)? skin|irritat|reactive|rosacea|eczema/i],
  ["oily", /\boily|\bshin(e|y)\b|greasy|\bpores?\b|acne|breakout|blemish|congest/i],
  ["dry", /\bdry|dehydrat|flak|parched|tight skin/i],
  ["mature", /mature|aging|ageing|anti-?age|wrinkle|fine lines?|firm|sag|crepey|over (40|50|60)|\b[4-6]0s\b/i],
];

/** Skin-type filter values that map straight onto a profile. */
const SUBTYPE_PROFILE: Record<string, SkinProfile> = {
  oily: "oily",
  dry: "dry",
  sensitive: "sensitive",
  combination: "combination",
};

/** Concern filter values that imply a profile when no skin type is set. */
const CONCERN_PROFILE: Record<string, SkinProfile> = {
  "anti-aging": "mature",
  "wrinkle-smoothing": "mature",
  "lifting-and-firming": "mature",
  "pore-minimizing": "oily",
  "deeply-hydrating": "dry",
};

function profileFrom(
  query: string,
  skinTypes: readonly string[],
  concerns: readonly string[],
): SkinProfile | null {
  if (query) {
    const hit = SKIN_WORDS.find(([, re]) => re.test(query));
    if (hit) return hit[0];
  }
  const typed = skinTypes.map((t) => SUBTYPE_PROFILE[t]).filter(Boolean);
  if (typed.length === 1) return typed[0];
  const implied = [...new Set(concerns.map((c) => CONCERN_PROFILE[c]).filter(Boolean))];
  if (implied.length === 1) return implied[0];
  return null;
}

export type PlpExplainerContext = {
  /** The single active category, if exactly one. */
  category: string | null;
  /** The keyword search, e.g. "serum for oily skin". */
  searchQuery: string;
  /** Active Skin type filter values. */
  skinTypes?: readonly string[];
  /** Active Concern filter values. */
  concerns?: readonly string[];
};

/**
 * Picks the explainer for the shelf in view. The shelf comes from the
 * active category, else the search words. A skin profile, from the
 * search words or the Skin type / Concern filters, narrows it to a
 * targeted guide ("cleansers for oily skin") when one exists. A search
 * that names a skin profile but no shelf gets that profile's guide.
 * The full catalog gets the routine primer; any other search gets none.
 */
export function resolvePlpExplainer({
  category,
  searchQuery,
  skinTypes = [],
  concerns = [],
}: PlpExplainerContext): PlpExplainer | null {
  const shelfText = category ?? searchQuery;
  const shelf = shelfText ? TOPICS.find((t) => t.test.test(shelfText))?.explainer ?? null : null;
  const profile = profileFrom(searchQuery, skinTypes, concerns);

  if (shelf && profile) return TARGETED[`${shelf.id}:${profile}`] ?? shelf;
  if (shelf) return shelf;
  if (profile && (searchQuery || !category)) return SKIN_GUIDES[profile] ?? null;
  if (!category && !searchQuery) return ROUTINE;
  return null;
}
