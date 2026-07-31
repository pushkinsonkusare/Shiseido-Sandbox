import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useCatalog } from "../../catalog/CatalogContext";
import { useAgentMode, UT_WELCOME_NBA_LABEL } from "../AgentModeBar/AgentModeContext";
import {
  ArrowDownIcon,
  CloseIcon,
  EllipsisVerticalIcon,
  ExpandIcon,
  PlusIcon,
  SaveIcon,
  SendHorizontalIcon,
  ShoppingCartIcon,
  ShrinkIcon,
  SparkleIcon,
  Trash2Icon,
} from "../icons/StorefrontIcons";
import {
  AgentCart,
  AgentCompareCard,
  AgentNBAs,
  AgentOrderSummary,
  AgentPDPCard,
  AgentPLPCard,
  AgentRoutineCard,
  AgentSimpleUtterance,
  LatencyLoader,
  type AgentNBA,
  type AgentCartItem,
  type AgentCartLineItem,
  type AgentCompareColumn,
  type AgentCompareRow,
  type AgentPDPSizeOption,
  type AgentPLPProduct,
} from "./components";
import { SimulatedIOSKeyboard } from "./components/SimulatedIOSKeyboard";
import {
  LANDING_NBA_SUCCESS_THRESHOLDS,
  ORDER_FOLLOWUP_NBAS,
  POLICY_BODIES,
  ROUTINE_FOLLOWUP_NBAS,
  PROBING_FALLBACK_BODY,
  TRACK_ORDER_BODY,
  WELCOME_BODY,
  WELCOME_TITLE,
  buildStageNbas,
  buildWelcomeNbas,
  buildPlpIntro,
  buildRoutineAcknowledgement,
  buildRoutineSectionDescription,
  classifyHygieneTopic,
  classifyIntent,
  detectRoutineIntent,
  filterProducts,
  findBundlesForIntent,
  findMatchingBundle,
  getLandingNbaLane,
  pickRecommendations,
  ROUTINE_STEPS,
  type HygieneTopic,
  type Intent,
  type NbaLane,
  type NbaStage,
  type RoutineIntent,
  type StageNbaItem,
} from "./conversation/flow";
import {
  GUARDRAIL_BODIES,
  GUARDRAIL_NBAS,
  classifyGuardrail,
  type GuardrailKind,
} from "./conversation/guardrails";
import type { ChatMessage, RoutineSection } from "./conversation/types";
import type { CatalogProduct } from "../../catalog/catalog";
import type { AskAssistantEventDetail } from "../../pages/ProductDetailPage/PdpNbaPanel";
import { resolveProductFaq } from "../SideBySideAssistant/conversation/productFaq";
import {
  buildCompareDifferenceAnswer,
  buildCompareFitAnswer,
  buildCompareRationale,
  buildNoCheaperAnswer,
  buildUseBothAnswer,
  priceSpread,
  type SkinType,
} from "./conversation/compareAnswers";
import { createOpenAIAgent, type AgentAction, type OpenAIAgent } from "./agent/openaiAgent";
import { isLlmConfigured } from "../../lib/openaiClient";
import { stripEmDashes } from "../../lib/sanitizeText";
import "./SidecarAssistant.css";

const PLACEHOLDER_INPUT = "Ask me anything";

const NUDGE_INTERVAL_MS = 90_000;
const NUDGE_DURATION_MS = 2500;

const RESPONSE_LATENCY_MS = 1200;
/** A guardrail turn is a read of the message, not a search, so it answers
 * faster than any lookup: a long "searching" beat before "I can't help with
 * that" implies the store went looking. */
const GUARDRAIL_LATENCY_MS = 700;
/** An open-ended ask reads as real work, so the agent takes the time to narrate
 * it. A query that already carries filters is closer to a lookup. */
const DISCOVERY_LATENCY_MS = 5000;
const NARROW_LATENCY_MS = 3000;
const DISCOVERY_LOADER_STEPS = [
  "Understanding your request",
  "Looking through the range",
  "Matching the best products",
  "Getting your picks ready",
];
const NARROW_LOADER_STEPS = [
  "Applying your filters",
  "Checking what's in stock",
  "Getting your picks ready",
];
/** Cart edits go through the agent rather than straight into local state, so a
 * quantity change holds the card's totals until the round trip lands. */
const CART_UPDATE_LATENCY_MS = 3000;
/** The routine card writes itself a step at a time, so it needs far less silent
 * thinking up front than a search that lands whole: the reveal is the progress
 * indicator. */
const ROUTINE_THINKING_MS = 2000;
const ROUTINE_STREAM_STEP_MS = 700;
const ROUTINE_LOADER_STEP_MS = 750;
/** How long a product list card holds its intro before the row lands. Same beat
 * as a routine section, so the two cards read as the same agent writing. */
const PLP_REVEAL_MS = 700;
const PLP_PAGE_SIZE = 5;

/** Maximum number of products a shopper can select at once. */
const MAX_SELECTED_PRODUCTS = 3;

/** Contextual pills that are NOT product FAQs: they trigger dedicated flows
 * (related-products carousel / comparison table / add-to-cart) rather than a
 * local answer. */
const CONTEXTUAL_ACTION_LABELS = new Set(["Show similar", "Compare", "Add to cart"]);

/** Always-present FAQ pill for a single selected product. */
const INGREDIENTS_FAQ_LABEL = "What are the ingredients?";

/** Social proof, offered alongside the product's own FAQ pool. Shared so the
 *  PDP chip builder and the click router agree on one string. */
const REVIEWS_FAQ_LABEL = "What do reviews say";

/** Normalize free-text so "Compare!", "compare these", etc. can match pills. */
function normalizeComposerQuery(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ");
}

/**
 * When the selection tray is open, map typed composer text onto the same
 * contextual actions/FAQs the tray pills trigger. Returns the canonical pill
 * label, or null if the text should take the normal free-text path.
 */
function resolveContextualComposerLabel(
  text: string,
  selectedSlugs: string[],
  getProductBySlug: (slug: string) => CatalogProduct | undefined,
): string | null {
  if (selectedSlugs.length === 0) return null;
  const normalized = normalizeComposerQuery(text);
  if (!normalized) return null;

  // Action aliases — typed equivalents of tray / contextual action pills.
  if (/^compare(\s+(them|these|products?|items?))?$/.test(normalized)) {
    return "Compare";
  }
  if (
    /^(show\s+similar|similar(\s+products?)?|find\s+similar)$/.test(normalized)
  ) {
    return "Show similar";
  }

  // Exact match against the contextual questions for this selection. The
  // ingredients question stays matchable even though the tray no longer offers
  // it as a pill, so typing it still gets a product-scoped answer.
  const labels: string[] = [];
  if (selectedSlugs.length >= 2) {
    labels.push("Compare");
  } else {
    const product = getProductBySlug(selectedSlugs[0]);
    if (product) {
      const [faq1, faq2] = buildContextualFaqs(product);
      labels.push("Show similar", faq1, faq2, INGREDIENTS_FAQ_LABEL);
    }
  }
  return (
    labels.find((label) => normalizeComposerQuery(label) === normalized) ?? null
  );
}

/**
 * Sitewide em-dash scrub for agent utterances. Applied to every message before
 * it is appended so both deterministic copy and free-form LLM output stay in a
 * plain, spoken voice. Only agent-authored narrative fields are touched;
 * shopper text, loaders, and catalog-derived fields (product titles, PDP copy)
 * are left untouched.
 */
function sanitizeAgentMessage(message: ChatMessage): ChatMessage {
  switch (message.kind) {
    case "agent_simple":
      return {
        ...message,
        title: message.title ? stripEmDashes(message.title) : message.title,
        body: stripEmDashes(message.body),
      };
    case "agent_plp":
      return { ...message, intro: stripEmDashes(message.intro) };
    case "agent_routine":
      return {
        ...message,
        acknowledgement: stripEmDashes(message.acknowledgement),
        sections: message.sections.map((section) => ({
          ...section,
          description: stripEmDashes(section.description),
        })),
      };
    case "agent_compare":
      return {
        ...message,
        intro: stripEmDashes(message.intro),
        recommendation: message.recommendation
          ? stripEmDashes(message.recommendation)
          : message.recommendation,
      };
    case "agent_cart":
    case "agent_order":
      return {
        ...message,
        acknowledgement: message.acknowledgement
          ? stripEmDashes(message.acknowledgement)
          : message.acknowledgement,
        summary: stripEmDashes(message.summary),
      };
    case "agent_nbas":
      return {
        ...message,
        nbas: message.nbas.map((nba) => ({
          ...nba,
          label: stripEmDashes(nba.label),
        })),
      };
    default:
      return message;
  }
}

/**
 * Ordered pool of product-FAQ pills for a single selected product. The
 * phrasings are chosen so `resolveProductFaq` routes each to a
 * product-grounded answer (e.g. "layer" -> layering copy, "texture" ->
 * texture copy). Category-specific questions lead, followed by a
 * universal tail; the list is de-duplicated so a category lead that also
 * appears in the tail is only listed once. The follow-up builder reveals
 * these progressively, dropping any the shopper has already asked, so
 * the suggestion row keeps offering genuinely new questions instead of
 * recycling answered ones.
 */
function buildContextualFaqPool(product: CatalogProduct): string[] {
  const category = product.category.toLowerCase();
  const tags = product.useCaseTags.map((tag) => tag.toLowerCase());
  const isSunCare =
    /sunscreen|sun\s*care/.test(category) ||
    tags.some((tag) => tag === "spf" || tag.includes("sun"));

  let lead: string[];
  if (product.isBundle) {
    lead = [
      "What's included?",
      "What skin types is this for?",
      "How do I use this?",
      "What does this target?",
    ];
  } else if (isSunCare) {
    lead = [
      "What SPF is it?",
      "Is this waterproof?",
      "Can I layer this under makeup?",
      "What skin types is this for?",
    ];
  } else if (/serum|treatment|essence|booster/.test(category)) {
    lead = [
      "What does this target?",
      "Is this good for sensitive skin?",
      "How do I layer this with other products?",
      "How long until I see results?",
    ];
  } else if (/moisturizer|cream|emulsion|lotion/.test(category)) {
    lead = [
      "What's the texture like?",
      "What skin types is this for?",
      "Can I layer this under makeup?",
    ];
  } else if (/cleanser|softener|toner|foam/.test(category)) {
    lead = [
      "How do I use this?",
      "What skin types is this for?",
      "Is this good for sensitive skin?",
    ];
  } else if (/eye|lip/.test(category)) {
    lead = [
      "What does this target?",
      "How do I layer this with other products?",
      "How do I use this?",
    ];
  } else if (/mask/.test(category)) {
    lead = [
      "What's the texture like?",
      "What does this target?",
      "How do I use this?",
    ];
  } else {
    lead = ["Is this good for sensitive skin?", "What does this target?"];
  }

  // Universal questions every skincare product can answer. Appended after
  // the category lead so the pool is deep enough that a shopper can work
  // through several turns before it's exhausted.
  const universalTail = [
    "What does this target?",
    "What skin types is this for?",
    "Is this good for sensitive skin?",
    "How do I use this?",
    "What's the texture like?",
    "How do I layer this with other products?",
    "How long until I see results?",
    INGREDIENTS_FAQ_LABEL,
  ];

  const seen = new Set<string>();
  const pool: string[] = [];
  for (const label of [...lead, ...universalTail]) {
    if (seen.has(label)) continue;
    seen.add(label);
    pool.push(label);
  }
  return pool;
}

/**
 * Follow-up pills shown after a contextual FAQ answer: the product's
 * still-unanswered FAQs (so we never repeat one the shopper already
 * asked), capped to a few, plus a commit ("Add to cart") and a lateral
 * ("Show similar") action. Once every FAQ has been answered the row shows
 * only the two actions rather than recycling stale questions.
 */
function buildContextualFollowupLabels(
  product: CatalogProduct,
  answered: ReadonlySet<string>,
): string[] {
  const remaining = buildContextualFaqPool(product).filter(
    (label) => !answered.has(label),
  );
  return [...remaining.slice(0, 3), "Add to cart", "Show similar"];
}

/**
 * The two most relevant FAQ pills for the selection tray: the first two
 * entries of the product's FAQ pool.
 */
function buildContextualFaqs(product: CatalogProduct): [string, string] {
  const pool = buildContextualFaqPool(product);
  return [pool[0], pool[1] ?? INGREDIENTS_FAQ_LABEL];
}
const TALL_CARD_VIEWPORT_RATIO = 0.92;
const TALL_CARD_ANCHOR_RATIO = 0.6;
const TALL_CARD_TOP_INSET_PX = 16;
const TALL_CARD_SETTLE_TIMEOUT_MS = 140;

/** With sticky context headers on, the section's chip is docked at the top of
 *  the transcript by the time a card is aligned, so the card has to clear the
 *  chip as well as the inset. */
function dockedSeparatorHeight(node: HTMLElement, anchor: HTMLElement) {
  if (!node.classList.contains("sidecar-assistant__chat--sticky-context")) return 0;
  const separators = Array.from(
    node.querySelectorAll<HTMLElement>(".sidecar-assistant__context-separator"),
  );
  const preceding = separators.filter(
    (separator) =>
      separator.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
  return preceding.length ? preceding[preceding.length - 1].offsetHeight : 0;
}

/** The scrollTop that parks `card`'s first line just under the transcript's top
 *  inset. Shared by the tall-card landing and the streaming follow so a card
 *  that grows ends up exactly where a card that lands whole does. */
function cardTopScrollTarget(node: HTMLElement, card: HTMLElement) {
  const chatRect = node.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  return Math.max(
    0,
    node.scrollTop +
      (cardRect.top - chatRect.top) -
      TALL_CARD_TOP_INSET_PX -
      dockedSeparatorHeight(node, card),
  );
}
/** How far into the chat viewport a context divider must scroll before the
 * island adopts its product. Clears the floating island (12px inset + its own
 * height) so a divider hands over as it slides behind the island. */
const CONTEXT_SCROLL_ACTIVATION_PX = 70;
/** Slack for "scrolled to the bottom", which lands fractionally short. */
const CONTEXT_SCROLL_BOTTOM_TOLERANCE_PX = 2;
/** How long a reading of "no divider above the line" has to hold before the
 * island drops its pill, so transient shifts do not flash it off and on. */
const CONTEXT_SCROLL_BLANK_DELAY_MS = 300;
/** How far from the end of the transcript counts as having left the latest
 * message. Generous enough that landing fractionally short of the end does not
 * leave the jump-to-latest button hanging around. */
const JUMP_TO_LATEST_SLACK_PX = 40;
/** How long the transcript has to sit away from the end before the button
 * appears. Appending a tall card parks it at the top and the auto-scroll to the
 * end follows a beat later, which would otherwise blink the button on and off. */
const JUMP_TO_LATEST_SHOW_DELAY_MS = 250;

/** Message kinds that are an agent turn talking to the shopper, and so should
 * never be the last thing in the transcript without suggestions under them. */
const NEEDS_FOLLOW_UP_ROW = new Set<ChatMessage["kind"]>([
  "agent_simple",
  "agent_plp",
  "agent_routine",
  "agent_pdp",
  "agent_compare",
  "agent_cart",
  "agent_order",
]);
/** Long enough for a flow to append its own row first, short enough that the
 * pause doesn't read as the agent having nothing more to offer. */
const NBA_FALLBACK_DELAY_MS = 500;

const HYGIENE_TITLE: Record<HygieneTopic, string> = {
  return: "Returns & refunds",
  replacement: "Replacement service",
  warranty: "Warranty & repair",
  shipping: "Shipping & delivery",
};

/** A response waiting on its timer, kept whole so a cancelled turn can be put
 * back on the clock exactly as it was scheduled. */
type PendingResponse = {
  timeoutId: number;
  handler: () => void;
  delay: number;
};

/** Everything needed to replay a turn the shopper stopped: the utterance to
 * echo, the loaders that were pulled, and the work that never ran. */
type CancelledTurn = {
  prompt?: string;
  loaders: ChatMessage[];
  responses: Array<{ handler: () => void; delay: number }>;
};

const CANCELLED_TURN_BODY =
  "You cancelled the last prompt. Let me know if you want to look for something else.";
/** Leads the row after a cancellation, so a turn the shopper stopped - or one
 * that stalled and had to be stopped - is one tap away from running again. */
const RETRY_NBA_LABEL = "Retry last";

let messageIdCounter = 0;
function nextId(prefix: string) {
  messageIdCounter += 1;
  return `${prefix}-${messageIdCounter}`;
}

/**
 * Serialize the current conversation into a plain-text transcript suitable for
 * downloading. Each message is rendered from the shopper's or the assistant's
 * point of view so the exported file reads like a chat log.
 */
function buildTranscriptText(messages: ChatMessage[]): string {
  const lines: string[] = [
    "Shiseido Personal Assistant Session Transcript",
    `Exported: ${new Date().toLocaleString()}`,
    "",
  ];

  for (const message of messages) {
    switch (message.kind) {
      case "shopper_text":
        lines.push(`Shopper: ${message.text}`);
        break;
      case "agent_simple":
        lines.push(
          `Assistant: ${message.title ? `${message.title}: ` : ""}${message.body}`,
        );
        break;
      case "agent_plp":
        lines.push(`Assistant: ${message.intro}`);
        for (const product of message.products) {
          lines.push(`  • ${product.title} (${product.price})`);
        }
        break;
      case "agent_pdp":
        lines.push(`Assistant: ${message.title} (${message.price})`);
        break;
      case "agent_compare":
        lines.push(`Assistant: ${message.intro}`);
        lines.push(`  ${message.columns.map((column) => column.title).join(" vs ")}`);
        for (const row of message.rows) {
          lines.push(
            `    ${row.label}: ${row.values
              .map((value) => value ?? "N/A")
              .join(" | ")}`,
          );
        }
        if (message.recommendation) {
          lines.push(`Assistant: ${message.recommendation}`);
        }
        break;
      case "agent_cart":
      case "agent_order":
        if (message.acknowledgement) {
          lines.push(`Assistant: ${message.acknowledgement}`);
        }
        lines.push(`Assistant: ${message.summary}`);
        for (const item of message.items) {
          lines.push(`  • ${item.title}`);
        }
        for (const lineItem of message.lineItems) {
          lines.push(`    ${lineItem.label}: ${lineItem.value}`);
        }
        break;
      case "agent_nbas":
        lines.push(
          `Assistant (suggestions): ${message.nbas
            .map((nba) => nba.label)
            .join(", ")}`,
        );
        break;
      case "agent_loader":
        break;
      default:
        break;
    }
  }

  return lines.join("\n");
}

/** Format a number as a USD currency string (used for promo math). */
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function toPlpProduct(
  product: CatalogProduct,
  onSelect: (slug: string) => void,
): AgentPLPProduct {
  return {
    id: product.slug,
    imageUrl: product.imageUrl,
    imageAlt: product.imageAlt,
    title: product.title,
    price: product.priceFormatted,
    comparePrice: product.comparePriceFormatted ?? undefined,
    description: product.shortDescription,
    rating: product.rating ?? undefined,
    reviewCount: product.reviewCount ?? undefined,
    swatches: product.swatches.map((color) => ({ color })),
    badgeLabel: product.badgeLabel,
    onSelect: () => onSelect(product.slug),
  };
}

/** The sizes a product is sold in, read off the catalog's `Sizes` spec. A
 * product with a single size offers nothing to choose between, so it comes back
 * empty and reads as having no variants at all. */
function productSizeOptions(product: CatalogProduct): AgentPDPSizeOption[] {
  const spec = product.specs.find((entry) => entry.label === "Sizes");
  if (!spec || !spec.value) return [];
  const labels = [
    ...new Set(
      spec.value
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean),
    ),
  ];
  if (labels.length < 2) return [];
  return labels.map((label, index) => ({ id: `size-${index}`, label }));
}

