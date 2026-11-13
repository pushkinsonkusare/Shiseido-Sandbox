/* =============================================================
 * Targeted PLP explainers: one shelf for one skin profile.
 *
 * Shown when a search or the filters narrow a shelf to a skin type
 * ("cleansers for oily skin", Serums + Skin type: Dry). The copy is
 * drawn from Shiseido's Skincare Blog. It has no dedicated sensitive
 * or combination article, so those guides lean on what the dry-skin,
 * oily-skin, moisturizer and sunscreen articles say about them.
 * ============================================================= */

import type { PlpExplainer, SkinProfile } from "./plpExplainers";

const OILY_SRC = { label: "How to care for oily skin", slug: "how-to-care-for-oily-skin" };
const DRY_SRC = { label: "Why is my skin so dry?", slug: "why-is-my-skin-so-dry" };
const MOIST_SRC = { label: "Choosing a moisturizer for your skin type", slug: "moisturizer-guide" };
const SUN_SRC = { label: "Mineral vs. chemical sunscreen", slug: "mineral-vs-chemical-sunscreen" };
const AGING_SRC = { label: "Anti-aging skincare", slug: "anti-aging-skincare" };
const TIGHT_SRC = { label: "How to tighten skin", slug: "how-to-tighten-skin" };
const JBEAUTY_SRC = { label: "The Japanese skincare routine", slug: "japanese-skincare-routine" };

