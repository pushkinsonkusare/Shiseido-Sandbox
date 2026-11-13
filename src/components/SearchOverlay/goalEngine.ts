import type { CatalogProduct } from "../../catalog/catalog";
import { isBundleTrippingPhrase } from "./assistantSuggestions";

/* =============================================================
 * Goal engine for the search overlay's advisor suggestions.
 *
 * Turns whatever the shopper typed into 3 goals that the advisor can
 * act on. Runs locally and synchronously, so something useful always
 * shows on the same keystroke as the product grid (the AI upgrade in
 * `assistantSuggestionsLLM.ts` may refine it afterwards).
 *
 * Signals, strongest first:
 *   1. Situations    "travel", "wedding", "gym", "winter", "gift"...
 *   2. Concerns      "fine lines", "dark spots", "oily", "puffy eyes"...
 *   3. Collections   "ultimune" → defend skin + prevent early ageing
 *   4. Categories    "serum", "sunscreen", "eye cream"...
 *   5. Matched products: collection + goals mined from benefit copy
 *   6. Fallback starters, so even nonsense gets an entry point
 * Modifiers (budget, age, morning/night) tune the wording and prompt.
 *
 * Each goal carries a short `label` (what the shopper reads), a value
 * `hint` (what they get), and a fuller `prompt` (what the advisor
 * receives). Prompts always include a broad cue ("Help me…") and a
 * goal keyword the advisor's router recognises (anti-aging,
 * brightening, hydrating, oily, sunscreen, men's), so a click lands
 * on a curated multi-product answer instead of a keyword search.
 * ============================================================= */

export type GoalKind =
  | "situation"
  | "concern"
  | "routine"
  | "compare"
  | "gift"
  | "discover";

export type AssistantGoal = {
  /** Stable id used for de-duplication across signals. */
  id: string;
  kind: GoalKind;
  /** Shopper-facing prompt, outcome first. */
  label: string;
  /** One-line value promise shown under the label. */
  hint: string;
  /** Full question sent to the advisor on click. */
  prompt: string;
  /** Advisor routing goal (anti-aging, brightening, sun, ...) if any. */
  goal?: string;
  score: number;
  source: "rule" | "llm";
};

export const MAX_GOALS = 3;
const FALLBACK_SCORE = 10;

/* ---------- Modifiers ---------- */

type Modifiers = {
  budget: number | null;
  age: string | null;
  timeOfDay: "morning" | "night" | null;
};

