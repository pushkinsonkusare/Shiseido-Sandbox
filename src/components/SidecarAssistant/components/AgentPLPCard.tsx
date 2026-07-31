import {
  AgentProductCarousel,
  type AgentCarouselProduct,
} from "./AgentProductCarousel";
import "./AgentMessageCards.css";

export type AgentPLPProduct = AgentCarouselProduct;

export type AgentPLPCardProps = {
  /** Body copy rendered above the carousel (the agent's message). */
  intro: string;
  /** Products rendered inside the horizontal carousel. */
  products: AgentPLPProduct[];
  /** When true, appends the "Show more" terminal card to the carousel. */
  showMoreCard?: boolean;
  /** Click handler invoked when the user activates the "Show more" card. */
  onShowMore?: () => void;
  /** Set of product ids currently selected (drives each card's checkbox). */
  selectedIds?: Set<string>;
  /** Toggle handler invoked with the product id when its checkbox is clicked. */
  onToggleSelect?: (id: string) => void;
  /** Add-to-cart handler invoked with the product id when a card's cart icon
   * button is clicked. Cart button is hidden when omitted. */
  onAddToCart?: (id: string) => void;
  /** When true, unselected cards' checkboxes are disabled (selection cap hit). */
  selectionLimitReached?: boolean;
  /** True while the products are still being pulled together: holds a
   *  placeholder row where the carousel will be. */
  streaming?: boolean;
  /** Optional class name appended to the root element. */
  className?: string;
};

/**
 * AgentPLPCard is the agentic Product List Page card rendered inside the
 * SidecarAssistant chat panel.  Mirrors `Agent/PLP_Card` (node-id 32748:34667).
 */
export function AgentPLPCard({
  intro,
  products,
  showMoreCard = true,
  onShowMore,
  selectedIds,
  onToggleSelect,
  onAddToCart,
  selectionLimitReached,
  streaming = false,
  className,
}: AgentPLPCardProps) {
  const rootClass = "agent-plp__card" + (className ? " " + className : "");

  return (
    <article
      className={rootClass}
      data-component="agent-plp-card"
      data-streaming={streaming || undefined}
      aria-busy={streaming || undefined}
    >
      <p className="agent-plp__intro">{intro}</p>

      {streaming ? (
        // The whole carousel is swapped out rather than handed an empty product
        // list, which would leave its arrows and "Show more" tile framing
        // nothing.
        <div className="agent-plp__skeleton agent-skeleton__row" aria-hidden="true">
          <span className="agent-skeleton__tile" />
          <span className="agent-skeleton__tile" />
          <span className="agent-skeleton__tile" />
        </div>
      ) : (
        <AgentProductCarousel
          products={products}
          showMoreCard={showMoreCard}
          onShowMore={onShowMore}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
          onAddToCart={onAddToCart}
          selectionLimitReached={selectionLimitReached}
        />
      )}
    </article>
  );
}

export default AgentPLPCard;