/** Keyed `${shelfId}:${profile}`; shelf ids match the base explainers. */
export const TARGETED: Partial<Record<string, PlpExplainer>> = {
  /* ---------------- Cleansers ---------------- */
  "cleansers:oily": {
    id: "cleansers-oily",
    title: "Clear the oil, keep the balance",
    body:
      "A foaming, oil-free cleanser lifts excess sebum without leaving skin tight, which only prompts it to make more. Cleanse morning and night, after workouts, and never sleep in makeup.",
    source: OILY_SRC,
    pills: [
      { label: "Control shine", prompt: "I have oily skin. Help me find a cleanser that controls shine without drying me out." },
      { label: "Help with breakouts", prompt: "My oily skin breaks out. Which cleanser should I use?" },
      { label: "Minimize pores", prompt: "Help me find a cleanser for oily skin that keeps pores looking clear." },
    ],
  },
  "cleansers:dry": {
    id: "cleansers-dry",
    title: "Cleanse without the tight feeling",
    body:
      "Bar soap and harsh foams strip the oils dry skin is short on. A milky or water-based cleanser removes the day and leaves skin soft, ready for a hydrating softener.",
    source: DRY_SRC,
    pills: [
      { label: "Gentle daily cleanser", prompt: "I have dry skin. Help me find a gentle cleanser that won't leave it tight." },
      { label: "Take off makeup gently", prompt: "Help me remove makeup without drying out my skin." },
      { label: "Build a hydrating routine", prompt: "Build me a hydrating routine for dry skin, starting with the cleanser." },
    ],
  },
  "cleansers:sensitive": {
    id: "cleansers-sensitive",
    title: "Gentle is the whole point",
    body:
      "Reactive skin does best with a mild, fragrance-free cleanser and lukewarm water. Skip harsh exfoliants and strong acids at this step; let the rest of the routine do the work.",
    source: DRY_SRC,
    pills: [
      { label: "Fragrance-free options", prompt: "I have sensitive skin. Show me gentle, fragrance-free cleansers." },
      { label: "Calm redness", prompt: "My skin gets red easily. Which cleanser won't irritate it?" },
      { label: "Remove makeup gently", prompt: "Help me take off makeup on sensitive skin without irritation." },
    ],
  },
  "cleansers:combination": {
    id: "cleansers-combination",
    title: "One cleanser for two kinds of skin",
    body:
      "An oily T-zone and drier cheeks both want a cleanser that clears oil without stripping. A light foam suits most combination skin; on dry days, a creamier one keeps the cheeks comfortable.",
    source: OILY_SRC,
    pills: [
      { label: "Balance my T-zone", prompt: "I have combination skin with an oily T-zone. Help me find a balancing cleanser." },
      { label: "Not too drying", prompt: "Help me find a cleanser for combination skin that won't dry out my cheeks." },
      { label: "Build my routine", prompt: "Build me a simple routine for combination skin." },
    ],
  },
  "cleansers:mature": {
    id: "cleansers-mature",
    title: "The first step of a firming routine",
    body:
      "As skin produces less oil with age, a creamy cleanser that respects its barrier matters more. Clean skin lets the serums and creams that follow lift and firm the way they should.",
    source: AGING_SRC,
    pills: [
      { label: "Creamy, gentle cleanse", prompt: "I have mature skin. Help me find a gentle, creamy cleanser." },
      { label: "Full anti-aging routine", prompt: "Build me a full anti-aging routine, starting with the cleanser." },
      { label: "Remove makeup gently", prompt: "Help me remove makeup gently on mature skin." },
    ],
  },

  /* ---------------- Softeners ---------------- */
  "softeners:oily": {
    id: "softeners-oily",
    title: "Hydration that stays weightless",
    body:
      "Oily skin still needs water, just not oil. A regular, refreshing softener hydrates and preps skin so a lighter moisturizer is all it needs after. Sweep it on with a cotton pad.",
    source: JBEAUTY_SRC,
    pills: [
      { label: "Lightweight softener", prompt: "I have oily skin. Help me find a lightweight softener." },
      { label: "Do I need one?", prompt: "Do I need a softener if my skin is oily?" },
      { label: "Help with pores", prompt: "Help me find a softener for oily skin that refines pores." },
    ],
  },
  "softeners:dry": {
    id: "softeners-dry",
    title: "The first drink of water after cleansing",
    body:
      "An enriched softener floods dry skin with hydration right after cleansing, so the serum and cream that follow sink in instead of sitting on top.",
    source: DRY_SRC,
    pills: [
      { label: "Enriched softener", prompt: "I have dry skin. Help me find an enriched softener." },
      { label: "How do I apply it?", prompt: "How should I apply a softener on dry skin, and when?" },
      { label: "Build a hydrating routine", prompt: "Build me a hydrating routine for dry skin." },
    ],
  },
  "softeners:sensitive": {
    id: "softeners-sensitive",
    title: "Soothe first, then treat",
    body:
      "Skip alcohol-heavy toners on reactive skin. A gentle softener hydrates and calms, and pressing it in with your palms is kinder than rubbing with a pad.",
    source: DRY_SRC,
    pills: [
      { label: "Alcohol-free options", prompt: "I have sensitive skin. Show me gentle softeners without alcohol." },
      { label: "Calm redness", prompt: "Which softener will calm redness on sensitive skin?" },
      { label: "Is it safe for me?", prompt: "Is a softener safe for very sensitive skin? What should I look for?" },
    ],
  },
  "softeners:combination": {
    id: "softeners-combination",
    title: "Even out the T-zone and cheeks",
    body:
      "A regular softener suits combination skin best: enough hydration for drier cheeks, light enough for the T-zone. Apply it right after cleansing, morning and night.",
    source: JBEAUTY_SRC,
    pills: [
      { label: "Regular or enriched?", prompt: "I have combination skin. Should I use a regular or enriched softener?" },
      { label: "Balance my skin", prompt: "Help me find a softener that balances combination skin." },
      { label: "Build my routine", prompt: "Build me a routine for combination skin." },
    ],
  },
  "softeners:mature": {
    id: "softeners-mature",
    title: "Prep skin to take in more",
    body:
      "Mature skin holds less water. An enriched, firming softener restores it and helps the serums that follow absorb, which is where the lifting work happens.",
    source: AGING_SRC,
    pills: [
      { label: "Firming softener", prompt: "I have mature skin. Help me find a firming softener." },
      { label: "Where does it go?", prompt: "Where does a softener go in an anti-aging routine?" },
      { label: "Full anti-aging routine", prompt: "Build me a full anti-aging routine." },
    ],
  },

  /* ---------------- Serums ---------------- */
  "serums:oily": {
    id: "serums-oily",
    title: "Treat without the weight",
    body:
      "Oily skin gets the most from light, fast-absorbing serums in oil-free textures. Look for ones that refine pores and even tone, and follow with a gel moisturizer rather than a rich cream.",
    source: OILY_SRC,
    pills: [
      { label: "Lightweight serum", prompt: "I have oily skin. Help me find a lightweight serum." },
      { label: "Refine pores", prompt: "Help me find a serum for oily skin that refines pores." },
      { label: "Fade post-breakout marks", prompt: "Help me find a serum to fade dark marks on oily skin." },
    ],
  },
  "serums:dry": {
    id: "serums-dry",
    title: "Hydration that goes deeper than cream",
    body:
      "A serum with hyaluronic acid draws water into dry skin where a cream alone can't reach. Layer it after your softener and seal it in with a richer moisturizer.",
    source: DRY_SRC,
    pills: [
      { label: "Deeply hydrating serum", prompt: "I have dry skin. Help me find a deeply hydrating serum." },
      { label: "Smooth dry lines", prompt: "Help me find a serum that smooths fine lines on dry skin." },
      { label: "Layer with my cream", prompt: "How do I layer a serum with a moisturizer on dry skin?" },
    ],
  },
  "serums:sensitive": {
    id: "serums-sensitive",
    title: "Strengthen before you correct",
    body:
      "Strong acids and harsh actives can tip sensitive skin over. Start with a strengthening serum that supports the skin's own defenses, and add targeted treatments slowly.",
    source: DRY_SRC,
    pills: [
      { label: "Strengthening serum", prompt: "I have sensitive skin. Help me find a serum that strengthens it." },
      { label: "Gentle anti-aging", prompt: "Help me find a gentle anti-aging serum for sensitive skin." },
      { label: "What should I avoid?", prompt: "What ingredients should I avoid in a serum for sensitive skin?" },
    ],
  },
  "serums:combination": {
    id: "serums-combination",
    title: "One serum, two needs",
    body:
      "Combination skin does well with a light, hydrating serum all over. Pick it by your main concern, then adjust the moisturizer instead: lighter on the T-zone, richer on the cheeks.",
    source: JBEAUTY_SRC,
    pills: [
      { label: "Lightweight hydration", prompt: "I have combination skin. Help me find a light, hydrating serum." },
      { label: "Even my tone", prompt: "Help me find a serum to even tone on combination skin." },
      { label: "Build my routine", prompt: "Build me a routine for combination skin." },
    ],
  },
  "serums:mature": {
    id: "serums-mature",
    title: "Where lifting and firming happen",
    body:
      "Retinoids, peptides and antioxidants each answer a different sign of aging, and serums carry them in their most concentrated form. Smooth it on the face and neck with upward strokes, then moisturize.",
    source: TIGHT_SRC,
    pills: [
      { label: "Firm and lift", prompt: "My skin is losing firmness. Help me find a lifting serum." },
      { label: "Smooth wrinkles", prompt: "Help me find a serum that smooths deep wrinkles." },
      { label: "Fade age spots", prompt: "Help me find a serum to fade age spots." },
      { label: "Retinol or not?", prompt: "Should I use a retinol serum on mature skin? How do I start?" },
    ],
  },

  /* ---------------- Moisturizers ---------------- */
  "moisturizers:oily": {
    id: "moisturizers-oily",
    title: "Skipping moisturizer makes oily skin oilier",
    body:
      "Dehydrated skin compensates with more oil. A lightweight, oil-free gel cream keeps it balanced without shine; in the morning, one with SPF saves a step.",
    source: MOIST_SRC,
    pills: [
      { label: "Oil-free gel cream", prompt: "I have oily skin. Help me find a lightweight, oil-free moisturizer." },
      { label: "Matte finish", prompt: "Help me find a moisturizer for oily skin that keeps me matte." },
      { label: "With SPF", prompt: "Help me find a moisturizer with SPF for oily skin." },
    ],
  },
  "moisturizers:dry": {
    id: "moisturizers-dry",
    title: "Richer textures, longer comfort",
    body:
      "Dry skin needs a cream that both hydrates and seals, ideally with hyaluronic acid. Apply it while skin is still damp from your softener, and reach for an overnight cream when it's really parched.",
    source: MOIST_SRC,
    pills: [
      { label: "Rich, nourishing cream", prompt: "I have dry skin. Help me find a rich, nourishing moisturizer." },
      { label: "All-day hydration", prompt: "Help me find a moisturizer that keeps dry skin hydrated all day." },
      { label: "Overnight repair", prompt: "Help me find an overnight cream for very dry skin." },
    ],
  },
  "moisturizers:sensitive": {
    id: "moisturizers-sensitive",
    title: "Comfort comes first",
    body:
      "Soothing ingredients such as ginseng, yuzu and peony calm reactive skin while it's moisturized. Keep the formula simple and fragrance-light, and patch-test anything new.",
    source: MOIST_SRC,
    pills: [
      { label: "Soothing moisturizer", prompt: "I have sensitive skin. Help me find a soothing moisturizer." },
      { label: "Calm redness", prompt: "Help me find a moisturizer that calms redness." },
      { label: "Fragrance-free", prompt: "Show me fragrance-free moisturizers for sensitive skin." },
    ],
  },
  "moisturizers:combination": {
    id: "moisturizers-combination",
    title: "Light where it's oily, more where it's dry",
    body:
      "Most combination skin is happiest with a light cream all over. If the cheeks still feel tight, press a little extra there instead of switching to something heavy everywhere.",
    source: MOIST_SRC,
    pills: [
      { label: "Lightweight cream", prompt: "I have combination skin. Help me find a lightweight moisturizer." },
      { label: "Not greasy on my T-zone", prompt: "Help me find a moisturizer that won't make my T-zone greasy." },
      { label: "Day and night", prompt: "Do I need different day and night moisturizers for combination skin?" },
    ],
  },
  "moisturizers:mature": {
    id: "moisturizers-mature",
    title: "Lighter by day, richer by night",
    body:
      "Mature skin benefits from a renewing day cream with SPF and a more concentrated cream at night, when skin repairs itself. Don't stop at the jaw: the neck shows age too.",
    source: AGING_SRC,
    pills: [
      { label: "Firming day cream", prompt: "I have mature skin. Help me find a firming day cream with SPF." },
      { label: "Rich night cream", prompt: "Help me find a rich night cream for mature skin." },
      { label: "Lift the neck too", prompt: "Help me find a cream that firms the face and neck." },
    ],
  },

  /* ---------------- Sunscreen ---------------- */
  "sunscreen:oily": {
    id: "sunscreen-oily",
    title: "Protection that won't add shine",
    body:
      "Look for a lightweight, oil-free SPF that dries down matte. Chemical and hybrid formulas tend to feel lightest on oily skin; reapply every two hours outdoors.",
    source: OILY_SRC,
    pills: [
      { label: "Oil-free and matte", prompt: "I have oily skin. Help me find an oil-free, matte sunscreen." },
      { label: "Under makeup", prompt: "Help me find a sunscreen for oily skin that works under makeup." },
      { label: "Won't cause breakouts", prompt: "Which sunscreen won't clog pores on oily skin?" },
    ],
  },
  "sunscreen:dry": {
    id: "sunscreen-dry",
    title: "SPF that moisturizes as it protects",
    body:
      "Dry skin needs sunscreen every day, indoors and under cloud. A moisturizing SPF or a day cream with SPF covers both steps without the chalky, tight finish.",
    source: DRY_SRC,
    pills: [
      { label: "Moisturizing SPF", prompt: "I have dry skin. Help me find a moisturizing sunscreen." },
      { label: "Day cream with SPF", prompt: "Help me find a day cream with SPF for dry skin." },
      { label: "Under makeup", prompt: "Help me find a sunscreen for dry skin that works under makeup." },
    ],
  },
  "sunscreen:sensitive": {
    id: "sunscreen-sensitive",
    title: "Mineral filters are kindest",
    body:
      "Zinc oxide and titanium dioxide sit on top of skin and reflect UV, so they rarely irritate and work the moment they're on. Today's formulas are far less chalky than they used to be.",
    source: SUN_SRC,
    pills: [
      { label: "Mineral sunscreen", prompt: "I have sensitive skin. Help me find a mineral sunscreen." },
      { label: "Mineral or chemical?", prompt: "Should I use mineral or chemical sunscreen on sensitive skin?" },
      { label: "No white cast", prompt: "Help me find a mineral sunscreen that won't leave a white cast." },
    ],
  },
  "sunscreen:combination": {
    id: "sunscreen-combination",
    title: "Light enough for the T-zone",
    body:
      "A lightweight, oil-free SPF suits combination skin: it won't add shine where you're oily or feel heavy where you're dry. A hybrid formula gives you the best of both filter types.",
    source: SUN_SRC,
    pills: [
      { label: "Lightweight SPF", prompt: "I have combination skin. Help me find a lightweight sunscreen." },
      { label: "Under makeup", prompt: "Help me find a sunscreen for combination skin that works under makeup." },
      { label: "Mineral or chemical?", prompt: "Mineral or chemical sunscreen for combination skin?" },
    ],
  },
  "sunscreen:mature": {
    id: "sunscreen-mature",
    title: "The anti-aging step that matters most",
    body:
      "UV breaks down the collagen that keeps skin firm and causes most visible aging. Without daily broad-spectrum SPF, a morning anti-aging routine is incomplete.",
    source: AGING_SRC,
    pills: [
      { label: "Anti-aging SPF", prompt: "I have mature skin. Help me find a sunscreen with anti-aging benefits." },
      { label: "Day cream with SPF", prompt: "Help me find a firming day cream with SPF." },
      { label: "Fade sun spots", prompt: "Help me prevent and fade sun spots." },
    ],
  },
};

