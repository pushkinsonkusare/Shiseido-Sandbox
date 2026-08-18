import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowUpRightIcon,
  RefreshCcwIcon,
  SendHorizontalIcon,
  SparkleIcon,
} from "../../components/icons/StorefrontIcons";
import { LatencyLoader } from "../../components/SidecarAssistant/components/LatencyLoader";
import type { PdpInlineWidgetType } from "../../components/AgentModeBar/AgentModeContext";
import type { CatalogProduct } from "../../catalog/catalog";
import {
  PDP_NBA_PILL_SET_COUNT,
  buildPdpNbaPills,
  type PdpNbaPill,
  type PdpNbaPillKind,
} from "./pdpNbaPills";
import { resolveInlineAnswer, type InlineAnswer } from "./inlineAnswer";

export type AskAssistantEventDetail = {
  /** The text the assistant should treat as a shopper utterance. */
  prompt: string;
  /** Slug of the PDP that originated the prompt, used for telemetry and to render the product context header. */
  productSlug?: string;
  /**
   * Kind of NBA pill that fired the prompt. Routes the assistant to the
   * matching utterance variant (hygiene → policy + doc CTA, faq →
   * agentic answer, open → "ask me anything" intro, …). Omitted when the
   * dispatch is not pill-driven.
   */
  pillKind?: PdpNbaPillKind;
};

/** Fire the cross-cutting event both Sidecar and SxS assistants listen for. */
function dispatchAskAssistant(detail: AskAssistantEventDetail) {
  if (typeof document === "undefined") return;
  document.dispatchEvent(
    new CustomEvent<AskAssistantEventDetail>("agentic:ask-assistant", {
      detail,
    }),
  );
}

function emitTelemetry(event: string, payload: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("agentic:assistant-telemetry", {
      detail: { event, payload, ts: Date.now() },
    }),
  );
}

/** Long enough to read as work, short enough not to stall the page. */
const INLINE_THINKING_MS = 1600;
const INLINE_THINKING_LABEL = "Understanding your query…";
const INLINE_PLACEHOLDER = "Type your question";

/** Which of the widget's two answer surfaces is live. */
type InlineStatus = "idle" | "thinking" | "answered";

type Props = {
  product: CatalogProduct;
  catalog: CatalogProduct[];
  /**
   * `agent-redirect` hands the prompt to the assistant panel; `inline-answer`
   * answers inside the widget and never opens the panel.
   */
  answerMode?: PdpInlineWidgetType;
};

/**
 * "Ask Assistant" NBA module rendered on the PDP (Figma node 33250:50536).
 *
 * Surfaces five contextual pills covering product FAQs, bundling/upsell, and
 * hygiene questions. Clicking any pill fires `agentic:ask-assistant`, which
 * opens the active assistant (Sidecar or SxS) and dispatches the prompt as
 * a shopper turn. The refresh icon cycles through curated alternative sets.
 *
 * In `inline-answer` mode the widget answers on the page instead: a composer
 * plus one query-and-answer slot that a new question replaces, so there is
 * never a thread to scroll, and the pill set narrows to questions the widget
 * can answer as text.
 */
