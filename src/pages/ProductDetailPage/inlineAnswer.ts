import type { CatalogProduct } from "../../catalog/catalog";
import {
  classifyGuardrail,
  detectAgeSafetyAsk,
  GUARDRAIL_BODIES,
  type GuardrailKind,
} from "../../components/SidecarAssistant/conversation/guardrails";
import {
  classifyHygieneTopic,
  POLICY_BODIES,
  type HygieneTopic,
} from "../../components/SidecarAssistant/conversation/flow";
import { resolveProductFaq } from "../../components/SideBySideAssistant/conversation/productFaq";

/** Which resolver produced the answer. Carried for telemetry, and so the
 *  widget can style a refusal differently from a product answer later. */
export type InlineAnswerKind = "guardrail" | "policy" | "faq";

export type InlineAnswer = {
  body: string;
  kind: InlineAnswerKind;
  /** The guardrail lane or hygiene topic behind the answer, for telemetry. */
  detail?: string;
  /** Pulled out of policy copy so the widget renders a link, not a raw URL. */
  link?: { label: string; href: string };
};

/** Total wait for the inline PDP thinking slot. */
export const INLINE_THINKING_MS = 4000;

/**
 * The sidecar's off-domain and unintelligible copy ends on a colon because
 * recovery chips follow it in the transcript. Inline mode has no chips to hand
 * out — every one of them resolves to a carousel or a routine, which the widget
 * cannot render — so those two lanes close by pointing at the question row that
 * already sits under the composer. Crisis and medical copy stands on its own.
 */
const INLINE_GUARDRAIL_BODIES: Partial<Record<GuardrailKind, string>> = {
  off_domain:
    "I'm the Shiseido beauty advisor, so I can only help with skincare, " +
    "your cart, and store questions. Ask me about this product, or pick one " +
    "of the questions below.",
  unintelligible:
    "Sorry, I didn't catch that. Could you try rephrasing it? You can also " +
    "pick one of the questions below.",
};

const POLICY_TOPIC_LABEL: Record<HygieneTopic, string> = {
  return: "return",
  replacement: "exchange",
  warranty: "product guarantee",
  shipping: "shipping",
};

/** Policy bodies close with "<label>: <url>"; the widget wants those apart. */
const TRAILING_LINK = /\s*([A-Za-z][A-Za-z& ]*):\s*(https?:\/\/\S+)\s*$/;

function splitTrailingLink(body: string): {
  body: string;
  link?: { label: string; href: string };
} {
  const match = TRAILING_LINK.exec(body);
  if (!match) return { body };
  return {
    body: body.slice(0, match.index).trim(),
    link: { label: match[1].trim(), href: match[2] },
  };
}

function shortenAsk(query: string): string {
  const trimmed = query.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 46) return trimmed;
  return `${trimmed.slice(0, 44).trimEnd()}…`;
}

function compactTitle(title: string): string {
  if (title.length <= 36) return title;
  return `${title.slice(0, 34).trimEnd()}…`;
}

