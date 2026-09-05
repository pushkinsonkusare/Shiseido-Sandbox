import type {
  AgentNBA,
  AgentPLPProduct,
  AgentPDPColorOption,
  AgentPDPSizeOption,
  AgentCartItem,
  AgentCartLineItem,
  AgentCompareColumn,
  AgentCompareRow,
  AgentCompareSummaryProduct,
  LatencyLoaderVariant,
} from "../components";
import type { NbaLane, NbaStage } from "./flow";

/* =============================================================
 * Conversation message types rendered inside the SidecarAssistant
 * chat panel.  Each shape is a discriminated union variant keyed
 * by `kind` so the renderer can switch over them exhaustively.
 * ============================================================= */

export type ChatMessage =
  | AgentSimpleMessage
  | ShopperTextMessage
  | AgentLoaderMessage
  | AgentPlpMessage
  | AgentRoutineMessage
  | AgentPdpMessage
  | AgentCompareMessage
  | AgentCartMessage
  | AgentOrderMessage
  | AgentNbasMessage
  | ContextSeparatorMessage
  | ContextEndMessage;

/** In-chat divider that announces the product a contextual FAQ thread is
 * about. Rendered as a replacement for the context island when that feature
 * is off; its product updates as the FAQ context changes. */
export type ContextSeparatorMessage = {
  id: string;
  kind: "context_separator";
  productSlug: string;
};

/** Closes the product section a separator opened, dropped in when the thread
 * moves on to something that is not about that product. Renders as an invisible
 * marker whose only job is to let the sticky chip release at the right point. */
export type ContextEndMessage = {
  id: string;
  kind: "context_end";
};

export type AgentSimpleMessage = {
  id: string;
  kind: "agent_simple";
  title?: string;
  body: string;
  imageUrl?: string;
  imageAlt?: string;
  showBrandLogo?: boolean;
};

export type ShopperTextMessage = {
  id: string;
  kind: "shopper_text";
  text: string;
};

export type AgentLoaderMessage = {
  id: string;
  kind: "agent_loader";
  variant: LatencyLoaderVariant;
  /** Stages to walk through while the turn runs, in place of the variant's
   *  single line. Used by searches, which take long enough to narrate. */
  steps?: string[];
  /** How long each stage holds before the next one takes over. */
  stepIntervalMs?: number;
  /** Live override from an in-flight tool call. When set, the host should
   *  clear `steps` so the timer does not walk over this line. */
  label?: string;
};

export type AgentPlpMessage = {
  id: string;
  kind: "agent_plp";
  intro: string;
  products: AgentPLPProduct[];
  /** When true, append the "Show more" tile at the end of the carousel. */
  showMoreCard: boolean;
  /** Ranked-but-not-yet-shown product slugs, paged in by "Show more". */
  remainingSlugs?: string[];
  /** The shopper's original query, used for the "Show more <term>" bubble. */
  searchTerm?: string;
  /** True while the products are still arriving, which holds the placeholder in
   *  the card and the composer until the row lands. */
  streaming?: boolean;
};

/** One step of a broad-intent routine: a category header, a short
 * description, and a paged product carousel (5 + optional "Show more"). */
export type RoutineSection = {
  /** Step name shown in the header, e.g. "Cleanse". */
  stepLabel: string;
  /** Human category title, e.g. "Cleansers". */
  categoryTitle: string;
  /** Catalog category name, used to page in more products on "Show more". */
  categoryKey: string;
  /** Concern/skin-type aware description shown under the heading when the
   *  step is open. */
  description: string;
  /** One-line product cue shown while the step is folded. */
  cue: string;
  /** Products currently shown in this section's carousel. */
  products: AgentPLPProduct[];
  /** When true, append the "Show more" tile to this section's carousel. */
  showMoreCard: boolean;
  /** Ranked-but-not-yet-shown slugs for this section, paged in by "Show more". */
  remainingSlugs?: string[];
};

/** A unified broad-intent "routine" card: one acknowledgement followed by
 * ordered category sections, each with its own carousel. */
export type AgentRoutineMessage = {
  id: string;
  kind: "agent_routine";
  acknowledgement: string;
  sections: RoutineSection[];
  /** True while sections are still arriving, which keeps the skeleton in the
   *  card and the composer disabled until the turn really ends. */
  streaming?: boolean;
};

export type AgentPdpMessage = {
  id: string;
  kind: "agent_pdp";
  productSlug: string;
  images: { url: string; alt: string }[];
  title: string;
  price: string;
  comparePrice?: string;
  description?: string;
  rating?: number;
  reviewCount?: number;
  colors?: AgentPDPColorOption[];
  sizes?: AgentPDPSizeOption[];
};

export type AgentCompareMessage = {
  id: string;
  kind: "agent_compare";
  /** Body copy rendered above the comparison table or summaries. */
  intro: string;
  /**
   * Presentation stamped when the turn was built. `"summaries"` renders the
   * stacked product-summary card; omit or `"table"` keeps the attribute table.
   */
  variant?: "table" | "summaries";
  /** Products compared, one per table column (also used for title lookup). */
  columns: AgentCompareColumn[];
  /** Attribute rows for the table variant; empty for summaries. */
  rows: AgentCompareRow[];
  /** Per-product blocks for the summaries variant. */
  summaries?: AgentCompareSummaryProduct[];
  /** Optional closing recommendation shown beneath the comparison. */
  recommendation?: string;
  /** Slug of the recommended product, bolded inside the recommendation copy. */
  recommendedSlug?: string;
};

export type AgentCartMessage = {
  id: string;
  kind: "agent_cart";
  acknowledgement?: string;
  summary: string;
  items: AgentCartItem[];
  lineItems: AgentCartLineItem[];
  cartCoupons?: string[];
  /** Internal: the promo applied to the cart, retained so totals can be
   * recomputed when the shopper changes quantities or removes items. */
  appliedPromo?: { code: string; fraction: number };
};

export type AgentOrderMessage = {
  id: string;
  kind: "agent_order";
  acknowledgement?: string;
  summary: string;
  items: AgentCartItem[];
  lineItems: AgentCartLineItem[];
};

export type AgentNbasMessage = {
  id: string;
  kind: "agent_nbas";
  nbas: AgentNBA[];
  /** When true, the NBA refresh affordance is rendered. */
  regenerateButton?: boolean;
  /** Conversation stage that produced this set, used for telemetry. */
  stage?: NbaStage | "welcome";
  /** Map of label -> semantic lane for telemetry attribution. */
  laneByLabel?: Record<string, NbaLane>;
  /** When true, this is a selected-product follow-up row: it routes through the
   * contextual pill handler and stays visible even while a product is selected
   * (it is exempt from the selection-suppression applied to normal NBA rows). */
  contextual?: boolean;
  /** For contextual follow-up rows: the product the pills are about, so they
   * resolve correctly even if the live selection has since changed/cleared. */
  productSlug?: string;
};
