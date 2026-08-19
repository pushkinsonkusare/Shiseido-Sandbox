import { useState } from "react";
import {
  AgentProductCarousel,
  type AgentCarouselProduct,
} from "./AgentProductCarousel";
import { ChevronDownIcon, ChevronUpIcon } from "../../icons/StorefrontIcons";
import "./AgentMessageCards.css";

export type AgentRoutineSection = {
  /** Ordinal step label, e.g. "1. Cleanse". */
  stepLabel: string;
  /** Human category title, e.g. "Cleansers". */
  categoryTitle: string;
  /** Concern/skin-type aware description shown when the step is open. */
  description: string;
  /** One-line product cue shown while the step is folded. */
  cue?: string;
  /** Products shown in this section's carousel. */
  products: AgentCarouselProduct[];
  /** When true, append the "Show more" tile to this section's carousel. */
  showMoreCard?: boolean;
};

export type AgentRoutineCardProps = {
  /** Empathetic opener shown at the top of the card. */
  acknowledgement: string;
  /** Ordered routine steps, each rendered as a section with its own carousel. */
  sections: AgentRoutineSection[];
  /** Invoked with the section index when that section's "Show more" is tapped. */
  onShowMore?: (sectionIndex: number) => void;
  /** Set of product ids currently selected (drives each card's checkbox). */
  selectedIds?: Set<string>;
  /** Toggle handler invoked with the product id when its checkbox is clicked. */
  onToggleSelect?: (id: string) => void;
  /** Add-to-cart handler invoked with the product id. */
  onAddToCart?: (id: string) => void;
  /** When true, unselected cards' checkboxes are disabled (selection cap hit). */
  selectionLimitReached?: boolean;
  /**
   * When true (default), sections behave as a single-open accordion. When
   * false, every section is expanded and headers are static (no toggle).
   */
  accordion?: boolean;
  /** True while sections are still arriving: holds a placeholder below the last
   *  one so the card reads as still being written. */
  streaming?: boolean;
  /** Optional class name appended to the root element. */
  className?: string;
};

/**
 * AgentRoutineCard is the broad-intent "routine" card: a single card that
 * opens with an acknowledgement, then walks the shopper through the ordered
 * routine steps (Cleanse -> Soften -> Treat -> Moisturize -> Protect). Each
 * step shows a category title, a short description, and a product carousel
 * that reuses the shared `AgentProductCarousel` (including the 5 + "Show more"
 * paging behaviour).
 */
export function AgentRoutineCard({
  acknowledgement,
  sections,
  onShowMore,
  selectedIds,
  onToggleSelect,
  onAddToCart,
  selectionLimitReached,
  accordion = true,
  streaming = false,
  className,
}: AgentRoutineCardProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  // While streaming the card opens on the acknowledgement alone, so an empty
  // section list is a valid state rather than nothing to render.
  if (sections.length === 0 && !streaming) return null;

  const rootClass = "agent-routine__card" + (className ? " " + className : "");

  return (
    <article
      className={rootClass}
      data-component="agent-routine-card"
      data-streaming={streaming || undefined}
      aria-busy={streaming || undefined}
    >
      <p className="agent-routine__acknowledgement">{acknowledgement}</p>

      {sections.map((section, index) => {
        const isOpen = accordion ? openIndex === index : true;
        return (
          <section
            key={section.categoryTitle}
            className={
              "agent-routine__section" +
              (isOpen ? " agent-routine__section--open" : "")
            }
          >
            <header className="agent-routine__section-header">
              {accordion ? (
                <button
                  type="button"
                  className="agent-routine__section-toggle"
                  aria-expanded={isOpen}
                  onClick={() =>
                    setOpenIndex((cur) => (cur === index ? null : index))
                  }
                >
                  <div className="agent-routine__copy">
                    <h3 className="agent-routine__step">{section.stepLabel}</h3>
                    <p className="agent-routine__description">
                      {isOpen
                        ? section.description
                        : (section.cue ?? section.description)}
                    </p>
                  </div>
                  <span className="agent-routine__chevron" aria-hidden="true">
                    {isOpen ? (
                      <ChevronUpIcon width={18} height={18} />
                    ) : (
                      <ChevronDownIcon width={18} height={18} />
                    )}
                  </span>
                </button>
              ) : (
                <div className="agent-routine__copy">
                  <h3 className="agent-routine__step">{section.stepLabel}</h3>
                  <p className="agent-routine__description">
                    {section.description}
                  </p>
                </div>
              )}
            </header>
            {isOpen ? (
              <AgentProductCarousel
                products={section.products}
                showMoreCard={Boolean(section.showMoreCard)}
                onShowMore={() => onShowMore?.(index)}
                selectedIds={selectedIds}
                onToggleSelect={onToggleSelect}
                onAddToCart={onAddToCart}
                selectionLimitReached={selectionLimitReached}
              />
            ) : null}
          </section>
        );
      })}

      {streaming ? (
        // Stands in for the step being written: a heading, its blurb, and the
        // row of products, at the proportions a real section lands at.
        <section
          className="agent-routine__section agent-routine__skeleton"
          aria-hidden="true"
        >
          <span className="agent-skeleton__bar agent-routine__skeleton-bar--step" />
          <span className="agent-skeleton__bar agent-routine__skeleton-bar--copy" />
          <div className="agent-skeleton__row">
            <span className="agent-skeleton__tile" />
            <span className="agent-skeleton__tile" />
            <span className="agent-skeleton__tile" />
          </div>
        </section>
      ) : null}
    </article>
  );
}

export default AgentRoutineCard;
