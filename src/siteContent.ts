export type PrimaryNavItem = {
  label: string;
  emphasized?: boolean;
  /**
   * Optional category token used to filter the product listing page.
   * Matched case-insensitively as a substring against `CatalogProduct.category`,
   * so e.g. "Drones" matches both "Drones" and "4K drones".
   */
  category?: string;
  /** Sends the link to a page other than the product listing. */
  route?: "/skincare-blog";
};

export const SITE_BRAND = "Shiseido";
export const SITE_ANNOUNCEMENT = "Complimentary shipping and samples on every skincare order";
export const SITE_FOOTER_COPY = "© Shiseido demo storefront experience";
export const SITE_ADDRESS = "415 Mission Street, San Francisco, CA 94105";

export const PRIMARY_NAV_ITEMS: PrimaryNavItem[] = [
  { label: "Cleansers", category: "Cleansers" },
  { label: "Serums", category: "Serums" },
  { label: "Moisturizers", category: "Moisturizers" },
  { label: "Sun Care", category: "Sunscreen" },
  { label: "Sets & Gifts", category: "Sets" },
  { label: "Skincare Blog", route: "/skincare-blog" },
];