function normalizeFaqQuery(prompt: string): string {
  return prompt
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Research-style loader lines for the inline PDP widget. Steps mirror the
 * same resolve path as `resolveInlineAnswer` so the wait names real work
 * (policy lookup, formula check, application tips) rather than a generic
 * "thinking…" stall.
 */
export function buildInlineThinkingPlan(
  product: CatalogProduct,
  prompt: string,
): { steps: string[]; stepIntervalMs: number } {
  const trimmed = prompt.trim();
  const quote = shortenAsk(trimmed);
  const productName = compactTitle(product.title);
  const steps: string[] = [`Reading “${quote}”`];

  const guardrail = classifyGuardrail(trimmed);
  if (guardrail) {
    if (guardrail === "off_domain") {
      steps.push("Checking this is a beauty question I can help with");
      steps.push("Steering back to skincare and this product");
    } else if (guardrail === "unintelligible") {
      steps.push("Trying to parse what you’re asking");
      steps.push("Looking for a clearer way to help");
    } else {
      steps.push("Reviewing whether I can answer this safely");
      steps.push("Preparing careful guidance");
    }
    steps.push("Getting a reply ready");
  } else {
    const topic = classifyHygieneTopic(trimmed);
    if (topic) {
      steps.push(`Looking up our ${POLICY_TOPIC_LABEL[topic]} policy`);
      steps.push("Pulling the details that apply here");
      steps.push("Getting a reply ready");
    } else {
      const q = normalizeFaqQuery(trimmed);
      if (
        /\b(ingredient|ingredients|formula|formulation|composi\w*|what'?s?\s+in\s+it|active)\b/.test(
          q,
        )
      ) {
        steps.push(`Checking the ${productName} formula`);
        steps.push("Pulling key ingredients and what they do");
      } else if (
        /\b(how\s+to\s+use|how\s+do\s+i\s+use|apply|application|directions?|instructions?|cotton\s+pad|hands?|pump|how\s+often|how\s+much)\b/.test(
          q,
        ) ||
        /\b(use|using|apply|wear)\s+(it|this)\b/.test(q)
      ) {
        steps.push(`Checking how to use the ${productName}`);
        steps.push("Pulling application tips from the product guide");
      } else if (
        /\b(skin\s*types?|dry\s+skin|oily\s+skin|combination\s+skin|who\s+(is\s+it|can\s+use)|suitable\s+for)\b/.test(
          q,
        )
      ) {
        steps.push(`Checking who the ${productName} is for`);
        steps.push("Matching skin-type guidance to this formula");
      } else if (detectAgeSafetyAsk(trimmed)) {
        steps.push("Checking whether I can advise on age or pediatric use");
        steps.push("Preparing careful guidance");
      } else if (
        /\b(sensitive|gentle|irritat\w*|allerg\w*|pregnant|pregnancy|nursing)\b/.test(
          q,
        )
      ) {
        steps.push(`Checking ${productName} suitability notes`);
        steps.push("Reviewing gentle-use and caution guidance");
      } else if (/\b(reviews?|ratings?|stars?|what\s+do\s+people)\b/.test(q)) {
        steps.push(`Checking reviews for the ${productName}`);
        steps.push("Summarizing what shoppers say");
      } else if (/\b(price|cost|how\s+much|sizes?|volume|ml\b|oz)\b/.test(q)) {
        steps.push(`Looking up ${productName} details`);
        steps.push("Checking size and pricing options");
      } else {
        steps.push(`Looking up the ${productName}`);
        steps.push("Gathering the details that answer your question");
      }
      steps.push("Writing a clear answer");
    }
  }

  return {
    steps,
    stepIntervalMs: Math.round(INLINE_THINKING_MS / steps.length),
  };
}

/**
 * Resolve a shopper question to text the inline PDP widget can render on its
 * own, with no assistant panel and no card actions involved.
 *
 * The chain mirrors what the sidecar does for the same question: guardrails
 * first so an off-topic or unreadable prompt never reaches the product
 * knowledge base, then hygiene policy — both assistants check policy ahead of
 * product detail, since "what's the return policy" is not a question about the
 * product — and finally the product FAQ, which always answers with something.
 */
export function resolveInlineAnswer(
  product: CatalogProduct,
  prompt: string,
): InlineAnswer {
  const trimmed = prompt.trim();

  const guardrail = classifyGuardrail(trimmed);
  if (guardrail) {
    return {
      body: INLINE_GUARDRAIL_BODIES[guardrail] ?? GUARDRAIL_BODIES[guardrail],
      kind: "guardrail",
      detail: guardrail,
    };
  }

  const topic = classifyHygieneTopic(trimmed);
  if (topic) {
    const { body, link } = splitTrailingLink(POLICY_BODIES[topic]);
    return { body, kind: "policy", detail: topic, link };
  }

  return {
    body: resolveProductFaq(product, trimmed),
    kind: "faq",
  };
}

export default resolveInlineAnswer;
