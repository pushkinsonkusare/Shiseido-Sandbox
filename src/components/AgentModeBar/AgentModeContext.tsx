import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type AgentMode =
  | "assistant-only"
  | "side-by-side"
  | "basic-website";

export const AGENT_MODES: { id: AgentMode; label: string }[] = [
  { id: "basic-website", label: "Native Storefront" },
  { id: "assistant-only", label: "Sidecar assistant" },
  { id: "side-by-side", label: "Side by side assistant" },
];

export type DemoViewportMode = "desktop" | "mobile";

/** How the PDP inline widget responds to a shopper question: answer in place,
 *  or hand the conversation over to the assistant panel. */
export type PdpInlineWidgetType = "inline-answer" | "agent-redirect";

/** Where the PDP inline widget sits on the product page. */
export type PdpInlineWidgetPosition = "left-under-image" | "right-rail";

export const PDP_INLINE_WIDGET_TYPES: {
  id: PdpInlineWidgetType;
  label: string;
}[] = [
  { id: "agent-redirect", label: "Agent redirect" },
  { id: "inline-answer", label: "Inline answer" },
];

export const PDP_INLINE_WIDGET_POSITIONS: {
  id: PdpInlineWidgetPosition;
  label: string;
}[] = [
  { id: "left-under-image", label: "Left under image" },
  { id: "right-rail", label: "Right rail" },
];

/** Where selected-product pills and their NBA chips sit in the sidecar. */
export type ProductSelectionType = "drawer" | "in-chat";

export const PRODUCT_SELECTION_TYPES: {
  id: ProductSelectionType;
  label: string;
}[] = [
  { id: "drawer", label: "Drawer" },
  { id: "in-chat", label: "In chat" },
];

/** Single welcome NBA shown under UserTesting lock (`?ut=`). */
export const UT_WELCOME_NBA_LABEL = "Skincare for oily skin";

type UserTestingBootstrap = {
  userTestingLock: boolean;
  accordionRecommendations: boolean;
  viewportMode: DemoViewportMode;
  contextIsland: boolean;
  contextPill: boolean;
  productSelection: boolean;
  productSelectionType: ProductSelectionType;
  pdpInlineWidget: boolean;
  pdpInlineWidgetType: PdpInlineWidgetType;
  pdpInlineWidgetPosition: PdpInlineWidgetPosition;
};

type AgentModeContextValue = {
  mode: AgentMode;
  setMode: (mode: AgentMode) => void;
  viewportMode: DemoViewportMode;
  setViewportMode: (mode: DemoViewportMode) => void;
  /** When true, routine category recommendations render as a single-open accordion. */
  accordionRecommendations: boolean;
  setAccordionRecommendations: (enabled: boolean) => void;
  /** Context island feature toggle (behavior TBD). */
  contextIsland: boolean;
  setContextIsland: (enabled: boolean) => void;
  /** When true, the composer shows the "Asking about" product context pill. */
  contextPill: boolean;
  setContextPill: (enabled: boolean) => void;
  /** When true, selected-product pills follow `productSelectionType`. */
  productSelection: boolean;
  setProductSelection: (enabled: boolean) => void;
  /** Drawer = tray above the composer. In chat = pills inside the composer
   *  box, NBAs below it. Retained while the parent checkbox is off. */
  productSelectionType: ProductSelectionType;
  setProductSelectionType: (type: ProductSelectionType) => void;
  /** PDP inline widget feature toggle (behavior TBD). */
  pdpInlineWidget: boolean;
  setPdpInlineWidget: (enabled: boolean) => void;
  /** Sub-options of the above; only meaningful while `pdpInlineWidget` is on,
   *  and retained when it is off so re-checking restores the last pick. */
  pdpInlineWidgetType: PdpInlineWidgetType;
  setPdpInlineWidgetType: (type: PdpInlineWidgetType) => void;
  pdpInlineWidgetPosition: PdpInlineWidgetPosition;
  setPdpInlineWidgetPosition: (position: PdpInlineWidgetPosition) => void;
  /**
   * False while the PDP widget answers inline, which is the point of that
   * mode: it shows what the storefront looks like for a customer who never
   * bought the sidecar, so every entry point into the panel has to go.
   */
  sidecarAvailable: boolean;
  /**
   * True when the page was opened with `?ut=`. Locks the experience
   * for UserTesting (hides AgentModeBar, single welcome NBA).
   */
  userTestingLock: boolean;
};