function toCompareColumn(product: CatalogProduct): AgentCompareColumn {
  return {
    id: product.slug,
    slug: product.slug,
    imageUrl: product.imageUrl,
    imageAlt: product.imageAlt,
    title: product.title,
    price: product.priceFormatted,
    comparePrice: product.comparePriceFormatted ?? undefined,
    rating: product.rating ?? undefined,
    reviewCount: product.reviewCount ?? undefined,
  };
}

/** How the shopper's own turn reads when they trigger a comparison: the pill
 * label alone ("Compare") loses which products they picked, so the bubble names
 * them the way someone would ask out loud. */
function buildCompareQuery(products: CatalogProduct[]): string {
  const titles = products.map((product) => `the ${product.title}`);
  if (titles.length === 0) return "Compare";
  // A single selection pads the table with related items, so say so.
  if (titles.length === 1) return `Compare ${titles[0]} with similar products`;
  const last = titles[titles.length - 1];
  if (titles.length === 2) return `Compare ${titles[0]} and ${last}`;
  return `Compare ${titles.slice(0, -1).join(", ")}, and ${last}`;
}

/* Preferred order for spec rows in the comparison table; any remaining
 * spec labels present on the products are appended after these. */
const COMPARE_SPEC_ORDER = [
  "Collection",
  "Type",
  "Skin type",
  "Targets",
  "Sizes",
  "Routine",
];

/** Build catalog-grounded comparison rows (category, then shared specs) for a
 * set of products. Price and rating are rendered in the column headers instead
 * of as rows. Missing values are left as `null` so the table renders "N/A". */
function buildCompareRows(products: CatalogProduct[]): AgentCompareRow[] {
  const specValue = (product: CatalogProduct, label: string): string | null => {
    const spec = product.specs.find((entry) => entry.label === label);
    return spec && spec.value ? spec.value : null;
  };

  const rows: AgentCompareRow[] = [
    { label: "Category", values: products.map((p) => p.category || null) },
  ];

  const seen = new Set<string>();
  const orderedLabels = [
    ...COMPARE_SPEC_ORDER,
    ...products.flatMap((p) => p.specs.map((s) => s.label)),
  ];
  for (const label of orderedLabels) {
    if (!label || seen.has(label)) continue;
    seen.add(label);
    const values = products.map((p) => specValue(p, label));
    if (values.some((value) => value != null)) {
      rows.push({ label, values });
    }
  }

  return rows;
}

/** Slugs already in the cart, read off the single cart card `renderCartCard`
 *  keeps up to date, so the compare row can skip a redundant commit chip. */
function cartSlugsFromMessages(messages: ChatMessage[]): string[] {
  const cart = [...messages]
    .reverse()
    .find((message): message is Extract<ChatMessage, { kind: "agent_cart" }> =>
      message.kind === "agent_cart",
    );
  return cart ? cart.items.map((item) => item.id.replace(/^cart-/, "")) : [];
}

/** The skin type a fit chip asks about ("Which suits dry skin?"). */
function skinTypeFromFitLabel(label: string): SkinType | null {
  const match = /^which suits (\w+) skin/i.exec(label.trim());
  if (!match) return null;
  const candidates: SkinType[] = ["Oily", "Dry", "Combination", "Normal"];
  return (
    candidates.find(
      (type) => type.toLowerCase() === match[1].toLowerCase(),
    ) ?? null
  );
}

function toCartItem(product: CatalogProduct, quantity: number): AgentCartItem {
  return {
    id: `cart-${product.slug}`,
    imageUrl: product.imageUrl,
    imageAlt: product.imageAlt,
    title: product.title,
    meta: [`Brand: ${product.brand}`, `Category: ${product.category}`],
    price: product.priceFormatted,
    comparePrice: product.comparePriceFormatted ?? undefined,
    quantity,
  };
}

function cartItemUnitPrice(item: AgentCartItem): number {
  return Number(item.price.replace(/[^0-9.]/g, "")) || 0;
}

/** Recompute cart totals for an arbitrary set of items, honoring an optional
 * applied promo (stored as a fraction so it survives quantity edits). */
function recomputeCartLineItems(
  items: AgentCartItem[],
  appliedPromo?: { code: string; fraction: number },
): AgentCartLineItem[] {
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce(
    (sum, item) => sum + cartItemUnitPrice(item) * item.quantity,
    0,
  );
  const discount = appliedPromo
    ? Math.round(subtotal * appliedPromo.fraction * 100) / 100
    : 0;

  const lines: AgentCartLineItem[] = [
    {
      label: `Subtotal (${count} item${count === 1 ? "" : "s"})`,
      value: usd.format(subtotal),
    },
  ];
  if (discount > 0 && appliedPromo) {
    lines.push({
      label: "Coupon",
      note: appliedPromo.code,
      value: `-${usd.format(discount)}`,
    });
  }
  // Not yet calculated, so these show as placeholders until wired to pricing logic.
  lines.push({ label: "Promotions", value: "-" });
  lines.push({ label: "Shipping", value: "-" });
  lines.push({ label: "Shipping Discount", value: "-" });
  lines.push({ label: "Tax", value: "TBD" });
  lines.push({
    label: "Estimated total",
    value: usd.format(Math.max(0, subtotal - discount)),
    emphasis: true,
  });
  return lines;
}

function cartSummaryText(items: AgentCartItem[], total: number): string {
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  return `Your cart has ${count} item${count === 1 ? "" : "s"} with a subtotal of ${usd.format(total)}.`;
}

function buildNbasMessage(
  labels: ReadonlyArray<string>,
  regenerateButton = true,
  options: {
    stage?: NbaStage | "welcome";
    laneByLabel?: Record<string, NbaLane>;
    idPrefix?: string;
    productSlug?: string;
  } = {},
): ChatMessage {
  return {
    id: nextId("nbas"),
    kind: "agent_nbas",
    regenerateButton,
    stage: options.stage,
    laneByLabel: options.laneByLabel,
    productSlug: options.productSlug,
    nbas: buildNbaItems(labels, options.idPrefix ?? "nba"),
  };
}

function buildStageNbasMessage(
  stage: NbaStage,
  items: StageNbaItem[],
  regenerateButton = true,
  options: { productSlug?: string } = {},
): ChatMessage {
  const labels = items.map((item) => item.label);
  const laneByLabel = items.reduce<Record<string, NbaLane>>((acc, item) => {
    acc[item.label] = item.lane;
    return acc;
  }, {});
  return buildNbasMessage(labels, regenerateButton, {
    stage,
    laneByLabel,
    idPrefix: `nba-${stage}`,
    productSlug: options.productSlug,
  });
}

/**
 * How long a search should take, and what to say while it does.
 *
 * `Intent.kind` can't make this call: "help me choose a serum" names a
 * category, so it classifies `direct` exactly like "serum under $100". What
 * separates them is whether the query hands over anything to filter on.
 */
function buildSearchLoaderPlan(
  query: string,
  options: { refinement?: boolean } = {},
): {
  delayMs: number;
  steps: string[];
  stepIntervalMs: number;
} {
  const intent = classifyIntent(query);
  const narrowing = Boolean(
    intent.priceMax ||
      intent.priceMin ||
      intent.tier ||
      intent.compatibleWith ||
      intent.requiredTags?.length ||
      intent.activities?.length ||
      intent.subtypeHints?.length,
  );
  // Refining is never exploring: the shopper is already looking at results and
  // only wants them cut down, whatever the pill's wording carries.
  const exploring =
    !options.refinement &&
    (detectRoutineIntent(query).isRoutine || !narrowing);
  const delayMs = exploring ? DISCOVERY_LATENCY_MS : NARROW_LATENCY_MS;
  const steps = exploring ? DISCOVERY_LOADER_STEPS : NARROW_LOADER_STEPS;
  return {
    delayMs,
    steps,
    stepIntervalMs: Math.round(delayMs / steps.length),
  };
}

function buildNbaItems(labels: ReadonlyArray<string>, idPrefix = "nba"): AgentNBA[] {
  return labels.map((label) => ({
    id: `${idPrefix}-${label.replace(/\W+/g, "-").toLowerCase()}-${nextId("nba")}`,
    label,
  }));
}

function emitAssistantTelemetry(event: string, payload: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("agentic:assistant-telemetry", {
      detail: { event, payload, ts: Date.now() },
    }),
  );
}

function buildOrderLineItems(
  product: CatalogProduct,
  quantity: number,
  promoDiscount = 0,
): AgentCartLineItem[] {
  const subtotal = (product.price ?? 0) * quantity;
  const shipping = 0;
  const tax = Math.round(subtotal * 0.0875 * 100) / 100;
  const total = Math.max(0, subtotal - promoDiscount) + shipping + tax;

  const items: AgentCartLineItem[] = [
    { label: `Subtotal (${quantity} item${quantity === 1 ? "" : "s"})`, value: usd.format(subtotal) },
  ];
  if (promoDiscount > 0) {
    items.push({ label: "Promo discount", value: `-${usd.format(promoDiscount)}` });
  }
  items.push({ label: "Shipping", value: "Free" });
  items.push({ label: "Tax", value: usd.format(tax) });
  items.push({ label: "Total paid", value: usd.format(total), emphasis: true });
  return items;
}

/** An "Ask Assistant" request that arrived before this component existed, so
 * its own event listener could not see it. `token` lets the consumer ignore a
 * replayed prop (React 18 StrictMode remounts) instead of doubling the turn. */
export type PendingAsk = {
  token: number;
  detail: AskAssistantEventDetail;
};

type SidecarAssistantProps = {
  /** When true, the assistant renders as a flush docked panel that fills its
   * container (see SidecarDockLayout) instead of a floating fixed overlay.
   * In this mode open/close is owned by the layout via `open`/`onRequestClose`
   * and the component skips its overlay-only behaviors (backdrop, own FAB,
   * page scroll-lock, outside-click / Escape to close). */
  docked?: boolean;
  /** Open state, only consulted when `docked`. */
  open?: boolean;
  /** Close request from the docked panel's header button. */
  onRequestClose?: () => void;
  /** When true (docked only), the panel is floating as a centered modal. */
  detached?: boolean;
  /** Toggle between docked and detached modal, driven by the Expand button. */
  onToggleDetach?: () => void;
  /** Ask request the layout caught while this component was unmounted. */
  pendingAsk?: PendingAsk | null;
  /** Fired once `pendingAsk` has been turned into a thread. */
  onPendingAskHandled?: () => void;
};

