import {
  getOpenAIClient,
  getOpenAIModel,
  isLlmConfigured,
} from "../../lib/openaiClient";
import type { CatalogProduct } from "../../catalog/catalog";
import { isBundleTrippingPhrase } from "./assistantSuggestions";
import { MAX_GOALS, type AssistantGoal, type GoalKind } from "./goalEngine";

/* =============================================================
 * AI upgrade for the search overlay's advisor goals.
 *
 * The local goal engine (`goalEngine.ts`) always renders first. Once
 * the shopper pauses, this one-shot call asks the model to infer the
 * shopper's underlying goal (from a product name, a situation, a
 * concern, or plain nonsense) and return 3 sharper goals. The local
 * goals are passed in as context so the model refines rather than
 * starts cold, and its output is validated against the same routing
 * rules. Anything invalid is dropped and topped up from local goals,
 * so the section never gets worse than the local version.
 *
 * Runs through the shared OpenAI client, which in production goes via
 * the Cloudflare Worker proxy (no key in the browser bundle).
 * Per-query cache, abortable, never throws.
 * ============================================================= */

const cache = new Map<string, AssistantGoal[]>();

const KINDS: ReadonlySet<GoalKind> = new Set([
  "situation",
  "concern",
  "routine",
  "compare",
  "gift",
  "discover",
]);

/** Words the advisor's router uses to pick a curated goal recipe. */
const ROUTING_KEYWORD =
  /anti[-\s]?aging|wrinkl|fine lines?|firm|lift|bright|dark spots?|glow|dull|hydrat|dry|moistur|oily|pores?|acne|spf|sunscreen|\bsun\b|men'?s|routine|compare|\bvs\b|gift/i;

function digest(p: CatalogProduct) {
  return {
    title: p.title,
    category: p.category,
    collection: p.series,
    concerns: p.primaryActivities,
    benefits: (p.keyBenefits ?? []).slice(0, 3),
    price: p.price,
  };
}

const SYSTEM_PROMPT = [
  "You write the 'Let your advisor help' suggestions in a Shiseido skincare search dropdown.",
  "Your job: infer the shopper's underlying GOAL from what they typed, then offer 3 goals the AI advisor can solve better than a product grid.",
  "Infer goals from: product or collection names (Ultimune → strengthen skin and prevent early ageing; Benefiance → wrinkles; Vital Perfection → lifting and dark spots; Future Solution LX → luxury anti-aging; Ultimate Sun / Urban Environment → sun protection; Eudermine → softener prep; Essentials → simple basics; Shiseido Men → men's routine; WASO → gentle, plant-powered basics);",
  "situations (travel → carry-on routine, in-flight hydration, SPF for the trip; wedding → glow countdown; gym → post-workout, sweat-proof SPF; winter → dry-skin rescue; late nights → revive dull skin and tired eyes; gift → gifts for her/him);",
  "concerns (fine lines, dark spots, dryness, oiliness, sensitivity, puffy eyes); and modifiers (budget like 'under $50', age like '40s', morning/night).",
  "If the query is vague or nonsense, offer helpful starting points (build a routine, find best-match products, best sellers explained).",
  "Each goal has: label (outcome-first, 3-7 words, sentence case, max 48 chars, no trailing period), hint (the value the shopper gets, max 48 chars, can use ' · ' separators), prompt (the full first-person request sent to the advisor, max 160 chars), kind (one of situation, concern, routine, compare, gift, discover).",
  "ROUTING RULES for prompt (critical): start with 'Help me' (or 'Compare X vs Y' for comparisons), and include at least one of: anti-aging, fine lines, brightening, dark spots, hydrating, dry, oily, pores, sunscreen, men's, routine. Never use the words kit, bundle, set or combo unless kind is gift.",
  "Make the 3 goals genuinely different (different kinds or different skin goals). Do not just restate the query. Never invent product names; only reference collections listed above or in the matches.",
  "You will receive local draft goals; improve on them, keep any that are already strong. If you change a label, write a new hint that matches it. Drafts like 'Build a routine for my skin' are generic fallbacks: replace them whenever you can infer anything specific from the query.",
  'Return STRICTLY valid JSON: {"goals":[{"label":"","hint":"","prompt":"","kind":""}]}. No prose, no markdown.',
].join(" ");