const AgentModeContext = createContext<AgentModeContextValue | undefined>(undefined);

/* Hard defaults for every page load. By design, refreshing the
 * page ALWAYS resets the experience switcher to Sidecar assistant +
 * Desktop regardless of what the shopper picked in the previous
 * session — unless a UserTesting `?ut=` lock is present. */
const DEFAULT_AGENT_MODE: AgentMode = "assistant-only";
const DEFAULT_VIEWPORT_MODE: DemoViewportMode = "desktop";
const DEFAULT_ACCORDION_RECOMMENDATIONS = true;
const DEFAULT_CONTEXT_ISLAND = false;
const DEFAULT_CONTEXT_PILL = false;
const DEFAULT_PRODUCT_SELECTION = true;
const DEFAULT_PRODUCT_SELECTION_TYPE: ProductSelectionType = "in-chat";
const DEFAULT_PDP_INLINE_WIDGET = true;
const DEFAULT_PDP_INLINE_WIDGET_TYPE: PdpInlineWidgetType = "agent-redirect";
const DEFAULT_PDP_INLINE_WIDGET_POSITION: PdpInlineWidgetPosition =
  "left-under-image";

function parseFlag(raw: string | null, fallback: boolean): boolean {
  if (raw == null || raw.trim() === "") return fallback;
  const value = raw.trim().toLowerCase();
  if (value === "0" || value === "false" || value === "off" || value === "no") {
    return false;
  }
  if (value === "1" || value === "true" || value === "on" || value === "yes") {
    return true;
  }
  return fallback;
}

function unlockedBootstrap(): UserTestingBootstrap {
  return {
    userTestingLock: false,
    accordionRecommendations: DEFAULT_ACCORDION_RECOMMENDATIONS,
    viewportMode: DEFAULT_VIEWPORT_MODE,
    contextIsland: DEFAULT_CONTEXT_ISLAND,
    contextPill: DEFAULT_CONTEXT_PILL,
    productSelection: DEFAULT_PRODUCT_SELECTION,
    productSelectionType: DEFAULT_PRODUCT_SELECTION_TYPE,
    pdpInlineWidget: DEFAULT_PDP_INLINE_WIDGET,
    pdpInlineWidgetType: DEFAULT_PDP_INLINE_WIDGET_TYPE,
    pdpInlineWidgetPosition: DEFAULT_PDP_INLINE_WIDGET_POSITION,
  };
}

function readUserTestingBootstrap(): UserTestingBootstrap {
  if (typeof window === "undefined") return unlockedBootstrap();

  const params = new URLSearchParams(window.location.search);
  const utRaw = (params.get("ut") || "").trim().toLowerCase();
  const isLegacyA = utRaw === "a";
  const isLegacyB = utRaw === "b";
  /* Feature params apply even without a lock, so a link like
   * `?accordion=0` can be opened and confirmed in the switcher.
   * `?ut=` still hides the switcher for participant sessions. */

  const viewportRaw = (params.get("viewport") || "").trim().toLowerCase();
  const viewportOverride: DemoViewportMode | null =
    viewportRaw === "mobile" || viewportRaw === "desktop" ? viewportRaw : null;

  const selectionTypeRaw = (params.get("selectionType") || "").trim().toLowerCase();
  const selectionType: ProductSelectionType =
    selectionTypeRaw === "in-chat" || selectionTypeRaw === "drawer"
      ? selectionTypeRaw
      : DEFAULT_PRODUCT_SELECTION_TYPE;

  const pdpTypeRaw = (params.get("pdpType") || "").trim().toLowerCase();
  const pdpType: PdpInlineWidgetType =
    pdpTypeRaw === "inline-answer" || pdpTypeRaw === "agent-redirect"
      ? pdpTypeRaw
      : DEFAULT_PDP_INLINE_WIDGET_TYPE;

  const pdpPosRaw = (params.get("pdpPos") || "").trim().toLowerCase();
  const pdpPos: PdpInlineWidgetPosition =
    pdpPosRaw === "right-rail" || pdpPosRaw === "left-under-image"
      ? pdpPosRaw
      : DEFAULT_PDP_INLINE_WIDGET_POSITION;

  return {
    userTestingLock: Boolean(utRaw),
    accordionRecommendations: parseFlag(
      params.get("accordion"),
      isLegacyB ? false : isLegacyA ? true : DEFAULT_ACCORDION_RECOMMENDATIONS,
    ),
    viewportMode: viewportOverride ?? (isLegacyA || isLegacyB ? "mobile" : DEFAULT_VIEWPORT_MODE),
    contextIsland: parseFlag(params.get("island"), DEFAULT_CONTEXT_ISLAND),
    contextPill: parseFlag(params.get("pill"), DEFAULT_CONTEXT_PILL),
    productSelection: parseFlag(params.get("selection"), DEFAULT_PRODUCT_SELECTION),
    productSelectionType: selectionType,
    pdpInlineWidget: parseFlag(params.get("pdp"), DEFAULT_PDP_INLINE_WIDGET),
    pdpInlineWidgetType: pdpType,
    pdpInlineWidgetPosition: pdpPos,
  };
}

