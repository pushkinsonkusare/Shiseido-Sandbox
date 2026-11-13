import { useState, type ReactNode } from "react";
import { useCatalog } from "../../catalog/CatalogContext";
import { formatPrice } from "../../catalog/catalog";
import { cartPromoDiscount, resolveCartPromo } from "../../catalog/spendTiers";
import { UnifiedTopHeader } from "../../components/UnifiedTopHeader/UnifiedTopHeader";
import { useSearchOverlay } from "../../components/SearchOverlay/SearchOverlayContext";
import {
  CheckIcon,
  ChevronDownIcon,
  HeartIcon,
  StoreIcon,
  TruckIcon,
} from "../../components/icons/StorefrontIcons";
import { ROUTES, usePrototypeNavigation } from "../../prototypeRoutes";
import { SITE_ADDRESS, SITE_BRAND, SITE_FOOTER_COPY } from "../../siteContent";
import { CartTierNudge } from "./CartTierNudge";
import "./ShoppingCartPage.css";

type CartItem = {
  id: string;
  imageUrl: string;
  name: string;
  color: string;
  size: string;
  unitPrice: number;
  quantity: number;
  price: string;
  oldPrice?: string;
  savings?: string;
};

type FulfillmentCartItem = CartItem & {
  fulfillment: "pickup" | "delivery";
};

type CartItemHandlers = {
  onRemove: (id: string) => void;
  onQuantityChange: (id: string, quantity: number) => void;
};

const QUANTITY_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);