function buildUserMessage(
  query: string,
  products: ReadonlyArray<CatalogProduct>,
  draft: ReadonlyArray<AssistantGoal>,
) {
  return [
    `Shopper typed: "${query}"`,
    "",
    products.length
      ? `Top product matches: ${JSON.stringify(products.slice(0, 4).map(digest))}`
      : "No products matched this query.",
    "",
    `Local draft goals: ${JSON.stringify(
      draft.map(({ label, hint, prompt, kind }) => ({ label, hint, prompt, kind })),
    )}`,
  ].join("\n");
}

function clean(s: unknown, max: number): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim().replace(/\s+/g, " ").replace(/[.]+$/, "");
  return t.length > 0 && t.length <= max ? t : null;
}

function validate(raw: unknown, index: number): AssistantGoal | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const label = clean(r.label, 56);
  const hint = clean(r.hint, 60) ?? "";
  let prompt = clean(r.prompt, 200);
  const kind = (typeof r.kind === "string" && KINDS.has(r.kind as GoalKind)
    ? r.kind
    : "discover") as GoalKind;
  if (!label || !prompt) return null;
  // Guarantee the broad cue so the advisor curates instead of keyword-searching.
  if (!/^(help me|compare)\b/i.test(prompt)) {
    prompt = `Help me ${prompt.charAt(0).toLowerCase()}${prompt.slice(1)}`;
  }
  if (!ROUTING_KEYWORD.test(prompt)) return null;
  if (kind !== "gift" && isBundleTrippingPhrase(prompt)) return null;
  return {
    id: `llm-${index}-${label.toLowerCase()}`,
    kind,
    label,
    hint,
    prompt,
    score: 200 - index,
    source: "llm",
  };
}

/**
 * Ask the model for sharper goals. Returns `null` (keep local goals)
 * when unconfigured, aborted, or the response is unusable.
 */
export async function fetchAssistantGoalsLLM(
  query: string,
  products: ReadonlyArray<CatalogProduct>,
  localGoals: ReadonlyArray<AssistantGoal>,
  signal: AbortSignal,
): Promise<AssistantGoal[] | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const client = getOpenAIClient();
  if (!client) return null;

  const cacheKey = trimmed.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  if (signal.aborted) return null;

  try {
    const response = await client.chat.completions.create(
      {
        model: getOpenAIModel(),
        temperature: 0.5,
        max_tokens: 420,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserMessage(trimmed, products, localGoals) },
        ],
      },
      { signal },
    );
    if (signal.aborted) return null;

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { goals?: unknown };
    if (!Array.isArray(parsed?.goals)) return null;

    // A draft's prompt under a rewritten label means the model changed
    // the promise but not the request: the click would not deliver it.
    const draftByPrompt = new Map(localGoals.map((g) => [g.prompt.toLowerCase(), g]));
    const seen = new Set<string>();
    const goals: AssistantGoal[] = [];
    parsed.goals.forEach((g, i) => {
      const v = validate(g, i);
      if (!v || seen.has(v.label.toLowerCase())) return;
      const draft = draftByPrompt.get(v.prompt.toLowerCase());
      if (draft && draft.label.toLowerCase() !== v.label.toLowerCase()) return;
      seen.add(v.label.toLowerCase());
      goals.push(v);
    });
    // Top up with local goals so a partially-invalid response still
    // shows a full set.
    for (const g of localGoals) {
      if (goals.length >= MAX_GOALS) break;
      if (!seen.has(g.label.toLowerCase())) {
        seen.add(g.label.toLowerCase());
        goals.push(g);
      }
    }
    const result = goals.slice(0, MAX_GOALS);
    if (result.length === 0) return null;
    cache.set(cacheKey, result);
    return result;
  } catch (error) {
    if ((error as { name?: string } | null)?.name === "AbortError") return null;
    // eslint-disable-next-line no-console
    console.warn("[assistantGoalsLLM] fetch failed", error);
    return null;
  }
}

/** Whether an LLM backend (proxy or key) is configured. */
export function isLlmAvailable(): boolean {
  return isLlmConfigured();
}
