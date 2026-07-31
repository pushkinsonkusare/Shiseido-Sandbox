/* =============================================================
 * Input guardrails.
 *
 * `classifyIntent` only recognises positive shopping signals, so
 * anything it doesn't understand (an off-catalog request, a medical
 * question, a keyboard mash) falls through to the same probing
 * fallback: "Got it. Could you tell me a bit more…". That reads as
 * comprehension, which is wrong for all three and unsafe for the
 * medical case.
 *
 * These lanes run BEFORE intent classification and short-circuit the
 * turn with copy that matches what the shopper actually typed. They
 * are deliberately vocabulary-driven rather than clever: a false
 * positive (refusing a real skincare question) is far more damaging
 * than a false negative, so every lane suppresses itself when the
 * message carries beauty vocabulary.
 * ============================================================= */

export type GuardrailKind =
  | "crisis"
  | "medical"
  | "off_domain"
  | "unintelligible";

/**
 * Beauty / store vocabulary. Any hit suppresses the off-domain and
 * unintelligible lanes, so a genuine skincare question is never
 * refused because it also mentioned, say, a car ride. Deliberately
 * wider than `CATEGORY_PATTERNS` in `flow.ts`: it covers concerns,
 * routine language and order hygiene, not just product families.
 */
const BEAUTY_VOCAB =
  /\b(skin|skincare|face|facial|complexion|routine|regimen|cleanser|cleansing|wash|softener|toner|essence|serum|treatment|concentrate|ampoule|moisturi[sz]er|cream|emulsion|lotion|oil|mask|eye|lip|sunscreen|sunblock|spf|sun|uv|balm|exfoliat\w*|peel|pore|acne|blemish|wrinkle|fine\s*lines?|aging|ageing|anti[-\s]?age\w*|firm\w*|lift\w*|sag\w*|bright\w*|dull\w*|dark\s*spots?|pigment\w*|hydrat\w*|dry|oily|combination|sensitive|redness|glow|radiance|collagen|retinol|vitamin\s*c|hyaluronic|niacinamide|peptide|ceramide|fragrance|shiseido|ultimune|benefiance|eudermine|bio[-\s]?performance|vital\s*perfection|future\s*solution|product|products|price|cheaper|budget|bundle|set|kit|gift|cart|checkout|order|delivery|shipping|return|refund|promo|coupon|discount)\b/i;

/**
 * Crisis language. Handled ahead of every other lane and answered
 * without shopping suggestions.
 */
const CRISIS =
  /\b(kill\s+myself|killing\s+myself|suicid\w+|end\s+my\s+life|take\s+my\s+own\s+life|self[-\s]?harm|harm\s+myself|hurt\s+myself|want\s+to\s+die)\b/i;

/**
 * Acute injury / reaction. Conditions on their own (eczema, rosacea)
 * are NOT listed: shoppers legitimately shop for them, and refusing
 * "gentle products for rosacea" would break a real use case. Only
 * something acute, or explicit treatment-seeking below, routes to the
 * medical lane.
 */
const ACUTE_INJURY =
  /\b(chemical\s+burn|burn(ed|ing|s)?\s+(my|the)\s+(face|skin)|(skin|face)\s+(is\s+)?(burn\w*|sting\w*)|burnt|blister\w*|bleeding|open\s+wound|infect(ed|ion)|allergic\s+reaction|anaphyla\w+|hives|swollen|swelling|rash|scab\w*|pus\b|oozing|second[-\s]degree)\b/i;

/** Explicit requests for diagnosis, medication or a cure. */
const MEDICAL_HELP =
  /\b(prescri\w+|medication|medicine|antibiotic\w*|steroid\w*|dosage|overdose|cure\s+(my|this)|diagnos\w+|cancer\w*|melanoma|tretinoin|accutane|isotretinoin|treat\s+(my|this)\s+\w*\s*(eczema|psoriasis|dermatitis|rosacea|infection|burn|wound))\b/i;

/**
 * Off-catalog topics. An explicit list, not a heuristic: the cost of
 * wrongly refusing a skincare question outweighs missing an exotic
 * off-topic one, and the long tail still lands on the probing card.
 */
const OFF_DOMAIN =
  /\b(guns?|rifles?|pistols?|firearms?|shotguns?|ammo|ammunition|bullets?|weapons?|grenade\w*|explosives?|knives|cocaine|heroin|meth|marijuana|weed|cigarettes?|vape\w*|beer|wine|vodka|whisk(e)?y|pizza|burgers?|sushi|groceries|restaurants?|cars?|trucks?|motorcycles?|tyres?|tires?|laptops?|iphones?|smartphones?|televisions?|tvs?|headphones?|playstation|xbox|flights?|hotels?|airbnb|passports?|visas?|bitcoin|crypto\w*|mortgages?|loans?|shoes|sneakers|jeans|shirts?|handbags?|furniture|mattress\w*|lawnmower\w*|plumbers?|lawyers?|homework|essays?|python\s+(code|script)|javascript|elections?|president)\b/i;

/**
 * Keyboard mash / unreadable input. Judged per word so a single odd
 * token in a real sentence can't trip the lane.
 */