export function SidecarAssistant({
  docked = false,
  open = false,
  onRequestClose,
  detached = false,
  onToggleDetach,
  pendingAsk = null,
  onPendingAskHandled,
}: SidecarAssistantProps = {}) {
  const { products, heroProduct, getProductBySlug, getRelatedProducts, orderHistory } =
    useCatalog();
  const { accordionRecommendations, contextIsland, viewportMode, userTestingLock } =
    useAgentMode();
  const [isOpen, setIsOpen] = useState(false);
  const [simKeyboardOpen, setSimKeyboardOpen] = useState(false);

  useEffect(() => {
    if (viewportMode !== "mobile") setSimKeyboardOpen(false);
  }, [viewportMode]);

  // When docked, the surrounding layout owns open/close; mirror it into the
  // internal `isOpen` so all the open-driven effects (welcome seeding, etc.)
  // keep working unchanged.
  useEffect(() => {
    if (!docked) return;
    setIsOpen(open);
    if (!open) setSimKeyboardOpen(false);
  }, [docked, open]);
  const [hasUserOpenedFab, setHasUserOpenedFab] = useState(false);
  const [isNudging, setIsNudging] = useState(false);
  const [inputValue, setInputValue] = useState("");
  // The utterance the shopper just typed, kept only for the beat the composer
  // is disabled so the field shows what is in flight instead of going blank.
  const [sentDraft, setSentDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [welcomeRefreshCount, setWelcomeRefreshCount] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // The cart card and item whose quantity change is mid-flight, if any.
  const [updatingCart, setUpdatingCart] = useState<{
    cartId: string;
    itemId: string;
  } | null>(null);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const selectedSet = useMemo(() => new Set(selectedSlugs), [selectedSlugs]);

  // Context island: item count and total from the latest cart card, and the
  // product the conversation is currently scoped to (the primary selection).
  const cartTotals = useMemo(() => {
    const cart = [...messages]
      .reverse()
      .find(
        (m): m is Extract<ChatMessage, { kind: "agent_cart" }> =>
          m.kind === "agent_cart",
      );
    if (!cart) return { count: 0, total: "" };
    return {
      count: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      // The emphasised line is the authoritative total: it already accounts
      // for any applied promo, so the island never disagrees with the card.
      total: cart.lineItems.find((line) => line.emphasis)?.value ?? "",
    };
  }, [messages]);
  const cartItemCount = cartTotals.count;
  const hasContextSeparators = useMemo(
    () => messages.some((message) => message.kind === "context_separator"),
    [messages],
  );
  // Slug of the divider the shopper has most recently scrolled past. `null`
  // means they are above the first one, where no product context exists yet.
  const [scrolledContextSlug, setScrolledContextSlug] = useState<string | null>(
    null,
  );
  // True while there are messages below the fold, which the jump-to-latest
  // button both announces and offers to close the distance on.
  const [awayFromLatest, setAwayFromLatest] = useState(false);
  // The product the transcript implies on its own, ignoring where the shopper
  // has scrolled: walk back through the conversation and let the most recent
  // context-defining message decide. A product-focused message (PDP card,
  // contextual FAQ row, or context separator) pins the island to that
  // product even when newer cart / NBA rows follow - so the product pill
  // and the cart button can co-exist. A results / routine message means
  // the shopper has moved to a non-product context, so the pill drops.
  const threadContextProduct = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (message.kind === "agent_pdp" && message.productSlug) {
        return getProductBySlug(message.productSlug);
      }
      if (
        message.kind === "agent_nbas" &&
        message.contextual &&
        message.productSlug
      ) {
        return getProductBySlug(message.productSlug);
      }
      if (message.kind === "context_separator" && message.productSlug) {
        return getProductBySlug(message.productSlug);
      }
      if (message.kind === "agent_plp" || message.kind === "agent_routine") {
        return undefined;
      }
    }
    return undefined;
  }, [messages, getProductBySlug]);
  const contextProduct = useMemo(() => {
    // A live selection is the strongest signal for the product in context.
    if (selectedSlugs.length > 0) {
      return getProductBySlug(selectedSlugs[0]);
    }
    // Once the transcript has dividers they define its product sections, so the
    // island follows whichever section the shopper has scrolled into. Above the
    // first divider there is no product context yet, so the pill drops.
    if (hasContextSeparators) {
      return scrolledContextSlug
        ? getProductBySlug(scrolledContextSlug)
        : undefined;
    }
    return threadContextProduct;
  }, [
    selectedSlugs,
    getProductBySlug,
    hasContextSeparators,
    scrolledContextSlug,
    threadContextProduct,
  ]);
  // Deliberately blind to scroll position. The island reserves space at the top
  // of the transcript and that space sits inside the scroll container, so
  // mounting it on a scroll-derived value would move the dividers the scroll
  // reader measures and oscillate for as long as the shopper sat near one.
  const showContextIsland =
    contextIsland &&
    (cartItemCount > 0 ||
      selectedSlugs.length > 0 ||
      hasContextSeparators ||
      Boolean(threadContextProduct));
  // Above the first divider with an empty cart there is nothing worth showing,
  // but unmounting would give the space back and restart the loop above, so the
  // island stays in place and only turns invisible.
  const contextIslandEmpty = !contextProduct && cartItemCount === 0;
  // True once the shopper has asked a contextual FAQ for the current selection:
  // the follow-up pills then live in-chat, so the tray hides its own pill row.
  const [contextualThreadActive, setContextualThreadActive] = useState(false);
  // Contextual pills adapt to how many products are selected: a single product
  // offers Show similar plus its two most relevant FAQs, while two or more
  // products collapse to a single Compare action.
  const contextualNbas = useMemo(() => {
    if (selectedSlugs.length >= 2) {
      return buildNbaItems(["Compare"], "nba-contextual");
    }
    const firstSlug = selectedSlugs[0];
    const product = firstSlug ? getProductBySlug(firstSlug) : undefined;
    if (!product) return [];
    const [faq1, faq2] = buildContextualFaqs(product);
    return buildNbaItems(["Show similar", faq1, faq2], "nba-contextual");
  }, [selectedSlugs, getProductBySlug]);

  // When products are selected, the input invites a product-scoped question.
  const inputPlaceholder = useMemo(() => {
    if (selectedSlugs.length === 1) {
      const product = getProductBySlug(selectedSlugs[0]);
      if (product) return `Ask me anything about ${product.title}`;
    }
    if (selectedSlugs.length > 1) {
      return `Ask me anything about your ${selectedSlugs.length} selected products`;
    }
    return PLACEHOLDER_INPUT;
  }, [selectedSlugs, getProductBySlug]);

  const chatRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const previousMessageIdsRef = useRef<string[]>([]);
  /** Set for a single commit whose scroll position is already being managed, so
   *  the transcript's own auto-scroll stands down for it. */
  const skipAutoScrollRef = useRef(false);
  const panelRef = useRef<HTMLElement>(null);
  // Scheduled work for the turn in flight. The handlers are kept alongside
  // their timers so "Stop" can drop them and "Retry last" can put the very same
  // turn back on the clock.
  const pendingResponses = useRef<PendingResponse[]>([]);
  const cancelledTurnRef = useRef<CancelledTurn | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  // Slug of the product the most recent context separator announced, so we
  // only drop a fresh divider when the FAQ context switches products.
  const lastSeparatorSlugRef = useRef<string | null>(null);
  // Which contextual FAQ labels the shopper has already asked, keyed by
  // product slug, so the follow-up suggestion row keeps offering genuinely
  // new questions instead of recycling answered ones.
  const answeredFaqsBySlugRef = useRef<Map<string, Set<string>>>(new Map());
  const welcomeNbasMessageIdRef = useRef<string | null>(null);
  const firstShopperTurnHandledRef = useRef(false);
  const previousSelectedCountRef = useRef(0);
  // The intent behind the currently-shown PLP, so refinement NBA pills can
  // narrow the current result set (keeping category + filters) instead of
  // re-running as a fresh, context-less query.
  const activePlpIntentRef = useRef<Intent | null>(null);
  const lastStageNbaClickRef = useRef<{
    stage: NbaStage | "welcome";
    lane?: NbaLane;
    label: string;
  } | null>(null);
  // The columns of the most recent comparison. Its follow-up chips speak about
  // the whole set, but an NBA row only carries one product slug, so the set is
  // kept here instead.
  const lastCompareRef = useRef<{
    slugs: string[];
    recommendedSlug: string;
    /** Chips already used, so re-offering the row doesn't repeat them. */
    answered: string[];
  } | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Selecting a product moves focus to the composer (cursor blinking) so the
  // shopper can immediately ask about it; the placeholder names the product.
  // A selection change also resets the contextual thread so the tray shows its
  // entry pills again for the new selection.
  useEffect(() => {
    if (selectedSlugs.length > previousSelectedCountRef.current) {
      inputRef.current?.focus();
    }
    previousSelectedCountRef.current = selectedSlugs.length;
    setContextualThreadActive(false);
  }, [selectedSlugs]);

  /* ---------- mutation helpers ---------- */

  const appendMessage = useCallback(
    (rawMessage: ChatMessage, options: { keepContext?: boolean } = {}) => {
    const message = sanitizeAgentMessage(rawMessage);
    // A shopper turn that is not part of the open product thread closes it, so
    // the sticky chip stops labelling messages that have moved on and a later
    // return to the product earns a fresh divider. Only shopper turns count:
    // the agent messages that answer them belong to the turn that opened them.
    const closesContext =
      message.kind === "shopper_text" &&
      !options.keepContext &&
      lastSeparatorSlugRef.current !== null;
    if (closesContext) {
      lastSeparatorSlugRef.current = null;
    }
    const boundary: ChatMessage[] = closesContext
      ? [{ id: nextId("ctx-end"), kind: "context_end" }]
      : [];
    setMessages((current) => {
      // Only ever show the most recent NBA set: when a new one is appended,
      // drop any prior NBA sets so historical ones don't accumulate in the
      // scrollback or remain interactive after the conversation has moved on.
      if (message.kind === "agent_nbas") {
        return [
          ...current.filter((m) => m.kind !== "agent_nbas"),
          message,
        ];
      }
      // A new shopper utterance supersedes any pending follow-up prompts:
      // suggestion chips are transient affordances tied to the previous turn,
      // so clear stale NBA sets the instant the shopper proceeds (typed input,
      // NBA pill, contextual pill, or "Show more"). A fresh set may be appended
      // by the response that follows.
      if (message.kind === "shopper_text") {
        return [
          ...current.filter((m) => m.kind !== "agent_nbas"),
          ...boundary,
          message,
        ];
      }
      // Cart is a stage change (add-to-cart or cart FAB). Drop prior PDP/PLP
      // chips immediately so they don't linger under the cart while the
      // cart-stage NBA set is being appended.
      if (message.kind === "agent_cart") {
        return [
          ...current.filter((m) => m.kind !== "agent_nbas"),
          message,
        ];
      }
      return [...current, message];
    });
    },
    [],
  );

  const removeMessage = useCallback((id: string) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);

  const updateMessage = useCallback(
    (id: string, updater: (message: ChatMessage) => ChatMessage) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === id ? sanitizeAgentMessage(updater(message)) : message,
        ),
      );
    },
    [],
  );

  const scheduleResponse = useCallback(
    (handler: () => void, delay = RESPONSE_LATENCY_MS) => {
      const timeoutId = window.setTimeout(() => {
        pendingResponses.current = pendingResponses.current.filter(
          (entry) => entry.timeoutId !== timeoutId,
        );
        handler();
      }, delay);
      pendingResponses.current.push({ timeoutId, handler, delay });
    },
    [],
  );

  /**
   * Follows a card that is still writing itself. Chasing the end is right while
   * the card still fits the transcript, but a routine card outgrows it after a
   * step or two, and from then on the same move carries the shopper below the
   * acknowledgement they are reading. So the card's own top edge is the floor:
   * once it can no longer fit, it parks exactly where a tall card that lands
   * whole parks, and the rest of the routine flows on below.
   */
  const followStreamingCard = useCallback(() => {
    const node = chatRef.current;
    if (!node) return;
    // Resolved now rather than inside the frame: the reveal that calls this has
    // already queued the state update that drops `data-streaming`, so by the
    // time the DOM has grown there is nothing left to match.
    const cards = node.querySelectorAll<HTMLElement>('[data-streaming="true"]');
    const card = cards[cards.length - 1];
    if (!card) return;
    requestAnimationFrame(() => {
      node.scrollTo({
        top: Math.min(
          node.scrollHeight - node.clientHeight,
          cardTopScrollTarget(node, card),
        ),
        behavior: "smooth",
      });
    });
  }, []);

  /* ---------- pure render helpers (no shopper-text / loader prefix) ---------- */

  const renderPdpCard = useCallback(
    (slug: string) => {
      const product = getProductBySlug(slug);
      if (!product) return;
      appendMessage({
        id: nextId("pdp"),
        kind: "agent_pdp",
        productSlug: product.slug,
        images:
          product.gallery.length > 0
            ? product.gallery.map((url) => ({ url, alt: product.imageAlt }))
            : [{ url: product.imageUrl, alt: product.imageAlt }],
        title: product.title,
        price: product.priceFormatted,
        comparePrice: product.comparePriceFormatted ?? undefined,
        description:
          product.overview && !/^n\/a\b/i.test(product.overview.trim())
            ? product.overview
            : product.shortDescription,
        rating: product.rating ?? undefined,
        reviewCount: product.reviewCount ?? undefined,
        colors: product.swatches.slice(0, 3).map((color, index) => ({
          id: `color-${index}`,
          label: index === 0 ? "Default" : `Variant ${index + 1}`,
          color,
        })),
        sizes: productSizeOptions(product),
      });
    },
    [appendMessage, getProductBySlug],
  );

  const renderCartCard = useCallback(
    (slug: string, quantity: number): string | undefined => {
      const product = getProductBySlug(slug);
      if (!product) return undefined;

      // Accumulate into the shopper's existing cart rather than spawning a
      // fresh single-item card on every add. We fold the new item into the
      // most recent cart card, replacing it so only one up-to-date cart shows.
      const list = messagesRef.current;
      const previousCart = [...list]
        .reverse()
        .find((message): message is Extract<ChatMessage, { kind: "agent_cart" }> =>
          message.kind === "agent_cart",
        );

      const newItem = toCartItem(product, quantity);
      let items: AgentCartItem[];
      if (previousCart) {
        const existingIndex = previousCart.items.findIndex(
          (item) => item.id === newItem.id,
        );
        items =
          existingIndex >= 0
            ? previousCart.items.map((item, index) =>
                index === existingIndex
                  ? { ...item, quantity: item.quantity + quantity }
                  : item,
              )
            : [...previousCart.items, newItem];
      } else {
        items = [newItem];
      }

      const appliedPromo = previousCart?.appliedPromo;
      const cartCoupons = previousCart?.cartCoupons;
      const subtotal = items.reduce(
        (sum, item) => sum + cartItemUnitPrice(item) * item.quantity,
        0,
      );

      if (previousCart) removeMessage(previousCart.id);

      const id = nextId("cart");
      appendMessage({
        id,
        kind: "agent_cart",
        acknowledgement: `Got it, I added ${product.title} to your cart.`,
        summary: cartSummaryText(items, subtotal),
        items,
        lineItems: recomputeCartLineItems(items, appliedPromo),
        cartCoupons,
        appliedPromo,
      });
      return id;
    },
    [appendMessage, getProductBySlug, removeMessage],
  );

  // Surface the shopper's current cart as a fresh cart card at the bottom of
  // the conversation. Used by the context-island / cart FAB so a tap always
  // reads as a shopper turn ("Show my cart") and gets a cart-stage reply.
  const showCartCard = useCallback(() => {
    const list = messagesRef.current;
    const previousCart = [...list]
      .reverse()
      .find((message): message is Extract<ChatMessage, { kind: "agent_cart" }> =>
        message.kind === "agent_cart",
      );
    if (!previousCart) return;

    // Snapshot so the delayed response still has the cart even if the
    // prior card is removed before the loader finishes.
    const cartSnapshot = previousCart;

    appendMessage({
      id: nextId("shopper"),
      kind: "shopper_text",
      text: "Show my cart",
    });
    const loaderId = nextId("loader");
    appendMessage({ id: loaderId, kind: "agent_loader", variant: "thinking" });

    scheduleResponse(() => {
      removeMessage(loaderId);
      // Drop the older cart card if it's still in the transcript so we only
      // keep one up-to-date cart utterance.
      removeMessage(cartSnapshot.id);
      appendMessage({
        ...cartSnapshot,
        id: nextId("cart"),
        acknowledgement: "Here's your cart.",
      });

      const cartProducts = cartSnapshot.items
        .map((item) => getProductBySlug(item.id.replace(/^cart-/, "")))
        .filter((product): product is CatalogProduct => Boolean(product));
      if (cartProducts.length === 0) return;

      const primary = cartProducts[0];
      const items = buildStageNbas({
        stage: "cart",
        cartProducts,
        matchingBundle: findMatchingBundle(primary, products),
        catalog: products,
      });
      appendMessage(buildStageNbasMessage("cart", items));
      emitAssistantTelemetry("nba_impression", {
        stage: "cart",
        labels: items.map((item) => item.label),
        lanes: items.map((item) => item.lane),
      });
    });
  }, [
    appendMessage,
    getProductBySlug,
    products,
    removeMessage,
    scheduleResponse,
  ]);

  const renderRecentOrderSummary = useCallback(() => {
    const latestOrder = orderHistory[0];
    if (!latestOrder) {
      appendMessage({
        id: nextId("agent"),
        kind: "agent_simple",
        title: "Order tracking",
        body: "I couldn't find a recent order yet. Share an order ID and I'll check status.",
      });
      return;
    }

    const items = latestOrder.productSlugs
      .map((slug) => getProductBySlug(slug))
      .filter((product): product is CatalogProduct => Boolean(product))
      .slice(0, 2)
      .map((product) => toCartItem(product, 1));

    appendMessage({
      id: nextId("order"),
      kind: "agent_order",
      acknowledgement: `Order ${latestOrder.id} is ${latestOrder.status.toLowerCase()}.`,
      summary: TRACK_ORDER_BODY,
      items,
      lineItems: [
        { label: "Order ID", value: latestOrder.id },
        { label: "Status", value: latestOrder.status },
        { label: "Payment", value: latestOrder.paymentMethod },
        { label: "Order total", value: latestOrder.total, emphasis: true },
      ],
    });
  }, [appendMessage, getProductBySlug, orderHistory]);

  const applyPromoToCart = useCallback(
    (cartMessageId: string, code: string) => {
      const trimmed = code.trim().toUpperCase();
      if (!trimmed) return;

      const PROMO_DB: Record<string, { discount: number; label: string }> = {
        GLOW10: { discount: 0.1, label: "10% off" },
        GLOW20: { discount: 0.2, label: "20% off" },
      };

      const promo = PROMO_DB[trimmed];
      if (!promo) {
        appendMessage({
          id: nextId("agent"),
          kind: "agent_simple",
          body: `I couldn't find a promo named "${trimmed}". Try GLOW10 or GLOW20.`,
        });
        return;
      }

      let discountAmount = 0;
      updateMessage(cartMessageId, (message) => {
        if (message.kind !== "agent_cart") return message;
        const subtotal = message.items.reduce(
          (sum, item) => sum + cartItemUnitPrice(item) * item.quantity,
          0,
        );
        discountAmount = Math.round(subtotal * promo.discount * 100) / 100;
        const appliedPromo = { code: trimmed, fraction: promo.discount };
        const existingCoupons = (message.cartCoupons ?? []).filter(
          (existing) => existing !== trimmed,
        );
        return {
          ...message,
          appliedPromo,
          cartCoupons: [...existingCoupons, trimmed],
          lineItems: recomputeCartLineItems(message.items, appliedPromo),
          summary: `Promo applied. Your new estimated total is ${usd.format(Math.max(0, subtotal - discountAmount))}.`,
        };
      });

      appendMessage({
        id: nextId("agent"),
        kind: "agent_simple",
        body: `Nice! Promo "${trimmed}" applied (${promo.label}). You saved ${usd.format(discountAmount)}.`,
      });
    },
    [appendMessage, getProductBySlug, updateMessage],
  );

  const runCheckoutFlow = useCallback(
    (cartMessageId: string) => {
      const cart = messagesRef.current.find((m) => m.id === cartMessageId);
      if (!cart || cart.kind !== "agent_cart") return;

      const paymentLoaderId = nextId("loader");
      appendMessage({ id: paymentLoaderId, kind: "agent_loader", variant: "fetching_payment" });

      scheduleResponse(() => {
        removeMessage(paymentLoaderId);
        const completingId = nextId("loader");
        appendMessage({ id: completingId, kind: "agent_loader", variant: "completing_order" });

        scheduleResponse(() => {
          removeMessage(completingId);

          const firstItem = cart.items[0];
          const product = firstItem ? getProductBySlug(firstItem.id.replace(/^cart-/, "")) : undefined;
          if (!product || !firstItem) return;

          const subtotal = (product.price ?? 0) * firstItem.quantity;
          const tax = Math.round(subtotal * 0.0875 * 100) / 100;
          const total = subtotal + tax;
          const orderNumber = `SHI-${Math.floor(40000 + Math.random() * 9999)}`;

          appendMessage({
            id: nextId("order"),
            kind: "agent_order",
            acknowledgement: `Your order is confirmed! Order #${orderNumber}.`,
            summary: `Your new ${product.title} will arrive in 2-4 business days. Total: ${usd.format(total)}.`,
            items: cart.items,
            lineItems: buildOrderLineItems(product, firstItem.quantity),
          });

          const orderItems = buildStageNbas({
            stage: "order",
            orderProducts: [product],
            matchingBundle: findMatchingBundle(product, products),
            catalog: products,
          });
          appendMessage(buildStageNbasMessage("order", orderItems));
          emitAssistantTelemetry("nba_impression", {
            stage: "order",
            labels: orderItems.map((item) => item.label),
            lanes: orderItems.map((item) => item.lane),
          });

          const lastClick = lastStageNbaClickRef.current;
          if (lastClick) {
            emitAssistantTelemetry("nba_conversion", {
              conversion: "checkout",
              fromStage: lastClick.stage,
              fromLane: lastClick.lane,
              fromLabel: lastClick.label,
              productSlug: product.slug,
            });
            lastStageNbaClickRef.current = null;
          }
        }, 1500);
      });
    },
    [appendMessage, getProductBySlug, removeMessage, scheduleResponse],
  );

  /* ---------- user-facing handlers (rule-based path) ---------- */

  /**
   * Context for a PDP chip row. The FAQ pool minus whatever the shopper has
   * already asked about this product, so a row never re-offers an answered
   * question and keeps working through the pool across turns.
   */
  const buildPdpStageContext = useCallback(
    (product: CatalogProduct) => {
      const answered = answeredFaqsBySlugRef.current.get(product.slug);
      const faqLabels = [
        ...buildContextualFaqPool(product),
        REVIEWS_FAQ_LABEL,
      ].filter((label) => !answered?.has(label));
      return {
        stage: "pdp" as const,
        product,
        matchingBundle: findMatchingBundle(product, products),
        faqLabels,
      };
    },
    [products],
  );

  const handleProductSelect = useCallback(
    (slug: string) => {
      const product = getProductBySlug(slug);
      if (!product) return;

      appendMessage(
        {
          id: nextId("shopper"),
          kind: "shopper_text",
          text: `Tell me more about the ${product.title}`,
        },
        // Reading more about the product the open section is already about — the
        // chip itself does this — stays inside that section.
        { keepContext: slug === lastSeparatorSlugRef.current },
      );
      const loaderId = nextId("loader");
      appendMessage({ id: loaderId, kind: "agent_loader", variant: "answering" });

      scheduleResponse(() => {
        removeMessage(loaderId);
        renderPdpCard(slug);
        const items = buildStageNbas(buildPdpStageContext(product));
        const nbasMessage = buildStageNbasMessage("pdp", items, true, {
          productSlug: product.slug,
        });
        appendMessage(nbasMessage);
        emitAssistantTelemetry("nba_impression", {
          stage: "pdp",
          labels: items.map((item) => item.label),
          lanes: items.map((item) => item.lane),
        });
      });
    },
    [
      appendMessage,
      buildPdpStageContext,
      getProductBySlug,
      removeMessage,
      renderPdpCard,
      scheduleResponse,
    ],
  );

  const renderPlpCard = useCallback(
    (
      intro: string,
      slugs: string[],
      showMoreCard: boolean,
      options?: {
        remainingSlugs?: string[];
        searchTerm?: string;
        /** Runs when the products land, so a follow-up row is never shown
         *  attached to a card that has nothing in it yet. */
        onSettled?: () => void;
      },
    ) => {
      const valid = slugs
        .map((slug) => getProductBySlug(slug))
        .filter((p): p is CatalogProduct => Boolean(p));
      if (valid.length === 0) {
        options?.onSettled?.();
        return;
      }

      // The intro lands on its own first, with a placeholder standing in for the
      // row, so the shopper reads what the agent found while it is still laying
      // the products out.
      const plpId = nextId("plp");
      appendMessage({
        id: plpId,
        kind: "agent_plp",
        intro,
        products: [],
        showMoreCard,
        remainingSlugs: options?.remainingSlugs,
        searchTerm: options?.searchTerm,
        streaming: true,
      });

      scheduleResponse(() => {
        // The follow-up row lands in the same commit as the products, and on its
        // own the transcript would scroll for it twice.
        skipAutoScrollRef.current = true;
        updateMessage(plpId, (message) =>
          message.kind === "agent_plp"
            ? {
                ...message,
                products: valid.map((p) => toPlpProduct(p, handleProductSelect)),
                streaming: false,
              }
            : message,
        );
        options?.onSettled?.();
        followStreamingCard();
      }, PLP_REVEAL_MS);
    },
    [
      appendMessage,
      followStreamingCard,
      getProductBySlug,
      handleProductSelect,
      scheduleResponse,
      updateMessage,
    ],
  );

  // Broad-intent "routine" card: one acknowledgement + a section per routine
  // step. Each section's products are the top matches for that step's category
  // filtered by the detected skin type (with a category-only fallback so a
  // step never renders empty), split into a first page (5) + "Show more".
  const renderRoutineCard = useCallback(
    (routine: RoutineIntent) => {
      const sections: RoutineSection[] = [];

      for (const step of ROUTINE_STEPS) {
        const sectionIntent: Intent = {
          kind: "direct",
          rawQuery: routine.rawQuery,
          categories: [step.categoryKey],
          requiredTags: routine.skinType ? [routine.skinType] : undefined,
        };

        let ranked = pickRecommendations(
          filterProducts(sectionIntent, products),
          24,
          sectionIntent,
        );
        // Skin-type tags are sparse; if the hard filter zeroes the step, fall
        // back to a category-only pool so every routine step still populates.
        if (ranked.length === 0 && routine.skinType) {
          const categoryOnly: Intent = {
            kind: "direct",
            rawQuery: routine.rawQuery,
            categories: [step.categoryKey],
          };
          ranked = pickRecommendations(
            filterProducts(categoryOnly, products),
            24,
            categoryOnly,
          );
        }
        if (ranked.length === 0) continue;

        const firstPage = ranked.slice(0, PLP_PAGE_SIZE);
        const rest = ranked.slice(PLP_PAGE_SIZE);
        sections.push({
          stepLabel: step.stepLabel,
          categoryTitle: step.categoryTitle,
          categoryKey: step.categoryKey,
          description: buildRoutineSectionDescription(step.categoryKey, routine),
          products: firstPage.map((p) => toPlpProduct(p, handleProductSelect)),
          showMoreCard: rest.length > 0,
          remainingSlugs: rest.map((p) => p.slug),
        });
      }

      if (sections.length === 0) return false;

      // The card opens on the acknowledgement alone and then writes itself a
      // step at a time, so a five-step routine reads as being composed rather
      // than dropped in finished.
      const routineId = nextId("routine");
      appendMessage({
        id: routineId,
        kind: "agent_routine",
        acknowledgement: buildRoutineAcknowledgement(routine),
        sections: [],
        streaming: true,
      });

      sections.forEach((section, index) => {
        const isLast = index === sections.length - 1;
        scheduleResponse(
          () => {
            // Measured before the card grows: afterwards the distance always
            // reads as far from the end, and the card would never be followed.
            const node = chatRef.current;
            const wasAtBottom = node
              ? node.scrollHeight - node.scrollTop - node.clientHeight <=
                JUMP_TO_LATEST_SLACK_PX
              : false;

            if (isLast) {
              // The pill row lands in the same commit as the final section, and
              // on its own the transcript would read it as a short append and
              // jump to the end — dragging the start of a now very tall card off
              // screen. followStreamingCard takes that decision instead.
              skipAutoScrollRef.current = true;
            }
            updateMessage(routineId, (message) =>
              message.kind === "agent_routine"
                ? {
                    ...message,
                    sections: [...message.sections, section],
                    streaming: !isLast,
                  }
                : message,
            );
            if (isLast) appendMessage(buildNbasMessage(ROUTINE_FOLLOWUP_NBAS));

            if (wasAtBottom) followStreamingCard();
          },
          ROUTINE_STREAM_STEP_MS * (index + 1),
        );
      });
      return true;
    },
    [
      appendMessage,
      followStreamingCard,
      getProductBySlug,
      handleProductSelect,
      products,
      scheduleResponse,
      updateMessage,
    ],
  );

  const handleRoutineShowMore = useCallback(
    (routineMessageId: string, sectionIndex: number) => {
      updateMessage(routineMessageId, (message) => {
        if (message.kind !== "agent_routine") return message;
        const section = message.sections[sectionIndex];
        if (!section) return message;
        const remaining = section.remainingSlugs ?? [];
        if (remaining.length === 0) return message;

        const nextPage = remaining
          .slice(0, PLP_PAGE_SIZE)
          .map((slug) => getProductBySlug(slug))
          .filter((p): p is CatalogProduct => Boolean(p))
          .map((p) => toPlpProduct(p, handleProductSelect));
        const rest = remaining.slice(PLP_PAGE_SIZE);

        const sections = message.sections.map((existing, index) =>
          index === sectionIndex
            ? {
                ...existing,
                products: [...existing.products, ...nextPage],
                remainingSlugs: rest,
                showMoreCard: rest.length > 0,
              }
            : existing,
        );
        return { ...message, sections };
      });
    },
    [getProductBySlug, handleProductSelect, updateMessage],
  );

  const handleToggleSelect = useCallback((slug: string) => {
    setSelectedSlugs((current) =>
      current.includes(slug)
        ? current.filter((existing) => existing !== slug)
        : current.length >= MAX_SELECTED_PRODUCTS
          ? current
          : [...current, slug],
    );
  }, []);

  const handleRemoveSelected = useCallback((slug: string) => {
    setSelectedSlugs((current) => current.filter((existing) => existing !== slug));
  }, []);

  const handleShowMore = useCallback(
    (plpMessageId: string) => {
      const message = messagesRef.current.find((m) => m.id === plpMessageId);
      if (!message || message.kind !== "agent_plp") return;

      const remaining = message.remainingSlugs ?? [];
      if (remaining.length === 0) return;
      const term = message.searchTerm ?? "";

      // Consume the affordance on the source card so it can't be re-triggered.
      updateMessage(plpMessageId, (current) =>
        current.kind === "agent_plp"
          ? { ...current, showMoreCard: false, remainingSlugs: [] }
          : current,
      );

      appendMessage({
        id: nextId("shopper"),
        kind: "shopper_text",
        text: `Show more${term ? ` ${term}` : ""}`,
      });
      const loaderId = nextId("loader");
      appendMessage({ id: loaderId, kind: "agent_loader", variant: "answering" });

      scheduleResponse(() => {
        removeMessage(loaderId);
        const nextPage = remaining.slice(0, PLP_PAGE_SIZE);
        const rest = remaining.slice(PLP_PAGE_SIZE);
        renderPlpCard(
          term
            ? `Here are more options that match "${term}":`
            : "Here are a few more options:",
          nextPage,
          rest.length > 0,
          { remainingSlugs: rest, searchTerm: term },
        );
      });
    },
    [appendMessage, removeMessage, renderPlpCard, scheduleResponse, updateMessage],
  );

  const handleAddToCart = useCallback(
    (slug: string, quantity: number) => {
      const product = getProductBySlug(slug);
      if (!product) return;

      appendMessage(
        {
          id: nextId("shopper"),
          kind: "shopper_text",
          text: `Add ${quantity} × ${product.title} to my cart`,
        },
        // Buying the product the open section is about — what the chip's plus
        // does — belongs to that section rather than closing it.
        { keepContext: slug === lastSeparatorSlugRef.current },
      );
      const loaderId = nextId("loader");
      appendMessage({ id: loaderId, kind: "agent_loader", variant: "thinking" });

      const lastClick = lastStageNbaClickRef.current;
      if (lastClick) {
        emitAssistantTelemetry("nba_conversion", {
          conversion: "add_to_cart",
          fromStage: lastClick.stage,
          fromLane: lastClick.lane,
          fromLabel: lastClick.label,
          productSlug: slug,
        });
        lastStageNbaClickRef.current = null;
      }

      scheduleResponse(() => {
        removeMessage(loaderId);
        renderCartCard(slug, quantity);
        const items = buildStageNbas({
          stage: "cart",
          cartProducts: [product],
          matchingBundle: findMatchingBundle(product, products),
          catalog: products,
        });
        const nbasMessage = buildStageNbasMessage("cart", items);
        appendMessage(nbasMessage);
        emitAssistantTelemetry("nba_impression", {
          stage: "cart",
          labels: items.map((item) => item.label),
          lanes: items.map((item) => item.lane),
        });
      });
    },
    [appendMessage, getProductBySlug, products, removeMessage, renderCartCard, scheduleResponse],
  );

  const handleApplyPromo = useCallback(
    (cartMessageId: string, code: string) => {
      const trimmed = code.trim().toUpperCase();
      if (!trimmed) return;

      appendMessage({
        id: nextId("shopper"),
        kind: "shopper_text",
        text: `Apply promo code ${trimmed}`,
      });

      const loaderId = nextId("loader");
      appendMessage({ id: loaderId, kind: "agent_loader", variant: "thinking" });

      scheduleResponse(() => {
        removeMessage(loaderId);
        applyPromoToCart(cartMessageId, trimmed);
      });
    },
    [appendMessage, applyPromoToCart, removeMessage, scheduleResponse],
  );

  const handleCheckout = useCallback(
    (cartMessageId: string) => {
      appendMessage({
        id: nextId("shopper"),
        kind: "shopper_text",
        text: "Pay with Apple Pay",
      });
      runCheckoutFlow(cartMessageId);
    },
    [appendMessage, runCheckoutFlow],
  );

  const handleCartQuantityChange = useCallback(
    (cartMessageId: string, itemId: string, quantity: number) => {
      const nextQuantity = Math.max(1, quantity);
      // Quantity and totals commit together once the agent answers, so the card
      // never shows a new quantity against stale money. The steppers are held
      // meanwhile (see AgentCart's `updating`), so edits cannot pile up.
      setUpdatingCart({ cartId: cartMessageId, itemId });
      scheduleResponse(() => {
        updateMessage(cartMessageId, (message) => {
          if (message.kind !== "agent_cart") return message;
          const items = message.items.map((item) =>
            item.id === itemId ? { ...item, quantity: nextQuantity } : item,
          );
          const lineItems = recomputeCartLineItems(items, message.appliedPromo);
          const subtotal = items.reduce(
            (sum, item) => sum + cartItemUnitPrice(item) * item.quantity,
            0,
          );
          return {
            ...message,
            items,
            lineItems,
            summary: cartSummaryText(items, subtotal),
          };
        });
        setUpdatingCart((current) =>
          current?.cartId === cartMessageId && current.itemId === itemId
            ? null
            : current,
        );
      }, CART_UPDATE_LATENCY_MS);
    },
    [scheduleResponse, updateMessage],
  );

  const handleRemoveCartItem = useCallback(
    (cartMessageId: string, itemId: string) => {
      const cart = messagesRef.current.find((m) => m.id === cartMessageId);
      if (!cart || cart.kind !== "agent_cart") return;
      const remaining = cart.items.filter((item) => item.id !== itemId);

      if (remaining.length === 0) {
        const productName =
          cart.items.find((item) => item.id === itemId)?.title ?? "that item";

        // Turn the removal into a conversational turn: shopper utterance,
        // a "removing" latency loader, then a plain-text confirmation and
        // discovery pills so the shopper can continue.
        appendMessage({
          id: nextId("shopper"),
          kind: "shopper_text",
          text: `Remove ${productName}`,
        });
        // Convert the cart card into its "Got it, I added X" acknowledgement
        // line (kept in place) rather than deleting it. This preserves the
        // agent's response to the original add so the "Add" and "Remove"
        // shopper bubbles aren't left back-to-back, and — since it's no longer
        // an agent_cart — the next add starts a fresh cart card.
        updateMessage(cartMessageId, (message) =>
          message.kind === "agent_cart"
            ? {
                id: message.id,
                kind: "agent_simple",
                body:
                  message.acknowledgement ??
                  `Added ${productName} to your cart.`,
              }
            : message,
        );
        const loaderId = nextId("loader");
        appendMessage({ id: loaderId, kind: "agent_loader", variant: "removing" });
        scheduleResponse(() => {
          removeMessage(loaderId);
          appendMessage({
            id: nextId("agent"),
            kind: "agent_simple",
            body: `Removed ${productName} from your cart. Your cart is empty. Let me know what you wish to check out next.`,
          });
          appendMessage(buildNbasMessage(buildWelcomeNbas(0)));
        });
        return;
      }

      updateMessage(cartMessageId, (message) => {
        if (message.kind !== "agent_cart") return message;
        const items = message.items.filter((item) => item.id !== itemId);
        const lineItems = recomputeCartLineItems(items, message.appliedPromo);
        const subtotal = items.reduce(
          (sum, item) => sum + cartItemUnitPrice(item) * item.quantity,
          0,
        );
        return {
          ...message,
          items,
          lineItems,
          summary: cartSummaryText(items, subtotal),
        };
      });
    },
    [appendMessage, removeMessage, updateMessage, scheduleResponse],
  );

  const handleRemoveCartCoupon = useCallback(
    (cartMessageId: string, code: string) => {
      updateMessage(cartMessageId, (message) => {
        if (message.kind !== "agent_cart") return message;
        const cartCoupons = (message.cartCoupons ?? []).filter(
          (existing) => existing !== code,
        );
        const appliedPromo =
          message.appliedPromo?.code === code
            ? undefined
            : message.appliedPromo;
        const items = message.items;
        const subtotal = items.reduce(
          (sum, item) => sum + cartItemUnitPrice(item) * item.quantity,
          0,
        );
        return {
          ...message,
          cartCoupons,
          appliedPromo,
          lineItems: recomputeCartLineItems(items, appliedPromo),
          summary: cartSummaryText(items, subtotal),
        };
      });
    },
    [updateMessage],
  );

  /* ---------- OpenAI agent (optional) ---------- */

  const agentRef = useRef<OpenAIAgent | null>(null);
  if (agentRef.current === null && isLlmConfigured()) {
    agentRef.current = createOpenAIAgent({
      products,
      getProductBySlug: (slug) => getProductBySlug(slug),
    });
  }

  const findLatestCartId = useCallback((): string | undefined => {
    const list = messagesRef.current;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (list[i].kind === "agent_cart") return list[i].id;
    }
    return undefined;
  }, []);

  const applyAgentActions = useCallback(
    (actions: AgentAction[]) => {
      const sawSuggestNbas = actions.some((a) => a.type === "suggest_nbas");
      let lastPlpSlugs: string[] | undefined;
      let lastPdpProduct: CatalogProduct | undefined;
      let lastCartProduct: CatalogProduct | undefined;

      // A listing reveals its products a beat after this returns, so whatever
      // chip row the batch produces waits with it rather than attaching itself
      // to a card that is still a placeholder.
      const listingStreaming = actions.some(
        (action) => action.type === "show_product_listing",
      );
      const queued: Array<() => void> = [];
      const emitFollowUp = (work: () => void) => {
        if (listingStreaming) queued.push(work);
        else work();
      };

      for (const action of actions) {
        switch (action.type) {
          // `say` is intentionally not handled: free-form acknowledgements must
          // live inside the following card's intro (the main bubble), never as a
          // separate agent_simple bubble. `say` is already filtered upstream
          // before this runs; ignoring it here enforces that structurally.
          case "show_product_listing":
            renderPlpCard(
              action.intro,
              action.productSlugs,
              Boolean(action.showMoreCard),
              { onSettled: () => queued.splice(0).forEach((work) => work()) },
            );
            lastPlpSlugs = action.productSlugs;
            break;
          case "show_product_detail":
            renderPdpCard(action.productSlug);
            lastPdpProduct = getProductBySlug(action.productSlug);
            break;
          case "add_to_cart":
            renderCartCard(action.productSlug, action.quantity);
            lastCartProduct = getProductBySlug(action.productSlug);
            break;
          case "apply_promo": {
            const cartId = findLatestCartId();
            if (cartId) applyPromoToCart(cartId, action.code);
            break;
          }
          case "checkout": {
            const cartId = findLatestCartId();
            if (cartId) runCheckoutFlow(cartId);
            break;
          }
          case "suggest_nbas":
            emitFollowUp(() => appendMessage(buildNbasMessage(action.labels)));
            break;
        }
      }

      // Defensive default: if the agent emitted a stage-changing content action
      // but skipped `suggest_nbas`, fall back to stage-aware NBAs so the shopper
      // always has follow-up chips. The order/checkout flow appends its own
      // NBAs from inside `runCheckoutFlow`, so we don't double-emit there.
      if (sawSuggestNbas) return;

      if (lastCartProduct) {
        const cartProduct = lastCartProduct;
        emitFollowUp(() => {
          const items = buildStageNbas({
            stage: "cart",
            cartProducts: [cartProduct],
            matchingBundle: findMatchingBundle(cartProduct, products),
            catalog: products,
          });
          appendMessage(buildStageNbasMessage("cart", items));
          emitAssistantTelemetry("nba_impression", {
            stage: "cart",
            labels: items.map((item) => item.label),
            lanes: items.map((item) => item.lane),
          });
        });
        return;
      }

      if (lastPdpProduct) {
        const pdpProduct = lastPdpProduct;
        emitFollowUp(() => {
          const items = buildStageNbas(buildPdpStageContext(pdpProduct));
          appendMessage(
            buildStageNbasMessage("pdp", items, true, {
              productSlug: pdpProduct.slug,
            }),
          );
          emitAssistantTelemetry("nba_impression", {
            stage: "pdp",
            labels: items.map((item) => item.label),
            lanes: items.map((item) => item.lane),
          });
        });
        return;
      }

      if (lastPlpSlugs) {
        const plpSlugs = lastPlpSlugs;
        // Re-derive intent from the latest shopper message so the chips are
        // tuned to whatever the shopper just asked for.
        let latestShopperText = "";
        for (let i = messagesRef.current.length - 1; i >= 0; i -= 1) {
          const m = messagesRef.current[i];
          if (m.kind === "shopper_text") {
            latestShopperText = m.text;
            break;
          }
        }
        const intent = classifyIntent(latestShopperText);
        // Remember the intent behind this PLP so refinement pills can narrow it.
        activePlpIntentRef.current = intent;
        emitFollowUp(() => {
          const items = buildStageNbas({
            stage: "plp",
            intent,
            matchCount: plpSlugs.length,
            bundleProducts: findBundlesForIntent(intent, products),
          });
          appendMessage(buildStageNbasMessage("plp", items));
          emitAssistantTelemetry("nba_impression", {
            stage: "plp",
            labels: items.map((item) => item.label),
            lanes: items.map((item) => item.lane),
          });
        });
      }
    },
    [
      appendMessage,
      applyPromoToCart,
      buildPdpStageContext,
      findLatestCartId,
      getProductBySlug,
      products,
      renderCartCard,
      renderPdpCard,
      renderPlpCard,
      runCheckoutFlow,
    ],
  );

  /* ---------- shopper input + dispatch ---------- */

  // Shared PLP renderer: filter -> rank -> render carousel + plp NBAs (or a
  // no-match probing fallback). Records the intent behind the shown PLP so
  // refinement pills can narrow it while preserving category + filters.
  const renderRankedPlp = useCallback(
    (query: string, intent: Intent) => {
      activePlpIntentRef.current = intent;
      const matches = filterProducts(intent, products);
      const ranked = pickRecommendations(matches, matches.length, intent);
      const firstPage = ranked.slice(0, PLP_PAGE_SIZE);
      const rest = ranked.slice(PLP_PAGE_SIZE);

      if (firstPage.length === 0) {
        appendMessage({
          id: nextId("agent"),
          kind: "agent_simple",
          body: "I couldn't find an exact match. Let's narrow that down. What matters most to you?",
        });
        const probingItems = buildStageNbas({ stage: "probing", intent });
        appendMessage(buildStageNbasMessage("probing", probingItems));
        emitAssistantTelemetry("nba_impression", {
          stage: "probing",
          labels: probingItems.map((item) => item.label),
          lanes: probingItems.map((item) => item.lane),
        });
        return;
      }

      renderPlpCard(
        buildPlpIntro(query, intent, firstPage.length),
        firstPage.map((p) => p.slug),
        rest.length > 0,
        {
          remainingSlugs: rest.map((p) => p.slug),
          searchTerm: query,
          onSettled: () => {
            const plpItems = buildStageNbas({
              stage: "plp",
              intent,
              matchCount: matches.length,
              bundleProducts: findBundlesForIntent(intent, products),
            });
            appendMessage(buildStageNbasMessage("plp", plpItems));
            emitAssistantTelemetry("nba_impression", {
              stage: "plp",
              labels: plpItems.map((item) => item.label),
              lanes: plpItems.map((item) => item.lane),
            });
          },
        },
      );
    },
    [appendMessage, products, renderPlpCard],
  );

  const dispatchRuleBasedResponse = useCallback(
    (trimmed: string) => {
      const intent = classifyIntent(trimmed);
      const isOrderTrackingIntent =
        /\b(track|tracking|where\s+is|order\s+status|recent\s+order)\b/i.test(trimmed) &&
        /\border\b/i.test(trimmed);

      const hygieneTopic = classifyHygieneTopic(trimmed);
      if (hygieneTopic) {
        appendMessage({
          id: nextId("agent"),
          kind: "agent_simple",
          title: HYGIENE_TITLE[hygieneTopic],
          body: POLICY_BODIES[hygieneTopic],
        });
        appendMessage(buildNbasMessage(buildWelcomeNbas(0)));
        return;
      }

      if (isOrderTrackingIntent) {
        renderRecentOrderSummary();
        appendMessage(buildNbasMessage(ORDER_FOLLOWUP_NBAS));
        return;
      }

      // Broad intent (skin type / concern / routine cue, no explicit category):
      // synthesise the full multi-step routine card instead of a single carousel.
      // The card streams its own sections and appends the follow-up row when the
      // last one lands.
      const routine = detectRoutineIntent(trimmed);
      if (routine.isRoutine && renderRoutineCard(routine)) {
        return;
      }

      if (intent.kind === "broad" || intent.kind === "empty") {
        appendMessage({
          id: nextId("agent"),
          kind: "agent_simple",
          body: PROBING_FALLBACK_BODY,
        });
        const probingItems = buildStageNbas({ stage: "probing", intent });
        appendMessage(buildStageNbasMessage("probing", probingItems));
        emitAssistantTelemetry("nba_impression", {
          stage: "probing",
          labels: probingItems.map((item) => item.label),
          lanes: probingItems.map((item) => item.lane),
        });
        return;
      }

      renderRankedPlp(trimmed, intent);
    },
    [
      appendMessage,
      products,
      renderRankedPlp,
      renderRecentOrderSummary,
      renderRoutineCard,
    ],
  );

  // Refine the current PLP from a stage NBA pill: merge the active PLP intent
  // (category + budget/tier/tags) with the pill's added constraint, then
  // re-render directly - bypassing routine detection and the LLM so context is
  // never lost.
  const dispatchPlpRefinement = useCallback(
    (label: string) => {
      const base = activePlpIntentRef.current;
      const patch = classifyIntent(label);
      const requiredTags = Array.from(
        new Set([...(base?.requiredTags ?? []), ...(patch.requiredTags ?? [])]),
      );
      const merged: Intent = {
        kind: "direct",
        rawQuery: label,
        categories: base?.categories ?? patch.categories,
        categoryLabel: base?.categoryLabel ?? patch.categoryLabel,
        priceMax: patch.priceMax ?? base?.priceMax,
        priceMin: patch.priceMin ?? base?.priceMin,
        tier: patch.tier ?? base?.tier,
        includeBundles: Boolean(patch.includeBundles || base?.includeBundles),
        requiredTags: requiredTags.length > 0 ? requiredTags : undefined,
        activities: base?.activities,
      };

      appendMessage({ id: nextId("shopper"), kind: "shopper_text", text: label });
      const refinePlan = buildSearchLoaderPlan(label, { refinement: true });
      const loaderId = nextId("loader");
      appendMessage({
        id: loaderId,
        kind: "agent_loader",
        variant: "answering",
        steps: refinePlan.steps,
        stepIntervalMs: refinePlan.stepIntervalMs,
      });
      scheduleResponse(() => {
        removeMessage(loaderId);
        renderRankedPlp(label, merged);
      }, refinePlan.delayMs);
    },
    [appendMessage, removeMessage, renderRankedPlp, scheduleResponse],
  );

  const renderGuardrailResponse = useCallback(
    (kind: GuardrailKind) => {
      appendMessage({
        id: nextId("agent"),
        kind: "agent_simple",
        body: GUARDRAIL_BODIES[kind],
      });
      const labels = GUARDRAIL_NBAS[kind];
      if (labels.length > 0) {
        appendMessage(buildNbasMessage(labels, false));
      }
    },
    [appendMessage],
  );

  const dispatchShopperMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      appendMessage({ id: nextId("shopper"), kind: "shopper_text", text: trimmed });

      /* Unsafe, off-catalog and unreadable input never reaches intent
       * classification: `classifyIntent` has no way to say "I can't help with
       * that", so all three would land on the probing card as if the store
       * were about to find a match. The first scripted turn is deliberately
       * NOT consumed here, so a shopper whose opener was junk still gets it. */
      const guardrail = classifyGuardrail(trimmed);
      if (guardrail) {
        const guardrailLoaderId = nextId("loader");
        appendMessage({
          id: guardrailLoaderId,
          kind: "agent_loader",
          variant: "answering",
        });
        scheduleResponse(() => {
          removeMessage(guardrailLoaderId);
          renderGuardrailResponse(guardrail);
        }, GUARDRAIL_LATENCY_MS);
        return;
      }

      // Broad-intent routine requests are rendered deterministically as a
      // unified routine card on every turn, bypassing the LLM (which would
      // otherwise return a single-category listing for these queries).
      const routine = detectRoutineIntent(trimmed);

      const searchPlan = buildSearchLoaderPlan(trimmed);
      const loaderId = nextId("loader");
      appendMessage({
        id: loaderId,
        kind: "agent_loader",
        variant: "answering",
        steps: searchPlan.steps,
        // A routine turn holds the loader for a fraction of a discovery search,
        // so its steps have to advance faster or only the first one is read.
        stepIntervalMs: routine.isRoutine
          ? ROUTINE_LOADER_STEP_MS
          : searchPlan.stepIntervalMs,
      });

      if (routine.isRoutine) {
        firstShopperTurnHandledRef.current = true;
        scheduleResponse(() => {
          removeMessage(loaderId);
          // The card streams its sections and appends its own follow-up row.
          if (!renderRoutineCard(routine)) {
            dispatchRuleBasedResponse(trimmed);
          }
        }, ROUTINE_THINKING_MS);
        return;
      }

      if (!firstShopperTurnHandledRef.current) {
        firstShopperTurnHandledRef.current = true;
        scheduleResponse(() => {
          removeMessage(loaderId);
          dispatchRuleBasedResponse(trimmed);
        }, searchPlan.delayMs);
        return;
      }

      const agent = agentRef.current;
      if (agent) {
        agent
          .respond(trimmed)
          .then((actions) => {
            removeMessage(loaderId);

            // Enforce deterministic UI flow: ignore free-form model chatter and
            // only honor structured actions that map to designed cards/controls.
            const structuredActions = actions.filter((action) => action.type !== "say");
            if (structuredActions.length === 0) {
              dispatchRuleBasedResponse(trimmed);
              return;
            }
            applyAgentActions(structuredActions);
          })
          .catch((error) => {
            console.error("[SidecarAssistant] OpenAI agent failed", error);
            removeMessage(loaderId);
            // Fall back to the deterministic rule-based response silently so the
            // shopper sees a single utterance (the results intro), not a filler
            // "let me pull that together" line followed by the results.
            dispatchRuleBasedResponse(trimmed);
          });
        return;
      }

      scheduleResponse(() => {
        removeMessage(loaderId);
        dispatchRuleBasedResponse(trimmed);
      }, searchPlan.delayMs);
    },
    [
      appendMessage,
      applyAgentActions,
      dispatchRuleBasedResponse,
      removeMessage,
      renderGuardrailResponse,
      renderRoutineCard,
      scheduleResponse,
    ],
  );

  /** Contextual (selected-product) pills, routed conditionally:
   *  - Informational pills ("Is this waterproof?", "Ingredients") answer
   *    inline from catalog data via `resolveProductFaq` and keep the
   *    selection tray open for follow-ups.
   *  - "Show similar" renders a related-products carousel, then collapses
   *    the tray.
   *  - "Compare" renders a comparison table of the selected products, then
   *    collapses the tray. */
  const handleContextualPill = useCallback(
    (label: string, contextSlug?: string) => {
      // Contextual follow-up rows carry the product they're about, so they keep
      // resolving correctly even if the live selection changed or cleared since
      // the row was shown. Tray pills omit `contextSlug` and use the current
      // selection.
      const contextSlugs = contextSlug ? [contextSlug] : selectedSlugs;
      const selectedProducts = contextSlugs
        .map((slug) => getProductBySlug(slug))
        .filter((p): p is CatalogProduct => Boolean(p));
      const firstProduct = selectedProducts[0];

      // Any pill that isn't a dedicated action (Show similar / Compare) is a
      // product FAQ, answered locally from catalog data so it always returns a
      // single, product-grounded reply. Follow-ups move in-chat; the tray
      // collapses on pill tap / composer submit.
      if (firstProduct && !CONTEXTUAL_ACTION_LABELS.has(label)) {
        // Drop an in-chat context separator so the shopper always sees which
        // product the FAQ thread is about. Only insert one when the product
        // changes, so consecutive FAQs about the same product stay grouped
        // under a single divider.
        if (lastSeparatorSlugRef.current !== firstProduct.slug) {
          appendMessage({
            id: nextId("sep"),
            kind: "context_separator",
            productSlug: firstProduct.slug,
          });
          lastSeparatorSlugRef.current = firstProduct.slug;
        }
        // Record the asked FAQ so the follow-up row never re-offers it.
        const answered =
          answeredFaqsBySlugRef.current.get(firstProduct.slug) ??
          new Set<string>();
        answered.add(label);
        answeredFaqsBySlugRef.current.set(firstProduct.slug, answered);
        appendMessage(
          { id: nextId("shopper"), kind: "shopper_text", text: label },
          { keepContext: true },
        );
        const loaderId = nextId("loader");
        appendMessage({ id: loaderId, kind: "agent_loader", variant: "answering" });
        scheduleResponse(() => {
          removeMessage(loaderId);
          appendMessage({
            id: nextId("agent"),
            kind: "agent_simple",
            body: resolveProductFaq(firstProduct, label),
          });
          // Offer an in-chat follow-up row so the shopper can keep exploring
          // this product (still-unanswered FAQs) or move forward (add / show
          // similar). Answered questions are dropped so the row keeps
          // surfacing new ones until the pool is exhausted.
          appendMessage({
            id: nextId("nbas"),
            kind: "agent_nbas",
            contextual: true,
            productSlug: firstProduct.slug,
            regenerateButton: false,
            nbas: buildNbaItems(
              buildContextualFollowupLabels(firstProduct, answered),
              "nba-followup",
            ),
          });
          setContextualThreadActive(true);
        });
        return;
      }

      if (firstProduct && label === "Add to cart") {
        handleAddToCart(firstProduct.slug, 1);
        // Adding ends the contextual thread: clearing the selection closes the
        // tray and lets the cart-stage NBAs from handleAddToCart show.
        setSelectedSlugs([]);
        return;
      }

      if (firstProduct && label === "Show similar") {
        appendMessage({ id: nextId("shopper"), kind: "shopper_text", text: label });
        const loaderId = nextId("loader");
        appendMessage({ id: loaderId, kind: "agent_loader", variant: "answering" });
        scheduleResponse(() => {
          removeMessage(loaderId);
          const excluded = new Set(contextSlugs);
          const related: CatalogProduct[] = [];
          const seen = new Set<string>();
          for (const slug of contextSlugs) {
            // Pull a deep pool so the carousel can paginate the same way the
            // normal PLP flow does (first page + "Show more" for the rest).
            for (const candidate of getRelatedProducts(slug, 18)) {
              if (excluded.has(candidate.slug) || seen.has(candidate.slug)) {
                continue;
              }
              seen.add(candidate.slug);
              related.push(candidate);
            }
          }
          if (related.length === 0) {
            appendMessage({
              id: nextId("agent"),
              kind: "agent_simple",
              body: `I couldn't find close matches to the ${firstProduct.title} right now. Tell me what matters most and I'll keep looking.`,
            });
            return;
          }
          // Same 5+1 pagination as search results: show the first page and a
          // "Show more" card, then let handleShowMore reveal the rest in pages.
          const firstPage = related.slice(0, PLP_PAGE_SIZE);
          const rest = related.slice(PLP_PAGE_SIZE);
          renderPlpCard(
            `Here are a few options similar to the ${firstProduct.title}:`,
            firstPage.map((p) => p.slug),
            rest.length > 0,
            { remainingSlugs: rest.map((p) => p.slug) },
          );
          setSelectedSlugs([]);
        });
        return;
      }

      if (firstProduct && label === "Compare") {
        appendMessage({
          id: nextId("shopper"),
          kind: "shopper_text",
          text: buildCompareQuery(selectedProducts),
        });
        const loaderId = nextId("loader");
        appendMessage({ id: loaderId, kind: "agent_loader", variant: "answering" });
        scheduleResponse(() => {
          removeMessage(loaderId);
          const compareProducts = [...selectedProducts];
          const included = new Set(compareProducts.map((p) => p.slug));
          // Pad with related products so a single-selection compare still
          // produces a meaningful multi-column table.
          if (compareProducts.length < 2) {
            for (const candidate of getRelatedProducts(firstProduct.slug, 6)) {
              if (included.has(candidate.slug)) continue;
              included.add(candidate.slug);
              compareProducts.push(candidate);
              if (compareProducts.length >= MAX_SELECTED_PRODUCTS) break;
            }
          }
          const comparedProducts = compareProducts.slice(0, MAX_SELECTED_PRODUCTS);
          const columns = comparedProducts.map(toCompareColumn);
          if (columns.length < 2) {
            appendMessage({
              id: nextId("agent"),
              kind: "agent_simple",
              body: `I need at least two products to compare. Select another item and I'll line them up side by side.`,
            });
            return;
          }
          const otherCount = comparedProducts.length - 1;
          const recommended = [...comparedProducts].sort(
            (a, b) =>
              (b.rating ?? 0) - (a.rating ?? 0) ||
              (b.reviewCount ?? 0) - (a.reviewCount ?? 0),
          )[0];
          const recommendation =
            recommended.rating != null
              ? `I'd recommend the ${recommended.title}. It has the highest rating (${recommended.rating.toFixed(1)}${recommended.reviewCount != null ? ` from ${recommended.reviewCount} reviews` : ""}) and is priced at ${recommended.priceFormatted}.`
              : `I'd recommend the ${recommended.title}, priced at ${recommended.priceFormatted}.`;
          appendMessage({
            id: nextId("compare"),
            kind: "agent_compare",
            intro: `Here's a side-by-side comparison of ${firstProduct.title} and ${otherCount} other ${otherCount === 1 ? "item" : "items"}.`,
            columns,
            rows: buildCompareRows(comparedProducts),
            recommendation,
            recommendedSlug: recommended.slug,
          });
          // The table answers "how do they differ on paper" and offers a
          // per-column add, so the follow-up row covers what it can't: the
          // reasoning behind the pick, fit, and whether two of them pair up.
          lastCompareRef.current = {
            slugs: comparedProducts.map((product) => product.slug),
            recommendedSlug: recommended.slug,
            answered: [],
          };
          const compareNbas = buildStageNbas({
            stage: "compare",
            products: comparedProducts,
            recommended,
            inCartSlugs: cartSlugsFromMessages(messagesRef.current),
          });
          appendMessage(
            buildStageNbasMessage("compare", compareNbas, false, {
              productSlug: recommended.slug,
            }),
          );
          emitAssistantTelemetry("nba_impression", {
            stage: "compare",
            labels: compareNbas.map((item) => item.label),
            lanes: compareNbas.map((item) => item.lane),
          });
          setSelectedSlugs([]);
        });
        return;
      }

      dispatchShopperMessage(label);
    },
    [
      selectedSlugs,
      getProductBySlug,
      getRelatedProducts,
      renderPlpCard,
      appendMessage,
      scheduleResponse,
      removeMessage,
      dispatchShopperMessage,
      handleAddToCart,
    ],
  );

  /** "Ask me anything" (the PDP `open` pill) carries no actual question, so it
   * opens a product-scoped thread instead of answering: the same divider +
   * shopper turn shape as a contextual FAQ, then an invitation and the
   * product's FAQ pills. Marking the row contextual keeps tapped pills and
   * typed follow-ups scoped to this product. */
  const startOpenQuestionThread = useCallback(
    (product: CatalogProduct, prompt: string) => {
      if (lastSeparatorSlugRef.current !== product.slug) {
        appendMessage({
          id: nextId("sep"),
          kind: "context_separator",
          productSlug: product.slug,
        });
        lastSeparatorSlugRef.current = product.slug;
      }
      appendMessage(
        { id: nextId("shopper"), kind: "shopper_text", text: prompt },
        { keepContext: true },
      );
      const loaderId = nextId("loader");
      appendMessage({ id: loaderId, kind: "agent_loader", variant: "answering" });
      scheduleResponse(() => {
        removeMessage(loaderId);
        appendMessage({
          id: nextId("agent"),
          kind: "agent_simple",
          body: `Shoot any question you have about the ${product.title} and I'll try to get it answered for you.`,
        });
        appendMessage({
          id: nextId("nbas"),
          kind: "agent_nbas",
          contextual: true,
          productSlug: product.slug,
          regenerateButton: false,
          nbas: buildNbaItems(
            buildContextualFollowupLabels(product, new Set<string>()),
            "nba-followup",
          ),
        });
        setContextualThreadActive(true);
      });
    },
    [appendMessage, removeMessage, scheduleResponse],
  );

  /** A PDP hygiene pill ("What's the return policy?"). The answer is
   * store-wide rather than product-specific, but the shopper asked it while
   * looking at one product, so the turn opens the same context divider a
   * product FAQ would and hands back that product's follow-ups instead of
   * dropping them into generic discovery. */
  const startPolicyThread = useCallback(
    (product: CatalogProduct, prompt: string) => {
      if (lastSeparatorSlugRef.current !== product.slug) {
        appendMessage({
          id: nextId("sep"),
          kind: "context_separator",
          productSlug: product.slug,
        });
        lastSeparatorSlugRef.current = product.slug;
      }
      appendMessage(
        { id: nextId("shopper"), kind: "shopper_text", text: prompt },
        { keepContext: true },
      );
      const loaderId = nextId("loader");
      appendMessage({ id: loaderId, kind: "agent_loader", variant: "answering" });
      const topic = classifyHygieneTopic(prompt) ?? "return";
      scheduleResponse(() => {
        removeMessage(loaderId);
        appendMessage({
          id: nextId("agent"),
          kind: "agent_simple",
          title: HYGIENE_TITLE[topic],
          body: POLICY_BODIES[topic],
        });
        appendMessage({
          id: nextId("nbas"),
          kind: "agent_nbas",
          contextual: true,
          productSlug: product.slug,
          regenerateButton: false,
          nbas: buildNbaItems(
            buildContextualFollowupLabels(
              product,
              answeredFaqsBySlugRef.current.get(product.slug) ?? new Set<string>(),
            ),
            "nba-followup",
          ),
        });
        setContextualThreadActive(true);
      });
    },
    [appendMessage, removeMessage, scheduleResponse],
  );

  /** Follow-ups under a comparison table. They speak about every column, so
   * the compared set comes from `lastCompareRef` rather than the row's single
   * product slug, and the answers are catalog-derived so they hold without an
   * API key. */
  const handleComparePill = useCallback(
    (label: string) => {
      const snapshot = lastCompareRef.current;
      const compared = (snapshot?.slugs ?? [])
        .map((slug) => getProductBySlug(slug))
        .filter((product): product is CatalogProduct => Boolean(product));
      const recommended = snapshot
        ? getProductBySlug(snapshot.recommendedSlug)
        : undefined;
      // Without the compared set there is nothing grounded to say, so let the
      // label take the normal free-text path.
      if (!snapshot || compared.length < 2 || !recommended) {
        dispatchShopperMessage(label);
        return;
      }

      if (/^add the /i.test(label)) {
        handleAddToCart(recommended.slug, 1);
        return;
      }

      // A stage row is consumed on click, so re-offer what's left of it after
      // the answer — otherwise the comparison dead-ends again one turn later.
      lastCompareRef.current = {
        ...snapshot,
        answered: [...snapshot.answered, label.trim().toLowerCase()],
      };
      const offerRemainingPills = () => {
        const answered = new Set(lastCompareRef.current?.answered ?? []);
        const remaining = buildStageNbas({
          stage: "compare",
          products: compared,
          recommended,
          inCartSlugs: cartSlugsFromMessages(messagesRef.current),
        }).filter((item) => !answered.has(item.label.trim().toLowerCase()));
        if (remaining.length === 0) return;
        appendMessage(
          buildStageNbasMessage("compare", remaining, false, {
            productSlug: recommended.slug,
          }),
        );
        emitAssistantTelemetry("nba_impression", {
          stage: "compare",
          labels: remaining.map((item) => item.label),
          lanes: remaining.map((item) => item.lane),
        });
      };

      appendMessage({ id: nextId("shopper"), kind: "shopper_text", text: label });
      const loaderId = nextId("loader");
      appendMessage({ id: loaderId, kind: "agent_loader", variant: "answering" });

      if (/^show a cheaper option/i.test(label)) {
        scheduleResponse(() => {
          removeMessage(loaderId);
          const spread = priceSpread(compared);
          // The chip only shows when the pick isn't the cheapest column, so
          // "cheaper" means cheaper than the pick, not than the whole table.
          const ceiling = recommended.price ?? 0;
          const comparedSlugs = new Set(compared.map((product) => product.slug));
          const cheaper = products
            .filter(
              (product) =>
                product.category === recommended.category &&
                !comparedSlugs.has(product.slug) &&
                (product.price ?? 0) > 0 &&
                (product.price ?? 0) < ceiling,
            )
            .sort(
              (a, b) =>
                (b.rating ?? 0) - (a.rating ?? 0) ||
                (a.price ?? 0) - (b.price ?? 0),
            );
          if (cheaper.length === 0) {
            appendMessage({
              id: nextId("agent"),
              kind: "agent_simple",
              body: buildNoCheaperAnswer(spread?.cheapest ?? recommended),
            });
            offerRemainingPills();
            return;
          }
          const firstPage = cheaper.slice(0, PLP_PAGE_SIZE);
          const rest = cheaper.slice(PLP_PAGE_SIZE);
          renderPlpCard(
            `Here's what comes in under ${recommended.priceFormatted}:`,
            firstPage.map((product) => product.slug),
            rest.length > 0,
            {
              remainingSlugs: rest.map((product) => product.slug),
              onSettled: offerRemainingPills,
            },
          );
        });
        return;
      }

      const fitSkinType = skinTypeFromFitLabel(label);
      const body = /^why the /i.test(label)
        ? buildCompareRationale(compared, recommended)
        : fitSkinType
          ? buildCompareFitAnswer(compared, fitSkinType)
          : /^can i use both/i.test(label)
            ? buildUseBothAnswer(compared)
            : buildCompareDifferenceAnswer(compared);

      scheduleResponse(() => {
        removeMessage(loaderId);
        appendMessage({ id: nextId("agent"), kind: "agent_simple", body });
        offerRemainingPills();
      });
    },
    [
      appendMessage,
      dispatchShopperMessage,
      getProductBySlug,
      handleAddToCart,
      products,
      removeMessage,
      renderPlpCard,
      scheduleResponse,
    ],
  );

  // The row a turn falls back to when the flow that produced it didn't append
  // one: product context wins, then the cart, then a fresh probe.
  const buildFallbackNbaRow = useCallback((): ChatMessage => {
    const contextProductForRow =
      threadContextProduct ??
      (lastCompareRef.current
        ? getProductBySlug(lastCompareRef.current.recommendedSlug)
        : undefined);
    if (contextProductForRow) {
      const items = buildStageNbas(buildPdpStageContext(contextProductForRow));
      return buildStageNbasMessage("pdp", items, false, {
        productSlug: contextProductForRow.slug,
      });
    }

    const latestCart = [...messagesRef.current]
      .reverse()
      .find((message): message is Extract<ChatMessage, { kind: "agent_cart" }> =>
        message.kind === "agent_cart",
      );
    const cartProducts = cartSlugsFromMessages(messagesRef.current)
      .map((slug) => getProductBySlug(slug))
      .filter((product): product is CatalogProduct => Boolean(product));
    if (cartProducts.length > 0) {
      const items = buildStageNbas({
        stage: "cart",
        cartProducts,
        matchingBundle: findMatchingBundle(cartProducts[0], products),
        catalog: products,
      }).filter(
        // The promo chip is the likeliest reason this row is a fallback at
        // all, so don't hand it straight back after the code has landed.
        (item) => !(latestCart?.appliedPromo && /^apply promo/i.test(item.label)),
      );
      return buildStageNbasMessage("cart", items, false);
    }

    const items = buildStageNbas({
      stage: "probing",
      intent: activePlpIntentRef.current ?? undefined,
    });
    return buildStageNbasMessage("probing", items, false);
  }, [buildPdpStageContext, getProductBySlug, products, threadContextProduct]);

  /** The utterance a loader is answering, so a stopped turn can be replayed
   * under the same words. Only the run of messages immediately before the
   * loader counts - an older bubble further up belongs to a finished turn. */
  const promptBehindLoader = useCallback((loaderIndex: number) => {
    for (let index = loaderIndex - 1; index >= 0; index -= 1) {
      const message = messagesRef.current[index];
      if (message.kind === "shopper_text") return message.text;
      if (message.kind !== "context_separator" && message.kind !== "context_end") {
        return undefined;
      }
    }
    return undefined;
  }, []);

  /** "Stop" on the loader. Drops the work in flight and hands the turn back to
   * the shopper rather than leaving them watching a spinner that may never
   * resolve. */
  const handleCancelResponse = useCallback(() => {
    const pending = pendingResponses.current;
    pendingResponses.current = [];
    pending.forEach((entry) => window.clearTimeout(entry.timeoutId));

    const loaderIndex = messagesRef.current.findIndex(
      (message) => message.kind === "agent_loader",
    );
    const loaders = messagesRef.current.filter(
      (message) => message.kind === "agent_loader",
    );
    cancelledTurnRef.current = {
      prompt: loaderIndex >= 0 ? promptBehindLoader(loaderIndex) : undefined,
      loaders,
      responses: pending.map(({ handler, delay }) => ({ handler, delay })),
    };
    loaders.forEach((loader) => removeMessage(loader.id));
    // A cart edit rides its own timer with the steppers held; cancelling the
    // timer has to release them or the card stays locked.
    setUpdatingCart(null);
    // Cancelling a later turn drops the reveal a card was waiting on, and a card
    // left marked as streaming holds the composer shut for good. Settle what has
    // arrived; a list card with nothing in it is only a promise of products that
    // are no longer coming, so it goes.
    setMessages((current) =>
      current
        .filter(
          (message) =>
            !(
              message.kind === "agent_plp" &&
              message.streaming &&
              message.products.length === 0
            ),
        )
        .map((message) =>
          (message.kind === "agent_plp" || message.kind === "agent_routine") &&
          message.streaming
            ? { ...message, streaming: false }
            : message,
        ),
    );

    appendMessage({
      id: nextId("agent"),
      kind: "agent_simple",
      body: CANCELLED_TURN_BODY,
    });

    const row = buildFallbackNbaRow();
    const contextual = row.kind === "agent_nbas" ? row.nbas.slice(0, 2) : [];
    const cancelRow: ChatMessage = {
      ...(row as Extract<ChatMessage, { kind: "agent_nbas" }>),
      id: nextId("nbas"),
      nbas: [...buildNbaItems([RETRY_NBA_LABEL], "nba-retry"), ...contextual],
    };
    appendMessage(cancelRow);
    emitAssistantTelemetry("response_cancelled", {
      loaders: loaders.length,
      pending: pending.length,
      labels: cancelRow.kind === "agent_nbas"
        ? cancelRow.nbas.map((nba) => nba.label)
        : [],
    });
  }, [appendMessage, buildFallbackNbaRow, promptBehindLoader, removeMessage]);

  /** "Retry last". Puts the cancelled turn's own scheduled work back on the
   * clock, so the shopper gets the answer they stopped waiting for rather than
   * an approximation of it. */
  const retryCancelledTurn = useCallback(() => {
    const turn = cancelledTurnRef.current;
    cancelledTurnRef.current = null;
    if (!turn) return;
    emitAssistantTelemetry("response_retried", { prompt: turn.prompt });

    // Nothing was left to run (the answer landed as the shopper hit stop), so
    // re-ask instead of replaying an empty turn.
    if (turn.responses.length === 0) {
      if (turn.prompt) dispatchShopperMessage(turn.prompt);
      return;
    }

    if (turn.prompt) {
      appendMessage({
        id: nextId("shopper"),
        kind: "shopper_text",
        text: turn.prompt,
      });
    }
    // Same ids the pending handlers close over, so they still clear their own
    // loaders when they run.
    turn.loaders.forEach((loader) => appendMessage(loader));
    turn.responses.forEach(({ handler, delay }) => scheduleResponse(handler, delay));
  }, [appendMessage, dispatchShopperMessage, scheduleResponse]);

  const handleNbaSelect = useCallback(
    (messageId: string, label: string) => {
      if (label === RETRY_NBA_LABEL && cancelledTurnRef.current) {
        removeMessage(messageId);
        retryCancelledTurn();
        return;
      }
      if (messageId === welcomeNbasMessageIdRef.current) {
        const lane = getLandingNbaLane(label);
        emitAssistantTelemetry("landing_nba_click", {
          label,
          lane,
          refreshCount: welcomeRefreshCount,
        });
        lastStageNbaClickRef.current = { stage: "welcome", lane: undefined, label };
      } else {
        const parent = messagesRef.current.find((m) => m.id === messageId);
        if (parent?.kind === "agent_nbas" && parent.stage && parent.stage !== "welcome") {
          const lane = parent.laneByLabel?.[label];
          emitAssistantTelemetry("nba_click", {
            stage: parent.stage,
            lane,
            label,
          });
          lastStageNbaClickRef.current = { stage: parent.stage, lane, label };
        }
      }
      // PLP refinement/capture/cross-sell pills narrow the current result set
      // (keeping category + filters) rather than starting a fresh query, so
      // they never lose context or fall into the broad routine card.
      const clicked = messagesRef.current.find((m) => m.id === messageId);
      const clickedLane =
        clicked?.kind === "agent_nbas" ? clicked.laneByLabel?.[label] : undefined;
      const isPlpRefinement =
        clicked?.kind === "agent_nbas" &&
        clicked.stage === "plp" &&
        (clickedLane === "refinement" ||
          clickedLane === "capture" ||
          clickedLane === "crossSell");

      removeMessage(messageId);

      // Every PDP chip is about the product on the card above, so none of them
      // belong to the generic free-text probe: the upsell opens the bundle it
      // names, and everything else is a question for the FAQ resolver.
      if (
        clicked?.kind === "agent_nbas" &&
        clicked.stage === "pdp" &&
        clicked.productSlug
      ) {
        const slug = clicked.productSlug;
        const normalized = label.trim().toLowerCase();
        if (/^save more with/.test(normalized)) {
          const product = getProductBySlug(slug);
          const bundle = product
            ? findMatchingBundle(product, products)
            : undefined;
          if (bundle) {
            handleProductSelect(bundle.slug);
            return;
          }
        }
        if (
          /^show similar/.test(normalized) ||
          /^show more like this/.test(normalized)
        ) {
          handleContextualPill("Show similar", slug);
          return;
        }
        handleContextualPill(label, slug);
        return;
      }

      // Comparison follow-ups are about the whole table above, so they never
      // go through the single-product contextual handler.
      if (clicked?.kind === "agent_nbas" && clicked.stage === "compare") {
        handleComparePill(label);
        return;
      }

      if (isPlpRefinement && activePlpIntentRef.current?.categories?.length) {
        dispatchPlpRefinement(label);
        return;
      }
      dispatchShopperMessage(label);
    },
    [
      dispatchPlpRefinement,
      dispatchShopperMessage,
      getProductBySlug,
      handleComparePill,
      handleContextualPill,
      handleProductSelect,
      products,
      removeMessage,
      retryCancelledTurn,
      welcomeRefreshCount,
    ],
  );

  const handleNbaRegenerate = useCallback(
    (messageId: string) => {
      if (messageId !== welcomeNbasMessageIdRef.current) {
        return;
      }

      setWelcomeRefreshCount((current) => {
        const next = current + 1;
        const labels = buildWelcomeNbas(next);
        updateMessage(messageId, (message) => {
          if (message.kind !== "agent_nbas") return message;
          return {
            ...message,
            nbas: buildNbaItems(labels, "nba-welcome"),
          };
        });
        emitAssistantTelemetry("landing_nba_refresh", {
          refreshCount: next,
          labels,
        });
        return next;
      });
    },
    [updateMessage],
  );

  /* ---------- lifecycle ---------- */

  useEffect(() => {
    // A docked panel lives inside the page flow (like SideBySide), so Escape
    // must not tear it down; the layout owns close. When detached as a modal,
    // Escape re-docks it instead.
    if (docked) {
      if (!detached) return;
      const onDetachedKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          onToggleDetach?.();
        }
      };
      document.addEventListener("keydown", onDetachedKeyDown);
      return () => document.removeEventListener("keydown", onDetachedKeyDown);
    }
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, docked, detached, onToggleDetach]);

  // Lock background page scroll while the sidecar panel is open.
  // Skipped when docked: the docked panel reflows the page (grid column) and
  // sticks while the storefront scrolls, matching SideBySide.
  useEffect(() => {
    if (docked) return;
    if (!isOpen) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [isOpen, docked]);

  // Close the sidecar when the shopper clicks outside the panel.
  // Docked panels stay open regardless of outside clicks (layout owns close).
  useEffect(() => {
    if (docked) return;
    if (!isOpen) return;
    const onPointerDownCapture = (event: PointerEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      const path = event.composedPath?.() ?? [];
      const clickedInsidePanel =
        path.includes(panel) ||
        (event.target instanceof Node && panel.contains(event.target));
      if (!clickedInsidePanel) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDownCapture, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDownCapture, true);
  }, [isOpen, docked]);

  useEffect(() => {
    const onOpenRequested = () => setIsOpen(true);
    document.addEventListener("agentic:open-assistant", onOpenRequested);
    return () =>
      document.removeEventListener("agentic:open-assistant", onOpenRequested);
  }, []);

  const handleAskRequest = useCallback(
    (detail: AskAssistantEventDetail | undefined) => {
      const prompt = detail?.prompt?.trim();
      if (!prompt) return;
      const product = detail?.productSlug
        ? getProductBySlug(detail.productSlug)
        : undefined;
      const pillKind = detail?.pillKind;
      setIsOpen(true);
      // Defer one frame so the open-driven welcome seeding effect commits
      // first; otherwise the seeding clobbers the shopper turn we're about
      // to enqueue.
      window.requestAnimationFrame(() => {
        // PDP pills name their product, so keep them off the free-text path:
        // otherwise a prompt like "…about the Dark Spot and Wrinkle Smoothing
        // Serum" reads as a category search and answers with a serums carousel.
        if (product && pillKind === "open") {
          startOpenQuestionThread(product, prompt);
          return;
        }
        if (product && pillKind === "faq") {
          handleContextualPill(prompt, product.slug);
          return;
        }
        // Policy pills read as context-free once they land in the transcript,
        // so they carry their product across too.
        if (product && pillKind === "hygiene") {
          startPolicyThread(product, prompt);
          return;
        }
        dispatchShopperMessage(prompt);
      });
    },
    [
      dispatchShopperMessage,
      getProductBySlug,
      handleContextualPill,
      startOpenQuestionThread,
      startPolicyThread,
    ],
  );

  useEffect(() => {
    const onAskRequested = (event: Event) =>
      handleAskRequest((event as CustomEvent<AskAssistantEventDetail>).detail);
    document.addEventListener("agentic:ask-assistant", onAskRequested);
    return () =>
      document.removeEventListener("agentic:ask-assistant", onAskRequested);
  }, [handleAskRequest]);

  // A PDP pill clicked while the panel was closed fires before this component
  // mounts, so the layout hands the request over here instead. Held until the
  // welcome seeding has run, since that replaces the whole message list and
  // would otherwise wipe the thread we are about to append.
  const consumedAskTokenRef = useRef<number | null>(null);
  useEffect(() => {
    if (!pendingAsk || messages.length === 0) return;
    if (consumedAskTokenRef.current === pendingAsk.token) return;
    consumedAskTokenRef.current = pendingAsk.token;
    handleAskRequest(pendingAsk.detail);
    onPendingAskHandled?.();
  }, [pendingAsk, messages.length, handleAskRequest, onPendingAskHandled]);

  useEffect(() => {
    // The docked layout renders its own FAB, so the sidecar's own nudge
    // animation is not applicable there.
    if (docked) return;
    if (isOpen || hasUserOpenedFab) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    let collapseTimer: number | undefined;
    const intervalId = window.setInterval(() => {
      setIsNudging(true);
      collapseTimer = window.setTimeout(() => {
        setIsNudging(false);
      }, NUDGE_DURATION_MS);
    }, NUDGE_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      if (collapseTimer) window.clearTimeout(collapseTimer);
      setIsNudging(false);
    };
  }, [isOpen, hasUserOpenedFab, docked]);

  // Seed the welcome card the first time the panel opens.
  useEffect(() => {
    if (!isOpen) return;
    if (messages.length > 0) return;
    // UserTesting lock: one study chip only — testers click/type to reveal A/B.
    const welcomeLabels = userTestingLock
      ? [UT_WELCOME_NBA_LABEL]
      : buildWelcomeNbas(0);
    const welcomeNbasId = nextId("nbas");
    welcomeNbasMessageIdRef.current = welcomeNbasId;
    setWelcomeRefreshCount(0);
    firstShopperTurnHandledRef.current = false;
    const seedMessages: ChatMessage[] = [
      {
        id: nextId("welcome"),
        kind: "agent_simple",
        title: WELCOME_TITLE,
        body: WELCOME_BODY,
        imageUrl: `${import.meta.env.BASE_URL}Welcome_cover.jpeg`,
        imageAlt: "Welcome to the Shiseido store",
        showBrandLogo: true,
      },
      {
        id: welcomeNbasId,
        kind: "agent_nbas",
        regenerateButton: !userTestingLock,
        nbas: buildNbaItems(welcomeLabels, "nba-welcome"),
      },
    ];
    setMessages(seedMessages.map(sanitizeAgentMessage));
    emitAssistantTelemetry("landing_nba_impression", {
      labels: welcomeLabels,
      refreshCount: 0,
      thresholds: LANDING_NBA_SUCCESS_THRESHOLDS,
    });
  }, [isOpen, messages.length, userTestingLock]);

  // No agent turn should dead-end. Most flows append their own follow-up row;
  // this covers the ones that don't - policy and promo replies, "no matches",
  // and any answer that exhausts its own suggestions - once the turn has
  // settled, so the shopper always has somewhere to go next.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || !NEEDS_FOLLOW_UP_ROW.has(last.kind)) return;
    const timer = window.setTimeout(() => {
      // A scheduled response is still mid-flight, and it may well append the
      // row itself; its own message will re-run this effect either way.
      if (pendingResponses.current.length > 0) return;
      const settled = messagesRef.current;
      if (settled[settled.length - 1]?.id !== last.id) return;
      const row = buildFallbackNbaRow();
      appendMessage(row);
      if (row.kind === "agent_nbas" && row.stage) {
        emitAssistantTelemetry("nba_impression", {
          stage: row.stage,
          labels: row.nbas.map((nba) => nba.label),
          lanes: row.laneByLabel
            ? row.nbas.map((nba) => row.laneByLabel?.[nba.label])
            : [],
          fallback: true,
        });
      }
    }, NBA_FALLBACK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [messages, appendMessage, buildFallbackNbaRow]);

  // Hybrid auto-scroll:
  // - Small new cards stay bottom-oriented.
  // - Tall new card blocks reveal from their top edge.
  useEffect(() => {
    const node = chatRef.current;
    if (!node) return;
    const currentIds = messages.map((message) => message.id);
    const previousIds = previousMessageIdsRef.current;
    let commonPrefix = 0;
    while (
      commonPrefix < previousIds.length &&
      commonPrefix < currentIds.length &&
      previousIds[commonPrefix] === currentIds[commonPrefix]
    ) {
      commonPrefix += 1;
    }

    const appendedCount = currentIds.length - commonPrefix;
    if (appendedCount <= 0) {
      previousMessageIdsRef.current = currentIds;
      return;
    }
    // Claimed by whoever is already scrolling for this append, and only by a
    // commit that appended: an in-place update leaves the flag for the append
    // it was set for.
    if (skipAutoScrollRef.current) {
      skipAutoScrollRef.current = false;
      previousMessageIdsRef.current = currentIds;
      return;
    }

    const children = Array.from(node.children) as HTMLElement[];
    const appendedNodes = children.slice(-appendedCount);
    if (appendedNodes.length === 0) {
      previousMessageIdsRef.current = currentIds;
      return;
    }

    const viewportHeight = node.clientHeight;
    const appendedBlockHeight = appendedNodes.reduce(
      (total, child) => total + child.offsetHeight,
      0,
    );
    const hasTallCard = appendedNodes.some(
      (child) => child.offsetHeight > viewportHeight * TALL_CARD_VIEWPORT_RATIO,
    );

    const cleanupFns: Array<() => void> = [];

    if (hasTallCard || appendedBlockHeight > viewportHeight * TALL_CARD_VIEWPORT_RATIO) {
      // Regression guard:
      // Tall cards must start from chatTop + 16px so card headers are not hidden
      // under the assistant header (especially on mobile Safari after image reflow).
      const anchorNode =
        appendedNodes.find((child) => child.offsetHeight > viewportHeight * TALL_CARD_ANCHOR_RATIO) ??
        appendedNodes[0];
      const alignTallAnchor = () => {
        node.scrollTo({
          top: cardTopScrollTarget(node, anchorNode),
          behavior: "auto",
        });
      };

      alignTallAnchor();
      const rafA = window.requestAnimationFrame(alignTallAnchor);
      const rafB = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(alignTallAnchor);
      });
      const timeoutId = window.setTimeout(alignTallAnchor, TALL_CARD_SETTLE_TIMEOUT_MS);
      cleanupFns.push(() => window.cancelAnimationFrame(rafA));
      cleanupFns.push(() => window.cancelAnimationFrame(rafB));
      cleanupFns.push(() => window.clearTimeout(timeoutId));

      const mediaNodes = Array.from(anchorNode.querySelectorAll("img"));
      for (const media of mediaNodes) {
        if (media.complete) continue;
        const onMediaSettled = () => alignTallAnchor();
        media.addEventListener("load", onMediaSettled);
        media.addEventListener("error", onMediaSettled);
        cleanupFns.push(() => media.removeEventListener("load", onMediaSettled));
        cleanupFns.push(() => media.removeEventListener("error", onMediaSettled));
      }
    } else {
      node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
    }

    previousMessageIdsRef.current = currentIds;
    return () => {
      cleanupFns.forEach((cleanup) => cleanup());
    };
  }, [messages]);

  // Context dividers split the transcript into product sections, so track which
  // one the shopper has scrolled past and let the island mirror it like a sticky
  // section header. Re-runs on `messages` to pick up newly appended dividers.
  useEffect(() => {
    const node = chatRef.current;
    if (!node) return;
    // Auto-scrolls and late-loading images shift the transcript for a few
    // frames after a reply lands, which can park the first divider back below
    // the activation line even though the shopper never scrolled there. Blank
    // readings are therefore held briefly and only committed if they stick.
    let pendingBlank: number | null = null;
    const cancelPendingBlank = () => {
      if (pendingBlank !== null) {
        window.clearTimeout(pendingBlank);
        pendingBlank = null;
      }
    };
    const syncScrolledContext = (allowBlank = false) => {
      const separators = Array.from(
        node.querySelectorAll<HTMLElement>("[data-context-slug]"),
      );
      if (separators.length === 0) {
        cancelPendingBlank();
        setScrolledContextSlug(null);
        return;
      }
      // At the bottom the newest section is what the shopper is looking at,
      // even when it is too short to push its own divider up to the line.
      if (
        node.scrollHeight - node.clientHeight - node.scrollTop <=
        CONTEXT_SCROLL_BOTTOM_TOLERANCE_PX
      ) {
        cancelPendingBlank();
        setScrolledContextSlug(
          separators[separators.length - 1].dataset.contextSlug ?? null,
        );
        return;
      }
      const threshold =
        node.getBoundingClientRect().top + CONTEXT_SCROLL_ACTIVATION_PX;
      let active: string | null = null;
      // Dividers are in document order, so stop at the first one still below
      // the activation line.
      for (const separator of separators) {
        if (separator.getBoundingClientRect().top > threshold) break;
        active = separator.dataset.contextSlug ?? null;
      }
      if (active === null && !allowBlank) {
        if (pendingBlank === null) {
          pendingBlank = window.setTimeout(() => {
            pendingBlank = null;
            syncScrolledContext(true);
          }, CONTEXT_SCROLL_BLANK_DELAY_MS);
        }
        return;
      }
      cancelPendingBlank();
      setScrolledContextSlug(active);
    };
    const onScroll = () => syncScrolledContext();
    syncScrolledContext();
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelPendingBlank();
      node.removeEventListener("scroll", onScroll);
    };
  }, [messages]);

  // Sticky pins every separator the shopper has scrolled past to the same line,
  // where they would pile up — each chip casting its own shadow — and would go
  // on labelling the transcript after it has left the product. So show only the
  // chip that actually covers what is on screen: the last section marker above
  // the dock line, and nothing at all when that marker is a section's end.
  useEffect(() => {
    if (contextIsland) return;
    const node = chatRef.current;
    if (!node) return;
    const syncStickyHeaders = () => {
      const separators = Array.from(
        node.querySelectorAll<HTMLElement>(".sidecar-assistant__context-separator"),
      );
      if (separators.length === 0) return;
      const markers = Array.from(
        node.querySelectorAll<HTMLElement>(
          ".sidecar-assistant__context-separator, .sidecar-assistant__context-end",
        ),
      );
      // Separators clamp here, section ends scroll on past it.
      const dockLine =
        node.getBoundingClientRect().top +
        parseFloat(window.getComputedStyle(node).paddingTop);
      let current: HTMLElement | null = null;
      for (const marker of markers) {
        if (marker.getBoundingClientRect().top > dockLine + 1) break;
        current = marker.classList.contains("sidecar-assistant__context-separator")
          ? marker
          : null;
      }
      separators.forEach((separator) => {
        const docked = separator.getBoundingClientRect().top <= dockLine + 1;
        // `visibility` rather than `display`, so hiding one cannot shift the
        // transcript and feed back into the next reading. Separators still in
        // flow are left alone: they read as ordinary dividers down there.
        if (docked && separator !== current) {
          separator.dataset.superseded = "true";
        } else {
          delete separator.dataset.superseded;
        }
      });
    };
    const onScroll = () => syncStickyHeaders();
    syncStickyHeaders();
    // A reply lands before the auto-scroll has moved, so take a second reading
    // once the transcript has settled into its new position.
    const settleFrame = window.requestAnimationFrame(syncStickyHeaders);
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(settleFrame);
      node.removeEventListener("scroll", onScroll);
      node
        .querySelectorAll<HTMLElement>(".sidecar-assistant__context-separator")
        .forEach((separator) => delete separator.dataset.superseded);
    };
  }, [contextIsland, messages]);

  // Tall cards are anchored by their top rather than scrolled to the end, so the
  // transcript is often left with messages below the fold. Track that so the
  // jump-to-latest button can say so and offer the way down.
  useEffect(() => {
    const node = chatRef.current;
    if (!node) return;
    let showTimeout = 0;
    const syncDistanceFromEnd = () => {
      const distanceFromEnd = node.scrollHeight - node.clientHeight - node.scrollTop;
      if (distanceFromEnd <= JUMP_TO_LATEST_SLACK_PX) {
        window.clearTimeout(showTimeout);
        showTimeout = 0;
        setAwayFromLatest(false);
        return;
      }
      // Arriving at the end hides the button at once, but leaving it has to hold
      // for a moment, so a passing auto-scroll cannot blink the button.
      if (showTimeout) return;
      showTimeout = window.setTimeout(() => {
        showTimeout = 0;
        setAwayFromLatest(true);
      }, JUMP_TO_LATEST_SHOW_DELAY_MS);
    };
    const onScroll = () => syncDistanceFromEnd();
    syncDistanceFromEnd();
    // A reply lands before the auto-scroll has moved, so take a second reading
    // once the transcript has settled into its new position.
    const settleFrame = window.requestAnimationFrame(syncDistanceFromEnd);
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(settleFrame);
      window.clearTimeout(showTimeout);
      node.removeEventListener("scroll", onScroll);
    };
  }, [messages]);

  const jumpToLatest = () => {
    const node = chatRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  };

  // Clear pending response timers on unmount / close.
  useEffect(() => {
    return () => {
      pendingResponses.current.forEach((entry) =>
        window.clearTimeout(entry.timeoutId),
      );
      pendingResponses.current = [];
    };
  }, []);

  const handleFabClick = () => {
    setHasUserOpenedFab(true);
    setIsNudging(false);
    setIsOpen(true);
  };

  const simulateMobileKeyboard = docked && viewportMode === "mobile";

  // The composer holds while the agent is answering, the same way its cards
  // hold their controls mid-round-trip. The demo phone keeps typing enabled:
  // disabling the field would blur it and take the simulated keyboard down
  // with it after every send.
  // A card still writing itself is the agent talking, even though its loader is
  // already gone, so the composer stays held until the content lands.
  const agentReplying = useMemo(
    () =>
      messages.some(
        (message) =>
          message.kind === "agent_loader" ||
          ((message.kind === "agent_routine" || message.kind === "agent_plp") &&
            message.streaming === true),
      ),
    [messages],
  );
  const composerDisabled = agentReplying && !simulateMobileKeyboard;
  const composerDisabledRef = useRef(false);
  composerDisabledRef.current = composerDisabled;
  // Disabling the input blurs it, so remember that the shopper was mid-thought
  // and hand focus back once the answer lands.
  const composerHadFocusRef = useRef(false);
  useEffect(() => {
    if (composerDisabled) return;
    // The turn is over, so the sent utterance hands the field back empty.
    setSentDraft("");
    if (!composerHadFocusRef.current) return;
    composerHadFocusRef.current = false;
    inputRef.current?.focus({ preventScroll: true });
  }, [composerDisabled]);

  // The composer is a textarea so a long question wraps instead of scrolling
  // away to the right, which means its height has to follow its content. Reset
  // first: `scrollHeight` only ever grows against the height already set.
  useLayoutEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [inputValue, sentDraft, composerDisabled]);

  const dismissSimulatedKeyboard = () => {
    setSimKeyboardOpen(false);
    inputRef.current?.blur();
  };

  const submitComposer = () => {
    const value = inputValue.trim();
    if (!value) return false;
    setInputValue("");
    setSentDraft(value);

    /* Product-scoped routing answers anything it can't parse with the
     * product's own overview, so guarded input has to skip it: with a serum
     * selected, "show me guns" came back as that serum's description. */
    if (classifyGuardrail(value)) {
      dispatchShopperMessage(value);
      if (simulateMobileKeyboard) {
        dismissSimulatedKeyboard();
      }
      return true;
    }

    /* With a selection open, typed "compare" / "show similar" / FAQ copy
     * should take the same path as the tray pills — not the generic probe. */
    const contextualLabel = resolveContextualComposerLabel(
      value,
      selectedSlugs,
      getProductBySlug,
    );
    if (contextualLabel) {
      handleContextualPill(contextualLabel);
      setSelectedSlugs([]);
      if (simulateMobileKeyboard) {
        dismissSimulatedKeyboard();
      }
      return true;
    }

    /* Product-scoped free text (single selection, or an active FAQ thread
     * with context island product) goes through resolveProductFaq — so
     * "what sizes does it come in?" answers like the tray pills, instead
     * of falling through to the generic probing fallback. */
    const focusSlug =
      selectedSlugs.length === 1
        ? selectedSlugs[0]
        : contextualThreadActive && contextProduct
          ? contextProduct.slug
          : null;
    if (focusSlug) {
      handleContextualPill(value, focusSlug);
      setSelectedSlugs([]);
      if (simulateMobileKeyboard) {
        dismissSimulatedKeyboard();
      }
      return true;
    }

    dispatchShopperMessage(value);
    setSelectedSlugs([]);
    if (simulateMobileKeyboard) {
      dismissSimulatedKeyboard();
    }
    return true;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitComposer();
  };

  const insertSimulatedKey = (text: string) => {
    setInputValue((current) => `${current}${text}`);
  };

  const backspaceSimulatedKey = () => {
    setInputValue((current) => current.slice(0, -1));
  };

  const submitFromSimulatedKeyboard = () => {
    submitComposer();
  };

  /* When the simulated keyboard is open, a tap on an NBA/button first blurs
   * the input. If we collapse the keyboard on that blur, layout shifts and
   * the click never lands. Suppress the blur for interactive targets, let
   * their click handlers run, then dismiss the keyboard. */
  const isSimKeyboardChromeTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(".sim-ios-keyboard, .sidecar-assistant__input-shell, .sidecar-assistant__input"),
    );
  };

  const isSimKeyboardClickTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element) || isSimKeyboardChromeTarget(target)) {
      return false;
    }
    return Boolean(
      target.closest(
        "button, a, [role='button'], [role='menuitem'], label, summary",
      ),
    );
  };

  const handleSimKeyboardMouseDownCapture = (
    event: React.MouseEvent<HTMLElement>,
  ) => {
    if (!simKeyboardOpen) return;
    if (!isSimKeyboardClickTarget(event.target)) return;
    event.preventDefault();
  };

  const handleSimKeyboardClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!simKeyboardOpen) return;
    if (!isSimKeyboardClickTarget(event.target)) return;
    dismissSimulatedKeyboard();
  };

  /* ---------- render ---------- */

  const renderedMessages = useMemo(
    () =>
      messages.map((message) => {
        switch (message.kind) {
          case "agent_simple":
            return (
              <AgentSimpleUtterance
                key={message.id}
                title={message.title}
                body={message.body}
                imageUrl={message.imageUrl}
                imageAlt={message.imageAlt ?? ""}
                showBrandLogo={message.showBrandLogo}
              />
            );
          case "shopper_text":
            return (
              <div key={message.id} className="sidecar-assistant__user-row">
                <div className="sidecar-assistant__user-bubble">{message.text}</div>
              </div>
            );
          case "agent_loader":
            return (
              <LatencyLoader
                key={message.id}
                variant={message.variant}
                steps={message.steps}
                stepIntervalMs={message.stepIntervalMs}
                onCancel={handleCancelResponse}
              />
            );
          case "agent_plp":
            return (
              <AgentPLPCard
                key={message.id}
                intro={message.intro}
                products={message.products}
                showMoreCard={message.showMoreCard}
                onShowMore={() => handleShowMore(message.id)}
                selectedIds={selectedSet}
                onToggleSelect={handleToggleSelect}
                onAddToCart={(slug) => handleAddToCart(slug, 1)}
                selectionLimitReached={selectedSet.size >= MAX_SELECTED_PRODUCTS}
                streaming={message.streaming}
              />
            );
          case "agent_routine":
            return (
              <AgentRoutineCard
                key={message.id}
                acknowledgement={message.acknowledgement}
                sections={message.sections}
                onShowMore={(sectionIndex) =>
                  handleRoutineShowMore(message.id, sectionIndex)
                }
                selectedIds={selectedSet}
                onToggleSelect={handleToggleSelect}
                onAddToCart={(slug) => handleAddToCart(slug, 1)}
                selectionLimitReached={selectedSet.size >= MAX_SELECTED_PRODUCTS}
                accordion={accordionRecommendations}
                streaming={message.streaming}
              />
            );
          case "agent_pdp":
            return (
              <AgentPDPCard
                key={message.id}
                images={message.images}
                title={message.title}
                price={message.price}
                comparePrice={message.comparePrice}
                description={message.description}
                rating={message.rating}
                reviewCount={message.reviewCount}
                colors={message.colors}
                sizes={message.sizes}
                onAddToCart={({ quantity }) =>
                  handleAddToCart(message.productSlug, quantity)
                }
                onApplePay={() => handleAddToCart(message.productSlug, 1)}
              />
            );
          case "agent_compare":
            return (
              <AgentCompareCard
                key={message.id}
                intro={message.intro}
                columns={message.columns}
                rows={message.rows}
                recommendation={message.recommendation}
                recommendedSlug={message.recommendedSlug}
                onSelect={handleProductSelect}
                onAddToCart={(slug) => handleAddToCart(slug, 1)}
              />
            );
          case "agent_cart":
            return (
              <AgentCart
                key={message.id}
                acknowledgement={message.acknowledgement}
                summary={message.summary}
                items={message.items}
                lineItems={message.lineItems}
                cartCoupons={message.cartCoupons}
                onApplyPromo={(code) => handleApplyPromo(message.id, code)}
                onRemoveCoupon={(code) => handleRemoveCartCoupon(message.id, code)}
                onQuantityChange={(itemId, quantity) =>
                  handleCartQuantityChange(message.id, itemId, quantity)
                }
                onRemoveItem={(itemId) => handleRemoveCartItem(message.id, itemId)}
                updatingItemId={
                  updatingCart?.cartId === message.id
                    ? updatingCart.itemId
                    : null
                }
                onCheckout={() => handleCheckout(message.id)}
                onApplePay={() => handleCheckout(message.id)}
              />
            );
          case "agent_order":
            return (
              <AgentOrderSummary
                key={message.id}
                acknowledgement={message.acknowledgement}
                summary={message.summary}
                items={message.items}
                lineItems={message.lineItems}
              />
            );
          case "agent_nbas":
            return (
              <AgentNBAs
                key={message.id}
                nbas={message.nbas}
                regenerateButton={message.regenerateButton}
                className={
                  selectedSet.size > 0 && !message.contextual
                    ? "agent-nba__set--suppressed"
                    : undefined
                }
                onSelect={(nba) =>
                  message.contextual
                    ? handleContextualPill(nba.label, message.productSlug)
                    : handleNbaSelect(message.id, nba.label)
                }
                onRegenerate={() => handleNbaRegenerate(message.id)}
              />
            );
          case "context_separator": {
            const product = getProductBySlug(message.productSlug);
            if (!product) return null;
            // Nothing to choose between means nothing to open the card for: the
            // plus adds the product outright and only falls back to the product
            // card when a size has to be picked first.
            const hasVariants = productSizeOptions(product).length > 0;
            return (
              <div
                key={message.id}
                className="sidecar-assistant__context-separator"
                data-context-slug={message.productSlug}
              >
                <div className="sidecar-assistant__context-separator-chip">
                  {/* The thumb and title are one button rather than the whole
                      chip, which would nest the plus inside another button. */}
                  <button
                    type="button"
                    className="sidecar-assistant__context-separator-open"
                    aria-label={`More about ${product.title}`}
                    onClick={() => handleProductSelect(message.productSlug)}
                  >
                    <img
                      className="sidecar-assistant__context-separator-thumb"
                      src={product.imageUrl}
                      alt={product.imageAlt}
                    />
                    <span className="sidecar-assistant__context-separator-title">
                      {product.title}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="sidecar-assistant__context-separator-action"
                    aria-label={
                      hasVariants
                        ? `Choose a size for ${product.title}`
                        : `Add ${product.title} to cart`
                    }
                    onClick={() =>
                      hasVariants
                        ? handleProductSelect(message.productSlug)
                        : handleAddToCart(message.productSlug, 1)
                    }
                  >
                    <PlusIcon width={16} height={16} />
                  </button>
                </div>
              </div>
            );
          }
          case "context_end":
            return (
              <div
                key={message.id}
                className="sidecar-assistant__context-end"
                aria-hidden="true"
              />
            );
          default:
            return null;
        }
      }),
    [
      handleAddToCart,
      handleApplyPromo,
      handleCancelResponse,
      handleCartQuantityChange,
      handleCheckout,
      handleContextualPill,
      handleNbaRegenerate,
      handleNbaSelect,
      handleRemoveCartCoupon,
      handleRemoveCartItem,
      handleRoutineShowMore,
      handleShowMore,
      handleToggleSelect,
      handleProductSelect,
      getProductBySlug,
      selectedSet,
      messages,
      accordionRecommendations,
      updatingCart,
    ],
  );

  const handleCloseClick = () => {
    if (docked) {
      onRequestClose?.();
      return;
    }
    setIsOpen(false);
  };

  // Close the header options menu on outside click or Escape.
  useEffect(() => {
    if (!isMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  const handleClearChat = () => {
    setIsMenuOpen(false);
    pendingResponses.current.forEach((entry) =>
      window.clearTimeout(entry.timeoutId),
    );
    pendingResponses.current = [];
    cancelledTurnRef.current = null;
    welcomeNbasMessageIdRef.current = null;
    firstShopperTurnHandledRef.current = false;
    lastSeparatorSlugRef.current = null;
    lastCompareRef.current = null;
    answeredFaqsBySlugRef.current.clear();
    setWelcomeRefreshCount(0);
    setSelectedSlugs([]);
    setUpdatingCart(null);
    setSentDraft("");
    // Emptying the list lets the welcome-seed effect re-run and restore the
    // greeting card + NBA row, matching a fresh session.
    setMessages([]);
  };

  const handleSaveTranscript = () => {
    setIsMenuOpen(false);
    const transcript = buildTranscriptText(messagesRef.current);
    const blob = new Blob([transcript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    anchor.href = url;
    anchor.download = `shiseido-assistant-transcript-${stamp}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const panelBody = (
    <>
      <header className="sidecar-assistant__header">
        <div className="sidecar-assistant__header-title">
          <span className="sidecar-assistant__header-icon" aria-hidden="true">
            <SparkleIcon width={18} height={18} strokeWidth={1.5} />
          </span>
          <span className="sidecar-assistant__header-label">Beauty Advisor</span>
        </div>
        <div className="sidecar-assistant__header-actions">
          {/* With the island off the cart lives in the header rather than over
              the transcript, which leaves nothing floating between the shopper
              and what they are reading. Only immersive has the width to carry
              the island's totals beside the button. */}
          {!contextIsland && cartItemCount > 0 ? (
            <div className="sidecar-assistant__header-cart">
              {detached ? (
                <span className="sidecar-assistant__header-cart-summary">
                  {cartTotals.total ? (
                    <span className="sidecar-assistant__header-cart-total">
                      Total {cartTotals.total}
                    </span>
                  ) : null}
                  <span className="sidecar-assistant__header-cart-count">
                    {cartItemCount} item{cartItemCount === 1 ? "" : "s"}
                  </span>
                </span>
              ) : null}
              <button
                type="button"
                className="sidecar-assistant__header-btn sidecar-assistant__header-cart-btn"
                aria-label={`Cart: ${cartItemCount} item${cartItemCount === 1 ? "" : "s"}`}
                onClick={showCartCard}
              >
                <ShoppingCartIcon width={16} height={16} />
                <span className="sidecar-assistant__context-island-badge">
                  {cartItemCount}
                </span>
              </button>
            </div>
          ) : null}
          <div className="sidecar-assistant__menu" ref={menuRef}>
            <button
              type="button"
              className="sidecar-assistant__header-btn"
              aria-label="More options"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              <EllipsisVerticalIcon width={16} height={16} />
            </button>
            {isMenuOpen ? (
              <div className="sidecar-assistant__menu-popover" role="menu">
                <button
                  type="button"
                  className="sidecar-assistant__menu-item"
                  role="menuitem"
                  onClick={handleClearChat}
                >
                  <Trash2Icon width={16} height={16} aria-hidden="true" />
                  <span>Clear chat</span>
                </button>
                <button
                  type="button"
                  className="sidecar-assistant__menu-item"
                  role="menuitem"
                  onClick={handleSaveTranscript}
                >
                  <SaveIcon width={14} height={14} aria-hidden="true" />
                  <span>Save session transcript</span>
                </button>
              </div>
            ) : null}
          </div>
          {/* Immersive mode is desktop-only — SidecarDockLayout keeps the panel
              docked on mobile — so the toggle would be a dead control there. */}
          {viewportMode !== "mobile" ? (
            <button
              type="button"
              className="sidecar-assistant__header-btn sidecar-assistant__header-btn--detach"
              aria-label={detached ? "Dock assistant" : "Expand"}
              aria-pressed={detached}
              onClick={onToggleDetach}
            >
              {detached ? (
                <ShrinkIcon width={16} height={16} />
              ) : (
                <ExpandIcon width={16} height={16} />
              )}
            </button>
          ) : null}
          <button
            type="button"
            className="sidecar-assistant__header-btn"
            aria-label="Close assistant"
            onClick={handleCloseClick}
          >
            <CloseIcon width={16} height={16} />
          </button>
        </div>
      </header>

      <div className="sidecar-assistant__chat-area">
        <div
          className={`sidecar-assistant__chat${
            showContextIsland ? " sidecar-assistant__chat--with-island" : ""
          }${contextIsland ? "" : " sidecar-assistant__chat--sticky-context"}`}
          ref={chatRef}
        >
          {renderedMessages}
        </div>
        {showContextIsland ? (
          <div
            className={`sidecar-assistant__context-island${
              contextIslandEmpty
                ? " sidecar-assistant__context-island--empty"
                : ""
            }`}
          >
            {contextProduct ? (
              <div className="sidecar-assistant__context-island-product">
                <img
                  className="sidecar-assistant__context-island-thumb"
                  src={contextProduct.imageUrl}
                  alt={contextProduct.imageAlt}
                />
                <span className="sidecar-assistant__context-island-title">
                  {contextProduct.title}
                </span>
                <button
                  type="button"
                  className="sidecar-assistant__context-island-add"
                  aria-label={`Add ${contextProduct.title} to cart`}
                  onClick={() => handleAddToCart(contextProduct.slug, 1)}
                >
                  Add to cart
                </button>
              </div>
            ) : null}
            {cartItemCount > 0 ? (
              <div className="sidecar-assistant__context-island-cart-group">
                <span className="sidecar-assistant__context-island-cart-summary">
                  {cartTotals.total ? (
                    <span className="sidecar-assistant__context-island-cart-total">
                      Total {cartTotals.total}
                    </span>
                  ) : null}
                  <span className="sidecar-assistant__context-island-cart-count">
                    {cartItemCount} item{cartItemCount === 1 ? "" : "s"}
                  </span>
                </span>
                <button
                  type="button"
                  className="sidecar-assistant__context-island-cart"
                  aria-label={`Cart: ${cartItemCount} item${cartItemCount === 1 ? "" : "s"}`}
                  onClick={showCartCard}
                >
                  <ShoppingCartIcon width={20} height={20} />
                  <span className="sidecar-assistant__context-island-badge">
                    {cartItemCount}
                  </span>
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        {awayFromLatest ? (
          <button
            type="button"
            className="sidecar-assistant__jump-to-latest"
            aria-label="Jump to the latest message"
            onClick={jumpToLatest}
          >
            <ArrowDownIcon width={18} height={18} />
          </button>
        ) : null}
      </div>

      <form className="sidecar-assistant__input-bar" onSubmit={handleSubmit}>
        {selectedSlugs.length > 0 ? (
          <div className="sidecar-assistant__selection-tray">
            <div
              className="sidecar-assistant__selection-pills"
              role="list"
              aria-label="Selected products"
            >
              {selectedSlugs.map((slug) => {
                const product = getProductBySlug(slug);
                if (!product) return null;
                return (
                  <span
                    key={slug}
                    className="sidecar-assistant__selection-pill"
                    role="listitem"
                  >
                    <img
                      className="sidecar-assistant__selection-pill-thumb"
                      src={product.imageUrl}
                      alt={product.imageAlt}
                    />
                    <span className="sidecar-assistant__selection-pill-label">
                      {product.title}
                    </span>
                    <button
                      type="button"
                      className="sidecar-assistant__selection-pill-remove"
                      aria-label={`Remove ${product.title}`}
                      onClick={() => handleRemoveSelected(slug)}
                    >
                      <CloseIcon width={14} height={14} />
                    </button>
                  </span>
                );
              })}
            </div>
            {contextualThreadActive ? null : (
              <AgentNBAs
                className="agent-nba__set--scroll"
                nbas={contextualNbas}
                regenerateButton={false}
                onSelect={(nba) => {
                  handleContextualPill(nba.label);
                  setSelectedSlugs([]);
                  if (simulateMobileKeyboard) {
                    dismissSimulatedKeyboard();
                  }
                }}
              />
            )}
          </div>
        ) : null}
        <div
          className={`sidecar-assistant__input-shell${
            composerDisabled ? " sidecar-assistant__input-shell--disabled" : ""
          }`}
        >
          <textarea
            ref={inputRef}
            rows={1}
            className="sidecar-assistant__input"
            placeholder={inputPlaceholder}
            value={composerDisabled ? sentDraft : inputValue}
            disabled={composerDisabled}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
              // Shift+Enter is the only way to a second line by hand; the field
              // wraps a long question on its own.
              if (event.shiftKey) return;
              /* Explicit submit so Enter always sends, even when the demo
               * keyboard / inputMode=none interferes with native form Enter. */
              event.preventDefault();
              submitComposer();
            }}
            onFocus={() => {
              composerHadFocusRef.current = true;
              if (simulateMobileKeyboard) setSimKeyboardOpen(true);
            }}
            onBlur={() => {
              // The blur that disabling causes isn't the shopper leaving, so
              // it must not clear the flag that restores their focus.
              if (!composerDisabledRef.current) {
                composerHadFocusRef.current = false;
              }
              if (!simulateMobileKeyboard) return;
              /* Defer so keyboard key pointerdown / NBA mousedown preventDefault
               * can keep focus when the tap should both act and dismiss. */
              window.setTimeout(() => {
                if (document.activeElement === inputRef.current) return;
                /* If focus landed on a sim-keyboard key, keep the keyboard
                 * mounted and reclaim focus so the pending click can submit. */
                if (
                  document.activeElement instanceof Element &&
                  document.activeElement.closest(".sim-ios-keyboard")
                ) {
                  inputRef.current?.focus({ preventScroll: true });
                  return;
                }
                setSimKeyboardOpen(false);
              }, 0);
            }}
            inputMode={simulateMobileKeyboard ? "none" : undefined}
            aria-label="Ask the personal assistant"
          />
          <button
            type="submit"
            className="sidecar-assistant__send"
            aria-label="Send message"
            disabled={composerDisabled || !inputValue.trim()}
            onPointerDown={(event) => {
              /* Keep focus on the input through the click so blur does not
               * unmount the demo keyboard before submit lands. */
              if (simulateMobileKeyboard) event.preventDefault();
            }}
          >
            <SendHorizontalIcon width={20} height={20} />
          </button>
        </div>
        <p className="sidecar-assistant__disclaimer">
          AI generated content may be wrong. Refer to{" "}
          <a
            className="sidecar-assistant__disclaimer-link"
            href="https://www.salesforce.com/company/ethical-and-humane-use/how-we-build-trusted-ai/"
            target="_blank"
            rel="noopener noreferrer"
          >
            guidelines
          </a>
          .
        </p>
      </form>
      {simulateMobileKeyboard && simKeyboardOpen ? (
        <SimulatedIOSKeyboard
          onInsert={insertSimulatedKey}
          onBackspace={backspaceSimulatedKey}
          onReturn={submitFromSimulatedKeyboard}
          onDismiss={dismissSimulatedKeyboard}
        />
      ) : null}
    </>
  );

  // Docked mode: fill the panel supplied by SidecarDockLayout. No floating
  // overlay, no backdrop, no self-owned FAB. The layout drives open/close and
  // the grid reflow, so we always render the panel body here.
  if (docked) {
    return (
      <aside
        ref={panelRef}
        className={
          "sidecar-assistant sidecar-assistant--docked" +
          (simKeyboardOpen ? " sidecar-assistant--keyboard-open" : "")
        }
        role="complementary"
        aria-label="Beauty Advisor"
        onMouseDownCapture={handleSimKeyboardMouseDownCapture}
        onClick={handleSimKeyboardClick}
      >
        {panelBody}
      </aside>
    );
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        className={
          "sidecar-assistant__fab" +
          (isNudging ? " sidecar-assistant__fab--nudging" : "")
        }
        aria-label="Open Beauty Advisor"
        onClick={handleFabClick}
        onMouseEnter={() => setIsNudging(false)}
      >
        <SparkleIcon
          width={22}
          height={22}
          className="sidecar-assistant__fab-icon"
        />
        <span className="sidecar-assistant__fab-label" aria-hidden="true">
          glow with me
        </span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className="sidecar-assistant__backdrop"
        aria-label="Close assistant overlay"
        onClick={() => setIsOpen(false)}
      />
      <aside
        ref={panelRef}
        className="sidecar-assistant"
        role="complementary"
        aria-label="Beauty Advisor"
      >
        {panelBody}
      </aside>
    </>
  );
}

export default SidecarAssistant;
