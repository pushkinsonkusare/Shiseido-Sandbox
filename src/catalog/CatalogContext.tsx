import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { catalogStore, type CatalogStore, type DemoCartLine } from "./catalog";
import type { CartPromo } from "./spendTiers";

export type CatalogContextValue = CatalogStore & {
  /** Replaces the shopper's cart; the store pages and the agent share it. */
  setCartLines: (lines: DemoCartLine[]) => void;
  /** A code the shopper entered in the agent cart (spend tiers apply on their own). */
  cartPromo: CartPromo | null;
  setCartPromo: (promo: CartPromo | null) => void;
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [cartLines, setCartLines] = useState<DemoCartLine[]>(catalogStore.cartLines);
  const [cartPromo, setCartPromo] = useState<CartPromo | null>(null);
  const value = useMemo(
    () => ({ ...catalogStore, cartLines, setCartLines, cartPromo, setCartPromo }),
    [cartLines, cartPromo],
  );
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const context = useContext(CatalogContext);

  if (!context) {
    throw new Error("useCatalog must be used within CatalogProvider");
  }

  return context;
}
