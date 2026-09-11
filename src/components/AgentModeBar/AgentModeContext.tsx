import { createContext, useContext, useLayoutEffect, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

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

/** How the sidecar renders a multi-product compare turn. */
export type CompareFeatureType = "side-by-side-table" | "product-summaries";

export const COMPARE_FEATURE_TYPES: {
  id: CompareFeatureType;
  label: string;
}[] = [
  { id: "side-by-side-table", label: "Side by side table" },
  { id: "product-summaries", label: "Product summaries" },
];

/** Single welcome NBA shown under UserTesting lock (`?ut=`). */
export const UT_WELCOME_NBA_LABEL = "Skincare for oily skin";

/** Optional canned demo thread from `?scenario=`. */
export type DemoScenario = "oily-routine" | "clarifying-pdp";

export function readDemoScenario(): DemoScenario | null {
  if (typeof window === "undefined") return null;
  const raw = (new URLSearchParams(window.location.search).get("scenario") || "")
    .trim()
    .toLowerCase();
  if (raw === "oily-routine" || raw === "oily") return "oily-routine";
  if (
    raw === "clarifying-pdp" ||
    raw === "cleanser-pdp" ||
    raw === "clarifying-foam"
  ) {
    return "clarifying-pdp";
  }
  return null;
}

export const DEMO_SCENARIO = readDemoScenario();

/** Product opened in-chat for the clarifying-pdp scenario. */
export const CLARIFYING_PDP_SCENARIO_SLUG =
  "essentials-clarifying-cleansing-foam";

type UserTestingBootstrap = {
  userTestingLock: boolean;
  accordionRecommendations: boolean;
  viewportMode: DemoViewportMode;
  mobileChrome: boolean;
  contextIsland: boolean;
  contextPill: boolean;
  productSelection: boolean;
  productSelectionType: ProductSelectionType;
  selectedProductSlugs: string[];
  pdpInlineWidget: boolean;
  pdpInlineWidgetType: PdpInlineWidgetType;
  pdpInlineWidgetPosition: PdpInlineWidgetPosition;
  compareFeature: boolean;
  compareFeatureType: CompareFeatureType;
  imageSearch: boolean;
};

type AgentModeContextValue = {
  mode: AgentMode;
  setMode: (mode: AgentMode) => void;
  viewportMode: DemoViewportMode;
  setViewportMode: (mode: DemoViewportMode) => void;
  /** Decorative iPhone 17 + Chrome bars around the mobile demo frame. */
  mobileChrome: boolean;
  setMobileChrome: (enabled: boolean) => void;
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
  /** Products the shopper has checked on the storefront or in-chat cards. */
  selectedProductSlugs: string[];
  setSelectedProductSlugs: Dispatch<SetStateAction<string[]>>;
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
  /** Compare feature toggle — when on, compare turns use `compareFeatureType`. */
  compareFeature: boolean;
  setCompareFeature: (enabled: boolean) => void;
  /** Sub-option of Compare; retained while the parent checkbox is off. */
  compareFeatureType: CompareFeatureType;
  setCompareFeatureType: (type: CompareFeatureType) => void;
  /** When true, the composer shows the + control for camera / gallery search. */
  imageSearch: boolean;
  setImageSearch: (enabled: boolean) => void;
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
const DEFAULT_COMPARE_FEATURE = true;
const DEFAULT_COMPARE_FEATURE_TYPE: CompareFeatureType = "side-by-side-table";
const DEFAULT_IMAGE_SEARCH = false;

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
    mobileChrome: false,
    contextIsland: DEFAULT_CONTEXT_ISLAND,
    contextPill: DEFAULT_CONTEXT_PILL,
    productSelection: DEFAULT_PRODUCT_SELECTION,
    productSelectionType: DEFAULT_PRODUCT_SELECTION_TYPE,
    selectedProductSlugs: [],
    pdpInlineWidget: DEFAULT_PDP_INLINE_WIDGET,
    pdpInlineWidgetType: DEFAULT_PDP_INLINE_WIDGET_TYPE,
    pdpInlineWidgetPosition: DEFAULT_PDP_INLINE_WIDGET_POSITION,
    compareFeature: DEFAULT_COMPARE_FEATURE,
    compareFeatureType: DEFAULT_COMPARE_FEATURE_TYPE,
    imageSearch: DEFAULT_IMAGE_SEARCH,
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
  const viewportMode: DemoViewportMode =
    viewportOverride ?? (isLegacyA || isLegacyB ? "mobile" : DEFAULT_VIEWPORT_MODE);

  const selectionTypeRaw = (params.get("selectionType") || "").trim().toLowerCase();
  const selectionType: ProductSelectionType =
    selectionTypeRaw === "in-chat" || selectionTypeRaw === "drawer"
      ? selectionTypeRaw
      : DEFAULT_PRODUCT_SELECTION_TYPE;

  const selectedRaw = (params.get("select") || params.get("selected") || "")
    .trim();
  const selectedFromQuery = selectedRaw
    .split(/[|,]/)
    .map((slug) => slug.trim())
    .filter(Boolean);
  const selectedProductSlugs = selectedFromQuery;

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

  const compareTypeRaw = (params.get("compareType") || "").trim().toLowerCase();
  const compareType: CompareFeatureType =
    compareTypeRaw === "product-summaries" ||
    compareTypeRaw === "side-by-side-table"
      ? compareTypeRaw
      : DEFAULT_COMPARE_FEATURE_TYPE;

  return {
    userTestingLock: Boolean(utRaw),
    accordionRecommendations: parseFlag(
      params.get("accordion"),
      isLegacyB ? false : isLegacyA ? true : DEFAULT_ACCORDION_RECOMMENDATIONS,
    ),
    viewportMode,
    /* Mobile links include the iPhone chrome unless explicitly turned off
     * (`chrome=0`). `chrome=1` is still accepted; some hosts drop a param
     * named `chrome`, so `mobileChrome` is an alias. */
    mobileChrome:
      viewportMode === "mobile" &&
      parseFlag(
        params.get("chrome") ??
          params.get("mobileChrome") ??
          params.get("mobile-chrome"),
        true,
      ),
    contextIsland: parseFlag(params.get("island"), DEFAULT_CONTEXT_ISLAND),
    contextPill: parseFlag(params.get("pill"), DEFAULT_CONTEXT_PILL),
    productSelection: parseFlag(params.get("selection"), DEFAULT_PRODUCT_SELECTION),
    productSelectionType: selectionType,
    selectedProductSlugs,
    pdpInlineWidget: parseFlag(params.get("pdp"), DEFAULT_PDP_INLINE_WIDGET),
    pdpInlineWidgetType: pdpType,
    pdpInlineWidgetPosition: pdpPos,
    compareFeature: parseFlag(params.get("compare"), DEFAULT_COMPARE_FEATURE),
    compareFeatureType: compareType,
    imageSearch: parseFlag(
      params.get("imagesearch") ?? params.get("imageSearch"),
      DEFAULT_IMAGE_SEARCH,
    ),
  };
}

const UT_BOOTSTRAP = readUserTestingBootstrap();

export function AgentModeProvider({ children }: { children: ReactNode }) {
  /* No localStorage init for either piece of state: every refresh
   * starts from the hard defaults above (or UT lock from the URL).
   * The mid-session setters still work normally; they just don't
   * survive a reload. */
  const [mode, setMode] = useState<AgentMode>(DEFAULT_AGENT_MODE);
  const [viewportMode, setViewportModeState] = useState<DemoViewportMode>(
    UT_BOOTSTRAP.viewportMode,
  );
  const [mobileChrome, setMobileChromeState] = useState(
    UT_BOOTSTRAP.mobileChrome,
  );

  useLayoutEffect(() => {
    /* Re-read on mount so a late query string (cached HTML, UserTesting
     * wrappers) still turns Mobile Chrome on. */
    const next = readUserTestingBootstrap();
    setViewportModeState(next.viewportMode);
    setMobileChromeState(next.mobileChrome);
  }, []);

  const setViewportMode = (mode: DemoViewportMode) => {
    setViewportModeState(mode);
    if (mode === "desktop") setMobileChromeState(false);
  };

  const setMobileChrome = (enabled: boolean) => {
    if (viewportMode !== "mobile") return;
    setMobileChromeState(enabled);
  };
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
  const [selectedProductSlugs, setSelectedProductSlugs] = useState<string[]>(
    UT_BOOTSTRAP.selectedProductSlugs,
  );
  const [pdpInlineWidget, setPdpInlineWidget] = useState<boolean>(
    UT_BOOTSTRAP.pdpInlineWidget,
  );
  const [pdpInlineWidgetType, setPdpInlineWidgetType] =
    useState<PdpInlineWidgetType>(UT_BOOTSTRAP.pdpInlineWidgetType);
  const [pdpInlineWidgetPosition, setPdpInlineWidgetPosition] =
    useState<PdpInlineWidgetPosition>(UT_BOOTSTRAP.pdpInlineWidgetPosition);
  const [compareFeature, setCompareFeature] = useState<boolean>(
    UT_BOOTSTRAP.compareFeature,
  );
  const [compareFeatureType, setCompareFeatureType] =
    useState<CompareFeatureType>(UT_BOOTSTRAP.compareFeatureType);
  const [imageSearch, setImageSearch] = useState<boolean>(
    UT_BOOTSTRAP.imageSearch,
  );

  const value = useMemo(
    () => ({
      mode,
      setMode,
      viewportMode,
      setViewportMode,
      mobileChrome,
      setMobileChrome,
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
      selectedProductSlugs,
      setSelectedProductSlugs,
      pdpInlineWidget,
      setPdpInlineWidget,
      pdpInlineWidgetType,
      setPdpInlineWidgetType,
      pdpInlineWidgetPosition,
      setPdpInlineWidgetPosition,
      compareFeature,
      setCompareFeature,
      compareFeatureType,
      setCompareFeatureType,
      imageSearch,
      setImageSearch,
      sidecarAvailable:
        DEMO_SCENARIO != null ||
        !(pdpInlineWidget && pdpInlineWidgetType === "inline-answer"),
      userTestingLock: UT_BOOTSTRAP.userTestingLock,
    }),
    [
      mode,
      viewportMode,
      mobileChrome,
      accordionRecommendations,
      contextIsland,
      contextPill,
      productSelection,
      productSelectionType,
      selectedProductSlugs,
      pdpInlineWidget,
      pdpInlineWidgetType,
      pdpInlineWidgetPosition,
      compareFeature,
      compareFeatureType,
      imageSearch,
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