function looksLikeMash(token: string): boolean {
  if (token.length < 4) return false;
  // Judge vowels on the letters alone, and only when there are enough of
  // them to mean anything: "spf50" and "50ml" are vowel-less but ordinary.
  const letters = token.replace(/[0-9]/g, "");
  if (letters.length >= 4 && !/[aeiouy]/.test(letters)) return true;
  if (/(.)\1{2,}/.test(token)) return true;
  // Adjacent keyboard rows, the other half of a deliberate mash.
  if (/(qwer|wert|erty|rtyu|asdf|sdfg|dfgh|fghj|zxcv|xcvb|cvbn|uiop|hjkl)/.test(token)) {
    return true;
  }
  // Five consonants in a row. Four is ordinary English ("sunscreen",
  // "workflow"), so the bar sits above it.
  if (/[^aeiouy0-9]{5,}/.test(token)) return true;
  // Letters and digits braided together ("ytdf7y6d7d673dt237d"). One or two
  // switches is ordinary shopping vocabulary ("spf50", "glow20", "50ml"), so
  // only a repeatedly alternating token counts.
  if ((token.match(/[a-z][0-9]|[0-9][a-z]/g) ?? []).length >= 3) return true;
  // Repetitive strings ("ecececec", "eveeveveve") keep their vowels but
  // recycle a tiny alphabet, which real words of this length don't.
  const unique = new Set(token).size;
  return unique / token.length < 0.45;
}

/** Greetings and one-word replies are short but perfectly readable, so
 *  they belong in the normal flow rather than "I didn't catch that". */
const COURTESY = new Set([
  "hi", "hey", "hello", "hiya", "yo", "sup", "hola", "ok", "okay", "k",
  "yes", "yep", "yeah", "no", "nope", "sure", "thx", "ty", "ta", "please",
  "pls", "help", "cool", "nice", "wow", "hmm", "huh", "bye", "why", "how",
  "what", "who", "yay", "lol",
]);

function isUnintelligible(text: string): boolean {
  // Digits stay attached to their token so an alphanumeric mash can be
  // judged as one word; they are dropped only where a bare number is the
  // whole point ("under $60", "10% off").
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter(Boolean);
  // Nothing but symbols ("???", "!!").
  if (tokens.length === 0) return true;
  if (tokens.every((token) => COURTESY.has(token))) return false;
  const wordish = tokens.filter((token) => /[a-z]/.test(token));
  // Pure numbers are a budget, a quantity or an order reference.
  if (wordish.length === 0) return false;
  const longTokens = wordish.filter((token) => token.length >= 4);
  // Nothing long enough to judge on its shape: a stub is only mash when it
  // has no vowel at all ("zz", "hjk"), so real short words survive ("off").
  if (longTokens.length === 0) {
    return wordish.every((token) => !/[aeiou]/.test(token));
  }
  const mashed = longTokens.filter(looksLikeMash).length;
  return mashed / longTokens.length >= 0.6;
}

/**
 * Returns the lane a message belongs to, or `null` to let the normal
 * intent pipeline handle it. Order matters: safety outranks scope,
 * scope outranks readability.
 */
export function classifyGuardrail(text: string): GuardrailKind | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (CRISIS.test(trimmed)) return "crisis";
  if (ACUTE_INJURY.test(trimmed) || MEDICAL_HELP.test(trimmed)) return "medical";

  // Beauty vocabulary means the shopper is on-topic even if the
  // phrasing is unusual, so the remaining lanes stand down.
  if (BEAUTY_VOCAB.test(trimmed)) return null;

  if (OFF_DOMAIN.test(trimmed)) return "off_domain";
  if (isUnintelligible(trimmed)) return "unintelligible";

  return null;
}

export const GUARDRAIL_BODIES: Record<GuardrailKind, string> = {
  crisis:
    "I'm sorry you're going through this, and I'm not the right kind of help for it. Please reach out to your local emergency number or a crisis line now, they can support you properly.",
  medical:
    "I can't give medical advice. If your skin is burning, broken, or reacting, please check with a doctor or dermatologist first. Once you're cleared, I'm happy to help you find something gentle.",
  off_domain:
    "I'm the Shiseido beauty advisor, so I can only help with skincare, your cart, and store questions. Here's where I can actually be useful:",
  unintelligible:
    "Sorry, I didn't catch that. Could you try rephrasing it? Here are a few things shoppers usually ask me:",
};

/**
 * Recovery chips per lane. Every label is phrased so the existing
 * routers resolve it (category vocab for searches, "routine" for the
 * routine card, hygiene wording for policy), so no chip can bounce
 * back into the probing fallback. The crisis lane intentionally shows
 * none.
 */
export const GUARDRAIL_NBAS: Record<GuardrailKind, readonly string[]> = {
  crisis: [],
  medical: [
    "Gentle cleansers for sensitive skin",
    "Fragrance-free moisturizers",
    "See return policy",
  ],
  off_domain: [
    "Build a full routine",
    "Best serum for brightening",
    "Sunscreen under $60",
    "Track my order",
  ],
  unintelligible: [
    "Products for dry skin",
    "Best serum for brightening",
    "Sunscreen under $60",
    "Build a full routine",
  ],
};