/** For searches that name a skin profile but no shelf ("oily skin"). */
export const SKIN_GUIDES: Partial<Record<SkinProfile, PlpExplainer>> = {
  oily: {
    id: "skin-oily",
    title: "Balance, not stripping",
    body:
      "Oily skin is overactive sebaceous glands, shaped by hormones, genetics and climate. Oil-free, non-comedogenic textures, a light moisturizer and daily SPF keep it balanced; harsh, drying products backfire.",
    source: OILY_SRC,
    pills: [
      { label: "Build my oily-skin routine", prompt: "I have oily skin. Build me a complete routine." },
      { label: "Control shine", prompt: "Help me control shine through the day." },
      { label: "Help with breakouts", prompt: "My oily skin breaks out. What should I use?" },
      { label: "Minimize pores", prompt: "Help me make my pores look smaller." },
    ],
  },
  dry: {
    id: "skin-dry",
    title: "Put back what the day takes out",
    body:
      "Weather, hot showers, hard water and harsh soap all pull moisture from skin. A milky cleanser, an enriched softener and a hyaluronic acid cream restore it, and daily SPF protects it.",
    source: DRY_SRC,
    pills: [
      { label: "Build my dry-skin routine", prompt: "I have dry skin. Build me a complete hydrating routine." },
      { label: "Why is my skin so dry?", prompt: "Why is my skin so dry, and what can I do about it?" },
      { label: "Overnight repair", prompt: "Help me find something to repair very dry skin overnight." },
    ],
  },
  sensitive: {
    id: "skin-sensitive",
    title: "Fewer, gentler, steadier",
    body:
      "Reactive skin does best with a short routine of mild, fragrance-light products, soothing ingredients and mineral sunscreen. Introduce one new product at a time so you know what agrees with you.",
    source: MOIST_SRC,
    pills: [
      { label: "Build a gentle routine", prompt: "I have sensitive skin. Build me a gentle routine." },
      { label: "Calm redness", prompt: "My skin gets red and irritated. What can help?" },
      { label: "Mineral sunscreen", prompt: "Help me find a mineral sunscreen for sensitive skin." },
    ],
  },
  combination: {
    id: "skin-combination",
    title: "Two skin types, one routine",
    body:
      "An oily T-zone with normal or dry cheeks is the most common skin there is. Gentle cleansing, a regular softener and a light moisturizer suit most of it; adjust only where you need to.",
    source: JBEAUTY_SRC,
    pills: [
      { label: "Build my routine", prompt: "I have combination skin. Build me a complete routine." },
      { label: "Balance my T-zone", prompt: "Help me control my oily T-zone without drying my cheeks." },
      { label: "Is my skin combination?", prompt: "How do I know if I have combination skin?" },
    ],
  },
  mature: {
    id: "skin-mature",
    title: "Firmness, lift and light",
    body:
      "Collagen and elastin slow with age, sun and pollution. A routine built on retinoids, peptides and antioxidants, layered thinnest to richest and finished with SPF, keeps skin looking firm and lifted.",
    source: AGING_SRC,
    pills: [
      { label: "Build my anti-aging routine", prompt: "Build me a complete anti-aging routine." },
      { label: "Firm and lift", prompt: "My skin is losing firmness. What will help it lift?" },
      { label: "Smooth wrinkles", prompt: "Help me smooth wrinkles and fine lines." },
      { label: "Fade age spots", prompt: "Help me fade age spots and even my tone." },
    ],
  },
};