function readModifiers(q: string): Modifiers {
  const budgetMatch =
    q.match(/\b(?:under|below|less than|max|up to|<)\s*\$?\s*(\d{2,4})\b/i) ??
    q.match(/\$\s*(\d{2,4})\b/);
  const cheap = /\b(cheap|affordable|budget|inexpensive|low[-\s]?cost)\b/i.test(q);
  const ageMatch =
    q.match(/\b(?:in\s+my\s+)?(20|30|40|50|60)'?s\b/i) ??
    q.match(/\b(?:i'?m|aged?)\s+(2|3|4|5|6)\d\b/i);
  let age: string | null = null;
  if (ageMatch) {
    const decade = ageMatch[1].length === 1 ? `${ageMatch[1]}0` : ageMatch[1];
    age = `${decade}s`;
  }
  return {
    budget: budgetMatch ? Number(budgetMatch[1]) : cheap ? 60 : null,
    age,
    timeOfDay: /\b(morning|am\s+routine|daytime)\b/i.test(q)
      ? "morning"
      : /\b(night|evening|pm\s+routine|bedtime|overnight)\b/i.test(q)
        ? "night"
        : null,
  };
}

function budgetSuffix(mods: Modifiers): string {
  return mods.budget ? ` under $${mods.budget}` : "";
}

function withBudget(text: string, mods: Modifiers): string {
  return `${text}${budgetSuffix(mods)}`;
}

/* ---------- 1. Situations ---------- */

type Template = Omit<AssistantGoal, "score" | "source">;
type SituationRule = { id: string; test: RegExp; goals: (m: Modifiers) => Template[] };

const SITUATIONS: SituationRule[] = [
  {
    id: "beach",
    test: /\b(beach|pool|swim\w*|summer|tropical|humid\w*|heat|hot\s+weather|sweat\w*|sunny|island|resort|outdoors?|hiking|golf)\b/i,
    goals: () => [
      {
        id: "beach-spf",
        kind: "situation",
        label: "SPF that survives sweat and water",
        hint: "High protection · water-resistant · no white cast",
        prompt: "Help me find a high SPF sunscreen that holds up to sweat and water for beach and outdoor days",
        goal: "sun",
      },
      {
        id: "beach-shine",
        kind: "concern",
        label: "Stay shine-free in the heat",
        hint: "Lightweight, oil-controlling picks",
        prompt: "Help me control oily shine in hot, humid weather with lightweight skincare",
        goal: "pore-control",
      },
      {
        id: "beach-after",
        kind: "routine",
        label: "Recover skin after a day in the sun",
        hint: "Soothe, rehydrate and even tone",
        prompt: "Help me build a hydrating routine to recover my skin after a lot of sun",
        goal: "hydration",
      },
    ],
  },
  {
    id: "travel",
    test: /\b(travel\w*|trip|trips|flight|flights|flying|fly|plane|airport|carry[-\s]?on|tsa|vacay|vacation|holiday|holidays|abroad|jet[-\s]?lag|getaway|road\s*trip|packing|pack)\b/i,
    goals: (m) => [
      {
        id: "travel-routine",
        kind: "situation",
        label: "Pack a carry-on skincare routine",
        hint: "Travel sizes · fewer steps · SPF included",
        prompt: withBudget(
          "Help me pack a carry-on friendly skincare routine for travel, with travel sizes and a sunscreen",
          m,
        ),
        goal: "sun",
      },
      {
        id: "travel-flight",
        kind: "concern",
        label: "Keep skin hydrated on long flights",
        hint: "Beat cabin dryness and jet-lag dullness",
        prompt: "Help me keep my skin hydrated on long flights. My skin gets dry and dull when I travel, so I need a hydrating routine",
        goal: "hydration",
      },
      {
        id: "travel-sun",
        kind: "situation",
        label: "Sun protection for your trip",
        hint: "Water-resistant SPF · compact formats",
        prompt: "Help me choose sunscreen for my trip, ideally water-resistant and compact enough to carry",
        goal: "sun",
      },
    ],
  },
  {
    id: "winter",
    test: /\b(winter|cold\s+weather|cold|snow|ski|skis|skiing|skier|snowboard\w*|freezing|dry\s+air|heating|central\s+heating|wind\w*|altitude)\b/i,
    goals: () => [
      {
        id: "winter-barrier",
        kind: "routine",
        label: "A winter rescue routine for dry skin",
        hint: "Richer textures · barrier care · 3 steps",
        prompt: "Help me build a hydrating winter routine for dry, tight skin",
        goal: "hydration",
      },
      {
        id: "winter-spf",
        kind: "situation",
        label: "SPF for snow and altitude",
        hint: "Snow reflects UV, so protection still matters",
        prompt: "Help me choose sunscreen for skiing and snowy, high-altitude days",
        goal: "sun",
      },
    ],
  },
  {
    id: "event",
    test: /\b(wedding|bride|bridal|event|party|parties|date\s*night|date|big\s+day|photo\w*|prom|gala|graduation|interview|red\s+carpet|special\s+occasion)\b/i,
    goals: () => [
      {
        id: "event-glow",
        kind: "situation",
        label: "Get glowing skin before the big day",
        hint: "A countdown routine for radiance",
        prompt: "Help me get glowing, radiant skin before a big event. Build me a brightening routine I can start now",
        goal: "brightening",
      },
      {
        id: "event-prep",
        kind: "routine",
        label: "Prep skin so make-up sits perfectly",
        hint: "Smooth, hydrated, camera-ready base",
        prompt: "Help me prep my skin so make-up sits smoothly. I want a hydrating routine for the morning of an event",
        goal: "hydration",
      },
    ],
  },
  {
    id: "gym",
    test: /\b(gym|workout|work\s*out|exercise|running|run|yoga|pilates|sport\w*|training|cycling|marathon|fitness)\b/i,
    goals: () => [
      {
        id: "gym-routine",
        kind: "situation",
        label: "A post-workout skin routine",
        hint: "Clear pores and rehydrate after sweat",
        prompt: "Help me build a routine for after workouts to keep pores clear and control oily skin",
        goal: "pore-control",
      },
      {
        id: "gym-spf",
        kind: "situation",
        label: "Sweat-proof SPF for outdoor training",
        hint: "Stays put while you move",
        prompt: "Help me find a sweat-resistant sunscreen for running and outdoor training",
        goal: "sun",
      },
    ],
  },
  {
    id: "tired",
    test: /\b(tired|exhausted|late\s+nights?|no\s+sleep|lack\s+of\s+sleep|sleepless|stress\w*|burn\s*out|screen\s*time|office|new\s+(mom|mum|parent)|hungover)\b/i,
    goals: () => [
      {
        id: "tired-revive",
        kind: "concern",
        label: "Revive tired, dull skin",
        hint: "Bring back radiance after late nights",
        prompt: "Help me revive tired, dull skin. I want a brightening routine that brings back glow",
        goal: "brightening",
      },
      {
        id: "tired-eyes",
        kind: "concern",
        label: "Brighten tired, puffy eyes",
        hint: "Eye care that targets dark circles",
        prompt: "Help me with tired, puffy eyes and dark circles. Recommend anti-aging eye care",
        goal: "anti-aging",
      },
    ],
  },
  {
    id: "city",
    test: /\b(city|urban|pollution|commut\w*|smog|subway|daily\s+commute)\b/i,
    goals: () => [
      {
        id: "city-spf",
        kind: "situation",
        label: "Everyday SPF for city life",
        hint: "Light, invisible protection for commutes",
        prompt: "Help me find a lightweight everyday sunscreen for city life and commuting",
        goal: "sun",
      },
    ],
  },
  {
    id: "beginner",
    test: /\b(beginner|new\s+to\s+skincare|first\s+(routine|time)|start(ing)?\s+out|simple|basic\w*|easy|minimal\w*|lazy|quick|no\s+time|where\s+to\s+start|teen\w*)\b/i,
    goals: (m) => [
      {
        id: "beginner-routine",
        kind: "routine",
        label: "Build a simple 3-step routine",
        hint: "Cleanse, moisturize, protect, done",
        prompt: withBudget(
          "Help me build a simple beginner skincare routine with just the essentials",
          m,
        ),
      },
    ],
  },
  {
    id: "luxury",
    test: /\b(luxury|luxurious|splurge|treat\s+myself|premium|best\s+of\s+the\s+best|high[-\s]?end|indulg\w*|spa)\b/i,
    goals: () => [
      {
        id: "luxury-ritual",
        kind: "routine",
        label: "A luxury anti-aging ritual",
        hint: "Future Solution LX and prestige picks",
        prompt: "Help me build a luxury anti-aging ritual with Shiseido's most premium products",
        goal: "anti-aging",
      },
    ],
  },
  {
    id: "refill",
    test: /\b(refill\w*|sustainab\w*|eco|less\s+waste|zero\s+waste|planet|green)\b/i,
    goals: () => [
      {
        id: "refill-routine",
        kind: "discover",
        label: "Switch to refillable favourites",
        hint: "Same results, less packaging",
        prompt: "Help me find refillable skincare so I can cut down on packaging",
      },
    ],
  },
];

/* ---------- Gifts (own rule: needs recipient wording) ---------- */

const GIFT_TEST =
  /\b(gift\w*|present|presents|birthday|anniversary|christmas|xmas|holiday\s+gift|valentine'?s?|mother'?s\s+day|father'?s\s+day|stocking|secret\s+santa|for\s+(my\s+)?(mom|mum|mother|wife|girlfriend|her|sister|friend|husband|boyfriend|him|dad|father|partner))\b/i;
const GIFT_HIM = /\b(him|husband|boyfriend|dad|father|father'?s\s+day|brother|men|man)\b/i;

function giftGoals(q: string, m: Modifiers): Template[] {
  const forHim = GIFT_HIM.test(q);
  const budget = m.budget ?? null;
  return [
    {
      id: "gift-find",
      kind: "gift",
      label: forHim ? "Find a skincare gift he'll actually use" : "Find a gift she'll love",
      hint: budget ? `Curated picks under $${budget}` : "Curated picks with a reason for each",
      prompt: forHim
        ? withBudget("Help me pick a men's skincare gift that's simple to use", m)
        : withBudget("Help me pick a skincare gift for her. Suggest crowd-pleasing best sellers", m),
      goal: forHim ? "mens" : undefined,
    },
    {
      id: "gift-sets",
      kind: "gift",
      label: budget ? `Gift sets under $${budget}` : "Gift-ready sets that save more",
      hint: "Ready to give · better value than singles",
      // Bundle wording is intentional here: sets ARE the answer.
      prompt: withBudget("Show me skincare gift sets", m),
    },
  ];
}

/* ---------- 2. Concerns ---------- */

type ConcernRule = {
  id: string;
  test: RegExp;
  goal: string;
  /** Short topic used in the follow-on routine / compare rows. */
  topic?: string;
  templates: (m: Modifiers) => Template[];
};

const CONCERNS: ConcernRule[] = [
  {
    id: "lines",
    goal: "anti-aging",
    topic: "fine lines",
    test: /\b(fine\s*lines?|wrinkl\w*|crow'?s\s*feet|creas\w*|laugh\s*lines?|smile\s*lines?|aging|ageing|anti[-\s]?ag\w*|mature|youthful|prevent\w*\s+aging|older)\b/i,
    templates: (m) => [
      {
        id: "concern-lines",
        kind: "concern",
        label: m.age ? `An anti-aging routine for your ${m.age}` : "Smooth fine lines and wrinkles",
        hint: "Serum-led routine · visible results",
        prompt: withBudget(
          m.age
            ? `Help me build an anti-aging routine for my ${m.age} that targets fine lines and wrinkles`
            : "Help me build an anti-aging routine that smooths fine lines and wrinkles",
          m,
        ),
        goal: "anti-aging",
      },
    ],
  },
  {
    id: "firm",
    goal: "anti-aging",
    topic: "firming",
    test: /\b(firm\w*|sag\w*|lift\w*|elastic\w*|jawline|contour\w*|plump\w*|volume)\b/i,
    templates: () => [
      {
        id: "concern-firm",
        kind: "concern",
        label: "Lift and firm sagging skin",
        hint: "Vital Perfection-led, with eye care",
        prompt: "Help me lift and firm sagging skin with an anti-aging routine",
        goal: "anti-aging",
      },
    ],
  },
  {
    id: "spots",
    goal: "brightening",
    topic: "dark spots",
    test: /\b(dark\s*spots?|spots?|hyperpigment\w*|pigment\w*|melasma|sun\s*spots?|age\s*spots?|uneven\s*(tone|skin)|dull\w*|bright\w*|glow\w*|radian\w*|luminous)\b/i,
    templates: () => [
      {
        id: "concern-spots",
        kind: "concern",
        label: "Fade dark spots and even out tone",
        hint: "Brightening steps that work together",
        prompt: "Help me fade dark spots and even out my skin tone with a brightening routine",
        goal: "brightening",
      },
    ],
  },
  {
    id: "dry",
    goal: "hydration",
    topic: "dry skin",
    test: /\b(dry|dryness|dehydrat\w*|tight|flak\w*|parched|rough|hydrat\w*|dewy)\b/i,
    templates: () => [
      {
        id: "concern-dry",
        kind: "concern",
        label: "Fix dry, tight skin for good",
        hint: "Layered hydration that lasts all day",
        prompt: "Help me fix dry, tight skin with a hydrating routine",
        goal: "hydration",
      },
    ],
  },
  {
    id: "oily",
    goal: "pore-control",
    topic: "oily skin",
    test: /\b(oily|oil|greasy|shine|shiny|pores?|acne|breakouts?|blemish\w*|blackheads?|congest\w*|sebum|combination)\b/i,
    templates: () => [
      {
        id: "concern-oily",
        kind: "concern",
        label: "Control oil and refine pores",
        hint: "Matte, balanced skin without stripping",
        prompt: "Help me control oily skin and refine pores with a lightweight routine",
        goal: "pore-control",
      },
    ],
  },
  {
    id: "sensitive",
    goal: "hydration",
    topic: "sensitive skin",
    test: /\b(sensitive|redness|red\s+skin|irritat\w*|reactive|rosacea|calm\w*|sooth\w*|gentle|fragrance[-\s]?free)\b/i,
    templates: () => [
      {
        id: "concern-sensitive",
        kind: "concern",
        label: "A gentle routine for sensitive skin",
        hint: "Calming, low-irritation picks",
        prompt: "Help me build a gentle, hydrating routine for sensitive skin",
        goal: "hydration",
      },
    ],
  },
  {
    id: "eyes",
    goal: "anti-aging",
    topic: "dark circles",
    test: /\b(eyes?|under[-\s]?eye|dark\s*circles?|puff\w*|bags)\b/i,
    templates: () => [
      {
        id: "concern-eyes",
        kind: "concern",
        label: "Brighten tired, puffy eyes",
        hint: "Eye care for dark circles and fine lines",
        prompt: "Help me with dark circles and puffy eyes. Recommend anti-aging eye care",
        goal: "anti-aging",
      },
    ],
  },
  {
    id: "sun",
    goal: "sun",
    test: /\b(spf|sunscreen|sunblock|sun\s*(care|protection|cream|screen)?|uv|uva|uvb|tan\w*|burn\w*)\b/i,
    templates: () => [
      {
        id: "concern-sun",
        kind: "concern",
        label: "Find the right SPF for your skin",
        hint: "Matched to your skin type and day",
        prompt: "Help me choose the right sunscreen for my skin type and daily routine",
        goal: "sun",
      },
    ],
  },
  {
    id: "men",
    goal: "mens",
    test: /\b(men'?s?|male|guy|guys|beard|shav\w*|after[-\s]?shave|razor)\b/i,
    templates: () => [
      {
        id: "concern-men",
        kind: "routine",
        label: "A no-fuss routine for men",
        hint: "Two or three steps that actually get used",
        prompt: "Help me build a simple men's skincare routine",
        goal: "mens",
      },
    ],
  },
];

/** Second and third doors for a typed concern: a full AM/PM plan, and
 *  a side-by-side of the strongest picks. */
function concernFollowOns(id: string, topic: string, m: Modifiers): Template[] {
  return [
    {
      id: `concern-${id}-plan`,
      kind: "routine",
      label: `A morning and night plan for ${topic}`,
      hint: "Which step, which product, in what order",
      prompt: withBudget(`Help me build a morning and night routine for ${topic}`, m),
    },
    {
      id: `concern-${id}-compare`,
      kind: "compare",
      label: `Compare the top picks for ${topic}`,
      hint: "Side by side, with who each one is for",
      prompt: `Compare the best products for ${topic}${budgetSuffix(m)} and help me choose`,
    },
  ];
}

/* ---------- 3. Collections ---------- */

type CollectionInfo = {
  name: string;
  test: RegExp;
  goal: string;
  goalLabel: string;
  outcome: string;
  /** First-person verb phrase used after "Help me". */
  ask: string;
  hint: string;
  compareWith: string;
  compareHint: string;
};

const COLLECTIONS: Record<string, CollectionInfo> = {
  ultimune: {
    name: "Ultimune",
    test: /\bultimun\w*|\bultimmune\b|\bimmune\b/i,
    goal: "anti-aging",
    goalLabel: "anti-aging",
    outcome: "Prevent early signs of ageing",
    ask: "strengthen my skin and prevent early signs of ageing",
    hint: "Strengthen skin's defences before lines set in",
    compareWith: "Benefiance",
    compareHint: "Prevention vs. wrinkle correction",
  },
  benefiance: {
    name: "Benefiance",
    test: /\bbenefianc\w*|\bbenefiance\b/i,
    goal: "anti-aging",
    goalLabel: "anti-aging",
    outcome: "Smooth wrinkles and fine lines",
    ask: "smooth wrinkles and fine lines",
    hint: "Retinol-alternative wrinkle care",
    compareWith: "Vital Perfection",
    compareHint: "Wrinkles vs. lifting and dark spots",
  },
  "vital-perfection": {
    name: "Vital Perfection",
    test: /\bvital\s*perfect\w*|\bvital\b/i,
    goal: "anti-aging",
    goalLabel: "lifting and brightening",
    outcome: "Lift, firm and fade dark spots",
    ask: "lift and firm my skin and fade dark spots",
    hint: "Sculpting care for sagging and spots",
    compareWith: "Benefiance",
    compareHint: "Lifting vs. wrinkle smoothing",
  },
  "future-solution-lx": {
    name: "Future Solution LX",
    test: /\bfuture\s*solution\w*|\blx\b/i,
    goal: "anti-aging",
    goalLabel: "luxury anti-aging",
    outcome: "A luxury anti-aging ritual",
    ask: "build a luxury anti-aging ritual",
    hint: "Shiseido's most prestige collection",
    compareWith: "Vital Perfection",
    compareHint: "Prestige ritual vs. targeted lifting",
  },
  "bio-performance": {
    name: "Bio-Performance",
    test: /\bbio[-\s]?perform\w*/i,
    goal: "anti-aging",
    goalLabel: "smoothing",
    outcome: "Plump and smooth skin texture",
    ask: "plump and smooth my skin texture",
    hint: "Bounce-back hydration and smoothness",
    compareWith: "Benefiance",
    compareHint: "Texture vs. wrinkle focus",
  },
  essentials: {
    name: "Essentials",
    test: /\bessentials?\b/i,
    goal: "hydration",
    goalLabel: "everyday",
    outcome: "Build a simple everyday routine",
    ask: "build a simple everyday routine",
    hint: "Cleanse, soften and moisturize",
    compareWith: "Essential Energy",
    compareHint: "Basics vs. energising hydration",
  },
  "essential-energy": {
    name: "Essential Energy",
    test: /\bessential\s*energy\b/i,
    goal: "hydration",
    goalLabel: "hydrating",
    outcome: "Re-energise dull, dehydrated skin",
    ask: "re-energise dull, dehydrated skin",
    hint: "Lightweight, bouncy hydration",
    compareWith: "Essentials",
    compareHint: "Energising vs. everyday basics",
  },
  eudermine: {
    name: "Eudermine",
    test: /\beudermin\w*/i,
    goal: "hydration",
    goalLabel: "hydrating",
    outcome: "Prep skin to absorb more",
    ask: "prep my skin so it absorbs more",
    hint: "The softener that boosts every next step",
    compareWith: "Ultimune",
    compareHint: "Prep step vs. power serum",
  },
  "urban-environment": {
    name: "Urban Environment",
    test: /\burban\s*environ\w*|\burban\b/i,
    goal: "sun",
    goalLabel: "daily SPF",
    outcome: "Everyday SPF for city life",
    ask: "protect my skin every day with sunscreen",
    hint: "Oil-free daily protection",
    compareWith: "Ultimate Sun",
    compareHint: "Daily wear vs. outdoor-strength",
  },
  "ultimate-sun": {
    name: "Ultimate Sun",
    test: /\bultimate\s*sun\b|\bwet\s*force\b/i,
    goal: "sun",
    goalLabel: "sun protection",
    outcome: "Sun protection that lasts all day",
    ask: "find sun protection that lasts all day",
    hint: "Water- and sweat-resistant SPF",
    compareWith: "Urban Environment",
    compareHint: "Outdoor-strength vs. daily wear",
  },
  "shiseido-men": {
    name: "Shiseido Men",
    test: /\bshiseido\s*men\b/i,
    goal: "mens",
    goalLabel: "men's",
    outcome: "A no-fuss routine for men",
    ask: "keep a simple men's routine",
    hint: "Two or three steps that actually get used",
    compareWith: "Essentials",
    compareHint: "Men's line vs. everyday basics",
  },
};

const GOAL_KEYWORD: Record<string, string> = {
  "anti-aging": "anti-aging",
  brightening: "brightening",
  hydration: "hydrating",
  "pore-control": "oily skin",
  sun: "sunscreen",
  mens: "men's",
};

function collectionGoals(key: string, m: Modifiers, typedDirectly: boolean): Template[] {
  const c = COLLECTIONS[key];
  if (!c) return [];
  const keyword = GOAL_KEYWORD[c.goal] ?? c.goalLabel;
  return [
    {
      id: `collection-${key}-goal`,
      kind: "concern",
      label: c.outcome,
      hint: c.hint,
      prompt: `Help me ${c.ask}. Which ${c.name}${c.goal === "mens" ? "" : ` ${keyword}`} products${budgetSuffix(m)} should I start with?`,
      goal: c.goal,
    },
    {
      id: `collection-${key}-routine`,
      kind: "routine",
      label: `Build a full routine around ${c.name}`,
      hint: "What to pair it with, in the right order",
      prompt: withBudget(
        `Help me build a complete ${keyword} routine around ${c.name}, with the steps in the right order`.replace(
          /\ba ([aeiou])/i,
          "an $1",
        ),
        m,
      ),
      goal: c.goal,
    },
    ...(typedDirectly
      ? [
          {
            id: `collection-${key}-compare`,
            kind: "compare" as const,
            label: `${c.name} vs ${c.compareWith}: which suits me?`,
            hint: c.compareHint,
            prompt: `Compare ${c.name} vs ${c.compareWith} and help me decide which suits my skin`,
            goal: c.goal,
          },
        ]
      : []),
  ];
}

/* ---------- 4. Categories ---------- */

const CATEGORIES: Array<{ id: string; test: RegExp; noun: string }> = [
  { id: "eye", test: /\beye\s*(cream|care|serum|gel)\b/i, noun: "eye cream" },
  { id: "serum", test: /\bserums?\b|\bconcentrate\b|\bampoule\b|\btreatment\b/i, noun: "serum" },
  { id: "moisturizer", test: /\bmoisturi[sz]\w*|\bcreams?\b|\blotion\b|\bemulsion\b/i, noun: "moisturizer" },
  { id: "cleanser", test: /\bcleans\w*|\bface\s*wash\b|\bmake[-\s]?up\s*remover\b|\bfoam\b/i, noun: "cleanser" },
  { id: "softener", test: /\bsoftener\b|\btoner\b|\bessence\b/i, noun: "softener" },
  { id: "mask", test: /\bmasks?\b|\bsheet\s*mask\b/i, noun: "mask" },
];

function categoryGoals(id: string, noun: string, m: Modifiers): Template[] {
  return [
    {
      id: `category-${id}-match`,
      kind: "discover",
      label: `Find the ${noun} that suits your skin`,
      hint: "Matched to your skin type and goal",
      prompt: withBudget(`Help me choose the right ${noun} for my skin`, m),
    },
    {
      id: `category-${id}-compare`,
      kind: "compare",
      label: `Compare best-selling ${noun}s`,
      hint: "Side by side, with who each one is for",
      prompt: `Compare your best-selling ${noun}s${budgetSuffix(m)} and help me decide`,
    },
  ];
}

/* ---------- 5. Mining matched products ---------- */

const BENEFIT_GOALS: Array<{ goal: string; test: RegExp }> = [
  { goal: "anti-aging", test: /wrinkl|fine line|firm|lift|sagg|elastic|aging|ageing|youth/gi },
  { goal: "brightening", test: /dark spot|bright|radian|dull|even tone|pigment|glow/gi },
  { goal: "hydration", test: /hydrat|moistur|dry|plump|dewy/gi },
  { goal: "sun", test: /\bspf\b|\buv\b|sun/gi },
  { goal: "pore-control", test: /pore|oil|shine|matte|sebum/gi },
];

function minedGoal(products: ReadonlyArray<CatalogProduct>): string | null {
  const counts = new Map<string, number>();
  for (const p of products.slice(0, 3)) {
    const text = [p.shortDescription, ...(p.keyBenefits ?? [])].join(" ").toLowerCase();
    for (const { goal, test } of BENEFIT_GOALS) {
      const hits = text.match(test)?.length ?? 0;
      if (hits) counts.set(goal, (counts.get(goal) ?? 0) + hits);
    }
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [goal, count] of counts) {
    if (count > bestCount) {
      best = goal;
      bestCount = count;
    }
  }
  return best;
}

const MINED_TEMPLATES: Record<string, Template> = {
  "anti-aging": {
    id: "mined-anti-aging",
    kind: "concern",
    label: "Build an anti-aging routine",
    hint: "Serum-led, matched to your skin",
    prompt: "Help me build an anti-aging routine",
    goal: "anti-aging",
  },
  brightening: {
    id: "mined-brightening",
    kind: "concern",
    label: "Fade dark spots and boost glow",
    hint: "Brightening steps that work together",
    prompt: "Help me fade dark spots and boost glow with a brightening routine",
    goal: "brightening",
  },
  hydration: {
    id: "mined-hydration",
    kind: "concern",
    label: "Deep hydration that lasts all day",
    hint: "Layered moisture, no heaviness",
    prompt: "Help me build a hydrating routine for all-day moisture",
    goal: "hydration",
  },
  sun: {
    id: "mined-sun",
    kind: "concern",
    label: "Find the right SPF for your day",
    hint: "Daily wear or outdoor-strength",
    prompt: "Help me choose the right sunscreen for my day",
    goal: "sun",
  },
  "pore-control": {
    id: "mined-pores",
    kind: "concern",
    label: "Control oil and refine pores",
    hint: "Balanced, matte skin without stripping",
    prompt: "Help me control oily skin and refine pores",
    goal: "pore-control",
  },
};

/* ---------- 6. Fallbacks ---------- */

const FALLBACKS: Template[] = [
  {
    id: "fallback-routine",
    kind: "routine",
    label: "Build a routine for my skin",
    hint: "Tell the advisor your skin, get a plan",
    prompt: "Help me build a skincare routine for my skin",
  },
  {
    id: "fallback-match",
    kind: "discover",
    label: "Find my best-match products",
    hint: "A short quiz, then picks with reasons",
    prompt: "Help me find the best Shiseido products for my skin type and goals",
  },
  {
    id: "fallback-bestsellers",
    kind: "compare",
    label: "See what's best-selling and why",
    hint: "The cult favourites, explained",
    prompt: "Help me choose from your best sellers and explain who each is for",
  },
];

/* ---------- Assembly ---------- */

function seriesOf(p: CatalogProduct): string | null {
  return p.series ? String(p.series) : null;
}

/**
 * Build up to `MAX_GOALS` advisor goals for a query. Always returns at
 * least one goal for a non-empty query (fallbacks cover the rest).
 */
export function buildGoals(
  rawQuery: string,
  matchedProducts: ReadonlyArray<CatalogProduct>,
): AssistantGoal[] {
  const q = rawQuery.trim();
  if (!q) return [];
  const m = readModifiers(q);
  const candidates: AssistantGoal[] = [];
  const add = (templates: Template[], base: number) => {
    templates.forEach((t, i) => candidates.push({ ...t, score: base - i * 2, source: "rule" }));
  };

  // 1. Situations + gifts (life context is the strongest intent signal).
  const isGift = GIFT_TEST.test(q);
  if (isGift) add(giftGoals(q, m), 100);
  for (const s of SITUATIONS) if (s.test.test(q)) add(s.goals(m), 90);

  // 2. Concerns typed directly.
  const concernGoals = new Set<string>();
  for (const c of CONCERNS) {
    if (c.test.test(q)) {
      concernGoals.add(c.goal);
      add(c.templates(m), 80);
      if (c.topic) add(concernFollowOns(c.id, c.topic, m), 58);
    }
  }

  // 3. Collections named directly.
  const typedCollections = Object.keys(COLLECTIONS).filter((k) => COLLECTIONS[k].test.test(q));
  // "essential energy" also matches "essentials"; keep the more specific one.
  const collections = typedCollections.includes("essential-energy")
    ? typedCollections.filter((k) => k !== "essentials")
    : typedCollections;
  for (const k of collections) add(collectionGoals(k, m, true), 75);

  // 4. Categories named directly.
  // (first match only: "eye cream" is eye care, not a moisturizer)
  const category = CATEGORIES.find((c) => c.test.test(q));
  if (category) add(categoryGoals(category.id, category.noun, m), 60);

  // 5. Matched products: dominant collection + goal mined from benefit
  //    copy. Only when the shopper didn't already tell us their context
  //    (a typed situation beats whatever products happen to match), and
  //    for typed concerns only if the collection serves that concern.
  const typedSituation = isGift || SITUATIONS.some((s) => s.test.test(q));
  if (matchedProducts.length > 0 && !typedSituation) {
    const counts = new Map<string, number>();
    for (const p of matchedProducts.slice(0, 5)) {
      const s = seriesOf(p);
      if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const info = dominant ? COLLECTIONS[dominant] : undefined;
    if (dominant && info && !collections.includes(dominant)) {
      if (concernGoals.size === 0) {
        add(collectionGoals(dominant, m, false), 55);
      } else if (concernGoals.has(info.goal)) {
        // Concern already covers the "goal" row; offer the routine.
        add(collectionGoals(dominant, m, false).slice(1), 55);
      }
    }
    const mined = minedGoal(matchedProducts);
    if (mined && MINED_TEMPLATES[mined] && concernGoals.size === 0) {
      add([{ ...MINED_TEMPLATES[mined], prompt: withBudget(MINED_TEMPLATES[mined].prompt, m) }], 50);
    }
  }

  // 6. Fallbacks, always available at the bottom of the pile.
  add(
    FALLBACKS.map((f) => ({ ...f, prompt: withBudget(f.prompt, m) })),
    FALLBACK_SCORE,
  );

  // Pick: highest score first, one per id, prefer distinct kinds and
  // distinct advisor goals so the 3 rows feel like 3 different doors.
  candidates.sort((a, b) => b.score - a.score);
  const picked: AssistantGoal[] = [];
  const seenIds = new Set<string>();
  const seenLabels = new Set<string>();
  const qLower = q.toLowerCase();
  const accept = (c: AssistantGoal) => {
    const label = c.label.toLowerCase();
    if (seenIds.has(c.id) || seenLabels.has(label) || label === qLower) return false;
    // Only gift prompts may ask for sets; everything else must avoid the
    // advisor's bundle-deals branch.
    if (c.kind !== "gift" && isBundleTrippingPhrase(c.prompt)) return false;
    seenIds.add(c.id);
    seenLabels.add(label);
    picked.push(c);
    return true;
  };
  // Pass 1: one per kind, so the rows feel like different doors
  // (e.g. a goal, a routine, a comparison).
  const kinds = new Set<GoalKind>();
  for (const c of candidates) {
    if (picked.length >= MAX_GOALS) break;
    if (kinds.has(c.kind)) continue;
    if (c.score <= FALLBACK_SCORE && picked.length > 0) continue;
    if (accept(c)) kinds.add(c.kind);
  }
  // Pass 2: any remaining real signal before generic fallbacks.
  for (const c of candidates) {
    if (picked.length >= MAX_GOALS) break;
    if (c.score > FALLBACK_SCORE) accept(c);
  }
  // Pass 3: fallbacks fill whatever is left.
  for (const c of candidates) {
    if (picked.length >= MAX_GOALS) break;
    accept(c);
  }
  // Keep the strongest signal on top.
  return picked.sort((a, b) => b.score - a.score);
}