export function PdpNbaPanel({
  product,
  catalog,
  answerMode = "agent-redirect",
}: Props) {
  const [setIndex, setSetIndex] = useState(0);
  const inline = answerMode === "inline-answer";

  const [query, setQuery] = useState<string | null>(null);
  const [status, setStatus] = useState<InlineStatus>("idle");
  const [answer, setAnswer] = useState<InlineAnswer | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const thinkingTimerRef = useRef<number | null>(null);
  /** Bumped on every ask, so an answer that resolves late is dropped rather
   *  than landing under a question the shopper has already moved on from. */
  const generationRef = useRef(0);

  const pills = useMemo(
    () => buildPdpNbaPills(product, catalog, setIndex, { questionsOnly: inline }),
    [product, catalog, setIndex, inline],
  );

  // Reset the rotation whenever the shopper navigates between PDPs so they
  // always land on the curated default set first.
  useEffect(() => {
    setSetIndex(0);
  }, [product.slug]);

  const clearInlineSlot = useCallback(() => {
    generationRef.current += 1;
    if (thinkingTimerRef.current !== null) {
      window.clearTimeout(thinkingTimerRef.current);
      thinkingTimerRef.current = null;
    }
    setQuery(null);
    setStatus("idle");
    setAnswer(null);
    setDraft("");
  }, []);

  // A question about the last product has no business sitting on this one, and
  // leaving inline mode should not leave a stale answer behind either.
  useEffect(() => {
    clearInlineSlot();
  }, [product.slug, inline, clearInlineSlot]);

  useEffect(() => () => {
    if (thinkingTimerRef.current !== null) {
      window.clearTimeout(thinkingTimerRef.current);
    }
  }, []);

  // Fire an impression event each time a new pill set lands in front of the
  // shopper. Mirrors the assistant-side telemetry shape.
  useEffect(() => {
    emitTelemetry("pdp_nba_impression", {
      productSlug: product.slug,
      setIndex,
      labels: pills.map((pill) => pill.label),
      kinds: pills.map((pill) => pill.kind),
      answerMode,
    });
  }, [product.slug, setIndex, pills, answerMode]);

  /** Take over the single slot with a new question. */
  const askInline = useCallback(
    (prompt: string, source: "pill" | "composer") => {
      const trimmed = prompt.trim();
      if (!trimmed) return;

      generationRef.current += 1;
      const generation = generationRef.current;
      if (thinkingTimerRef.current !== null) {
        window.clearTimeout(thinkingTimerRef.current);
      }

      // Replace rather than append: one question is on screen at a time.
      setQuery(trimmed);
      setAnswer(null);
      setStatus("thinking");
      emitTelemetry("pdp_inline_ask", {
        productSlug: product.slug,
        prompt: trimmed,
        source,
      });

      thinkingTimerRef.current = window.setTimeout(() => {
        thinkingTimerRef.current = null;
        if (generation !== generationRef.current) return;
        const resolved = resolveInlineAnswer(product, trimmed);
        setAnswer(resolved);
        setStatus("answered");
        emitTelemetry("pdp_inline_answer", {
          productSlug: product.slug,
          prompt: trimmed,
          kind: resolved.kind,
          detail: resolved.detail,
        });
      }, INLINE_THINKING_MS);
    },
    [product],
  );

  const handlePillClick = useCallback(
    (pill: PdpNbaPill) => {
      emitTelemetry("pdp_nba_click", {
        productSlug: product.slug,
        setIndex,
        kind: pill.kind,
        label: pill.label,
        answerMode,
      });

      if (inline) {
        // "Ask me anything" is an invitation, not a question: it hands the
        // shopper the composer instead of answering itself.
        if (pill.kind === "open") {
          inputRef.current?.focus();
          return;
        }
        askInline(pill.prompt ?? pill.label, "pill");
        return;
      }

      dispatchAskAssistant({
        prompt: pill.prompt ?? pill.label,
        productSlug: product.slug,
        pillKind: pill.kind,
      });
    },
    [product.slug, setIndex, inline, askInline, answerMode],
  );

  const handleRegenerate = useCallback(() => {
    setSetIndex((current) => (current + 1) % PDP_NBA_PILL_SET_COUNT);
  }, []);

  const handleSubmit = useCallback(() => {
    const value = draft.trim();
    if (!value) return;
    setDraft("");
    askInline(value, "composer");
  }, [draft, askInline]);

  // The composer wraps a long question instead of scrolling it out of sight,
  // so its height follows its content. Reset first: `scrollHeight` only grows
  // against the height already set.
  useLayoutEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [draft, inline]);

  return (
    <section
      className="pdp-nba"
      aria-label="Ask the personal assistant"
      data-answer-mode={inline ? "inline" : "redirect"}
    >
      <header className="pdp-nba__header">
        <span className="pdp-nba__header-icon" aria-hidden="true">
          <SparkleIcon width={16} height={16} />
        </span>
        <h2 className="pdp-nba__header-title">Ask Assistant</h2>
        <span className="pdp-nba__badge" aria-label="New feature">
          New
        </span>
      </header>

      {inline && query ? (
        <div className="pdp-nba__slot" data-component="pdp-inline-slot">
          <p className="pdp-nba__query">{query}</p>
          {status === "thinking" ? (
            <LatencyLoader
              className="pdp-nba__thinking"
              label={INLINE_THINKING_LABEL}
            />
          ) : null}
          {status === "answered" && answer ? (
            <div
              className="pdp-nba__answer"
              data-component="pdp-inline-answer"
              data-kind={answer.kind}
              role="status"
              aria-live="polite"
            >
              <p className="pdp-nba__answer-body">{answer.body}</p>
              {answer.link ? (
                <a
                  className="pdp-nba__answer-link"
                  href={answer.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {answer.link.label}
                  <ArrowUpRightIcon width={14} height={14} />
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {inline ? (
        <form
          className="pdp-nba__composer"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <textarea
            ref={inputRef}
            className="pdp-nba__composer-input"
            rows={1}
            placeholder={INLINE_PLACEHOLDER}
            value={draft}
            aria-label={`Ask a question about the ${product.title}`}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
              // Shift+Enter is the only way to a second line by hand; the
              // field wraps a long question on its own.
              if (event.shiftKey) return;
              event.preventDefault();
              handleSubmit();
            }}
          />
          <button
            type="submit"
            className="pdp-nba__composer-send"
            aria-label="Send question"
            disabled={!draft.trim()}
          >
            <SendHorizontalIcon width={20} height={20} />
          </button>
        </form>
      ) : null}

      <div className="pdp-nba__pill-set" role="toolbar" aria-label="Suggested questions">
        {pills.map((pill) => {
          const showArrow = pill.kind !== "open";
          return (
            <button
              key={pill.id}
              type="button"
              className="pdp-nba__pill"
              data-kind={pill.kind}
              onClick={() => handlePillClick(pill)}
            >
              <span className="pdp-nba__pill-label">{pill.label}</span>
              {showArrow ? (
                <ArrowUpRightIcon
                  className="pdp-nba__pill-icon"
                  width={16}
                  height={16}
                />
              ) : null}
            </button>
          );
        })}
        <button
          type="button"
          className="pdp-nba__regen"
          aria-label="Show different questions"
          onClick={handleRegenerate}
        >
          <RefreshCcwIcon width={16} height={16} />
        </button>
      </div>
    </section>
  );
}

export default PdpNbaPanel;