const UT_BOOTSTRAP = readUserTestingBootstrap();

export function AgentModeProvider({ children }: { children: ReactNode }) {
  /* No localStorage init for either piece of state: every refresh
   * starts from the hard defaults above (or UT lock from the URL).
   * The mid-session setters still work normally; they just don't
   * survive a reload. */
  const [mode, setMode] = useState<AgentMode>(DEFAULT_AGENT_MODE);
  const [viewportMode, setViewportMode] = useState<DemoViewportMode>(
    UT_BOOTSTRAP.viewportMode,
  );
  const [accordionRecommendations, setAccordionRecommendations] = useState<boolean>(
    UT_BOOTSTRAP.accordionRecommendations,
  );
  const [contextIsland, setContextIsland] = useState<boolean>(
    UT_BOOTSTRAP.contextIsland,
  );
  const [contextPill, setContextPill] = useState<boolean>(
    UT_BOOTSTRAP.contextPill,
  );
  const [productSelection, setProductSelection] = useState<boolean>(
    UT_BOOTSTRAP.productSelection,
  );
  const [productSelectionType, setProductSelectionType] =
    useState<ProductSelectionType>(UT_BOOTSTRAP.productSelectionType);
  const [pdpInlineWidget, setPdpInlineWidget] = useState<boolean>(
    UT_BOOTSTRAP.pdpInlineWidget,
  );
  const [pdpInlineWidgetType, setPdpInlineWidgetType] =
    useState<PdpInlineWidgetType>(UT_BOOTSTRAP.pdpInlineWidgetType);
  const [pdpInlineWidgetPosition, setPdpInlineWidgetPosition] =
    useState<PdpInlineWidgetPosition>(UT_BOOTSTRAP.pdpInlineWidgetPosition);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      viewportMode,
      setViewportMode,
      accordionRecommendations,
      setAccordionRecommendations,
      contextIsland,
      setContextIsland,
      contextPill,
      setContextPill,
      productSelection,
      setProductSelection,
      productSelectionType,
      setProductSelectionType,
      pdpInlineWidget,
      setPdpInlineWidget,
      pdpInlineWidgetType,
      setPdpInlineWidgetType,
      pdpInlineWidgetPosition,
      setPdpInlineWidgetPosition,
      sidecarAvailable: !(pdpInlineWidget && pdpInlineWidgetType === "inline-answer"),
      userTestingLock: UT_BOOTSTRAP.userTestingLock,
    }),
    [
      mode,
      viewportMode,
      accordionRecommendations,
      contextIsland,
      contextPill,
      productSelection,
      productSelectionType,
      pdpInlineWidget,
      pdpInlineWidgetType,
      pdpInlineWidgetPosition,
    ],
  );

  return <AgentModeContext.Provider value={value}>{children}</AgentModeContext.Provider>;
}

export function useAgentMode(): AgentModeContextValue {
  const ctx = useContext(AgentModeContext);
  if (!ctx) {
    throw new Error("useAgentMode must be used within an AgentModeProvider");
  }
  return ctx;
}
