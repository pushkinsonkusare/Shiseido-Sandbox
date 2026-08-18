import type { CatalogProduct } from "../../catalog/catalog";
import {
  classifyGuardrail,
  GUARDRAIL_BODIES,
  type GuardrailKind,
} from "../../components/SidecarAssistant/conversation/guardrails";
import {
  classifyHygieneTopic,
  POLICY_BODIES,
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