function CartItemRow({ item, onRemove, onQuantityChange }: { item: CartItem } & CartItemHandlers) {
  // Wishlist and gift are demo-only: they live with the row, not the cart.
  const [saved, setSaved] = useState(false);
  const [gift, setGift] = useState(false);
  const qtyId = `cart-qty-${item.id}`;
  const quantities = item.quantity > 10 ? [...QUANTITY_OPTIONS, item.quantity] : QUANTITY_OPTIONS;

  return (
    <article className="figma-cart__item">
      <div className="figma-cart__item-thumb">
        <img src={item.imageUrl} alt={item.name} className="figma-cart__item-image" />
      </div>
      <div className="figma-cart__item-details">
        <div className="figma-cart__item-content">
          <h3>{item.name}</h3>
          <div className="figma-cart__item-meta">
            <p>Color: {item.color}</p>
            <p>Size: {item.size}</p>
          </div>
          <div className="figma-cart__item-actions">
            <button type="button" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.name}`}>
              Remove
            </button>
            <button
              type="button"
              className={"figma-cart__wishlist" + (saved ? " figma-cart__wishlist--saved" : "")}
              aria-pressed={saved}
              onClick={() => setSaved((value) => !value)}
            >
              {saved ? <HeartIcon width={14} height={14} aria-hidden="true" /> : null}
              {saved ? "Saved to Wishlist" : "Add to Wishlist"}
            </button>
          </div>
        </div>
        <div className="figma-cart__item-right">
          <div className="figma-cart__qty">
            <label className="figma-cart__qty-label" htmlFor={qtyId}>Quantity:</label>
            <div className="figma-cart__qty-field">
              <select
                id={qtyId}
                className="figma-cart__qty-select"
                value={item.quantity}
                onChange={(event) => onQuantityChange(item.id, Number(event.target.value))}
              >
                {quantities.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <ChevronDownIcon width={16} height={16} aria-hidden="true" />
            </div>
          </div>
          <div className="figma-cart__badges-price">
            {item.savings ? (
              <div className="figma-cart__savings-badge">{item.savings}</div>
            ) : null}
            <div className="figma-cart__pricing">
              {item.oldPrice ? <span className="figma-cart__price-old">{item.oldPrice}</span> : null}
              <span className="figma-cart__price-current">{item.price}</span>
            </div>
            <button
              type="button"
              role="checkbox"
              aria-checked={gift}
              className={"figma-cart__gift-btn" + (gift ? " figma-cart__gift-btn--checked" : "")}
              onClick={() => setGift((value) => !value)}
            >
              <span className="figma-cart__gift-box" aria-hidden="true">
                {gift ? <CheckIcon width={12} height={12} /> : null}
              </span>
              <span className="figma-cart__gift-text">
                This is a gift. <span className="figma-cart__gift-learn">Learn more</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function CartSection({
  title,
  subtitle,
  icon,
  items,
  showChangeStore,
  onRemove,
  onQuantityChange,
}: {
  title: ReactNode;
  subtitle: string;
  icon: ReactNode;
  items: CartItem[];
  showChangeStore?: boolean;
} & CartItemHandlers) {
  if (items.length === 0) return null;
  return (
    <section className="figma-cart__section-card">
      <header className="figma-cart__section-head">
        <div className="figma-cart__section-head-main">
          <div className="figma-cart__section-icon">{icon}</div>
          <div>
            <h2 className="figma-cart__section-title">{title}</h2>
            <p className="figma-cart__section-sub">{subtitle}</p>
          </div>
        </div>
        {showChangeStore ? (
          <div className="figma-cart__change-store-wrap">
            <button type="button" className="figma-cart__change-store">Change Store</button>
          </div>
        ) : null}
      </header>
      <div className="figma-cart__items">
        {items.map((item) => (
          <CartItemRow key={item.id} item={item} onRemove={onRemove} onQuantityChange={onQuantityChange} />
        ))}
      </div>
    </section>
  );
}

export default function ShoppingCartPage() {
  const { cartLines, setCartLines, cartPromo, getProductBySlug } = useCatalog();
  const removeLine = (id: string) => setCartLines(cartLines.filter((line) => line.id !== id));
  const setLineQuantity = (id: string, quantity: number) =>
    setCartLines(cartLines.map((line) => (line.id === id ? { ...line, quantity } : line)));
  const { navigate } = usePrototypeNavigation();
  const { openSearchOverlay } = useSearchOverlay();
  const cartItems: FulfillmentCartItem[] = cartLines.flatMap((line) => {
      const product = getProductBySlug(line.productSlug);
      if (!product) {
        return [];
      }

      const unitPrice = product.price ?? 0;
      const unitSavings = line.fulfillment === "pickup" ? unitPrice * 0.08 : 0;

      return [{
        id: line.id,
        imageUrl: product.imageUrl,
        name: product.title,
        color: product.category,
        size: line.label,
        unitPrice,
        quantity: line.quantity,
        oldPrice: unitSavings > 0 ? formatPrice(unitPrice + unitSavings) : undefined,
        price: formatPrice(unitPrice),
        savings: unitSavings > 0 ? `Saved ${formatPrice(unitSavings * line.quantity)}` : undefined,
        fulfillment: line.fulfillment,
      }];
    });

  const pickupItems = cartItems.filter((item) => item.fulfillment === "pickup");
  const deliveryItems = cartItems.filter((item) => item.fulfillment === "delivery");
  const subtotalValue = cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  // Same coupon maths as the agent cart, so both summaries agree. The pickup
  // "was" prices are compare-at prices already folded into the unit price,
  // so they are not taken off again here.
  const promo = resolveCartPromo(subtotalValue, cartPromo);
  const promotionValue = cartPromoDiscount(subtotalValue, promo);
  const totalValue = Math.max(0, subtotalValue - promotionValue);

  return (
    <div className="figma-cart">
      <UnifiedTopHeader navigate={navigate} openSearchOverlay={openSearchOverlay} />

      {/* Title and body share one wrapper so the side-by-side layout can place
          them as a single column-1 item beside the assistant panel. */}
      <div className="figma-cart__page-inner">
        <div className="figma-cart__title-strip">
          <h1>Cart ({cartItems.reduce((sum, item) => sum + item.quantity, 0)} items)</h1>
        </div>

        <div className="figma-cart__main-wrap">
          <div className="figma-cart__left">
            {cartItems.length > 0 ? (
              <CartTierNudge
                subtotal={subtotalValue}
                cartProducts={cartLines.flatMap((line) => {
                  const product = getProductBySlug(line.productSlug);
                  return product ? [product] : [];
                })}
              />
            ) : null}

            <CartSection
              icon={<StoreIcon width={20} height={20} />}
              title={(
                <>
                  <span>Pickup at </span>
                  <strong>Shiseido Boutique</strong>
                  <span> - {pickupItems.length} items</span>
                </>
              )}
              subtitle={SITE_ADDRESS}
              items={pickupItems}
              showChangeStore
              onRemove={removeLine}
              onQuantityChange={setLineQuantity}
            />
            <CartSection
              icon={<TruckIcon width={20} height={20} />}
              title={`Delivery - ${deliveryItems.length} items`}
              subtitle={SITE_ADDRESS}
              items={deliveryItems}
              onRemove={removeLine}
              onQuantityChange={setLineQuantity}
            />
            {cartItems.length === 0 ? (
              <section className="figma-cart__section-card figma-cart__empty">
                <h2 className="figma-cart__section-title">Your cart is empty</h2>
                <p className="figma-cart__section-sub">Items you add will show up here.</p>
                <button type="button" className="figma-cart__btn-checkout" onClick={() => navigate(ROUTES.home)}>
                  Continue Shopping
                </button>
              </section>
            ) : null}
          </div>

          <aside className="figma-cart__summary">
            <div className="figma-cart__summary-header">
              <h2>Order Summary</h2>
            </div>
            <div className="figma-cart__summary-lines">
              <div className="figma-cart__line"><span>Subtotal</span><span>{formatPrice(subtotalValue)}</span></div>
              {promo ? (
                <div className="figma-cart__line"><span>Coupon {promo.code}</span><span>-{formatPrice(promotionValue)}</span></div>
              ) : null}
              <div className="figma-cart__line"><span>Promotions</span><span>-</span></div>
              <div className="figma-cart__line"><span>Shipping</span><span>{subtotalValue >= 150 ? "$0.00" : "Calculated at checkout"}</span></div>
              <div className="figma-cart__line"><span>Tax</span><span>Calculated at checkout</span></div>
              <div className="figma-cart__line figma-cart__line--total"><span>Total</span><span>{formatPrice(totalValue)}</span></div>
            </div>
            <div className="figma-cart__promo-block">
              <button type="button" className="figma-cart__promo">
                <span>Do you have a promo code?</span>
                <ChevronDownIcon width={24} height={24} className="figma-cart__promo-chevron" />
              </button>
              {promo ? (
                <div className="figma-cart__applied">
                  <span className="figma-cart__promo-badge">{promo.code} · {Math.round(promo.fraction * 100)}% off</span>
                  <span className="figma-cart__applied-amt">-{formatPrice(promotionValue)}</span>
                </div>
              ) : null}
            </div>
            <div className="figma-cart__summary-footer">
              <button type="button" className="figma-cart__btn-checkout" onClick={() => navigate(ROUTES.checkout)}>Continue to Checkout</button>
              <div className="figma-cart__express">
                <button type="button" className="figma-cart__btn-gpay">
                  <span className="figma-cart__brand-gpay">
                    <span className="figma-cart__brand-g">G</span>
                    <span>Pay</span>
                  </span>
                </button>
                <button type="button" className="figma-cart__btn-apple">
                  <span className="figma-cart__apple-pay">Apple Pay</span>
                </button>
                <button type="button" className="figma-cart__btn-paypal">
                  <span className="figma-cart__brand-paypal">
                    <span className="figma-cart__brand-paypal-dark">Pay</span>
                    <span className="figma-cart__brand-paypal-light">Pal</span>
                  </span>
                </button>
                <button type="button" className="figma-cart__btn-venmo">
                  <span className="figma-cart__brand-venmo">venmo</span>
                </button>
                <button type="button" className="figma-cart__btn-amazon">
                  <span className="figma-cart__brand-amazon">
                    <span>amazon</span>
                    <span className="figma-cart__brand-amazon-pay">pay</span>
                  </span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <footer className="figma-cart__footer-shell">
        <div className="figma-cart__footer-inner">
          <div className="figma-cart__footer-row1">
            <div className="figma-cart__footer-left">
              <strong className="figma-cart__footer-logo">{SITE_BRAND}</strong>
              <div className="figma-cart__footer-links">
                <a href="#">Loyalty & Rewards</a>
                <a href="#">Privacy Policy</a>
                <a href="#">Support</a>
              </div>
            </div>
          </div>
          <div className="figma-cart__footer-row2">
            <p>{SITE_FOOTER_COPY}</p>
            <div className="figma-cart__footer-legal">
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Use</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
