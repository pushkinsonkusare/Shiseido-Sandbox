import { useEffect, useState } from "react";
import { useCatalog } from "../../catalog/CatalogContext";
import { toProductCardProps } from "../../catalog/catalog";
import ProductCard from "../../components/ProductCard/ProductCard";
import { UnifiedTopHeader } from "../../components/UnifiedTopHeader/UnifiedTopHeader";
import {
  ArrowRightIcon,
  ChevronRightIcon,
  PlayIcon,
  PauseIcon,
} from "../../components/icons/StorefrontIcons";
import { useSearchOverlay } from "../../components/SearchOverlay/SearchOverlayContext";
import { ROUTES, usePrototypeNavigation } from "../../prototypeRoutes";
import { PRIMARY_NAV_ITEMS, SITE_BRAND, SITE_FOOTER_COPY } from "../../siteContent";
import bannerUltimune from "../../assets/banner-ultimune.webp";
import bannerUltimuneMobile from "../../assets/banner-ultimune-mobile-warm-grey.png";
import bannerMineralSunscreen from "../../assets/banner-mineral-sunscreen.webp";
import bannerMineralSunscreenMobile from "../../assets/banner-mineral-sunscreen-mobile.png";
import bannerAiAdvisor from "../../assets/banner-ai-advisor.webp";
import bannerAiAdvisorMobile from "../../assets/banner-ai-advisor-mobile.webp";
import bannerAiAdvisorSplit from "../../assets/banner-ai-advisor-split.webp";
import bannerVitalPerfection from "../../assets/banner-vital-perfection.png";
import categoryCleansersLifestyle from "../../assets/category-cleansers-lifestyle.png";
import categoryTreatmentsLifestyle from "../../assets/category-treatments-lifestyle.png";
import shiseidoLogo from "../../assets/shiseido-logo.png";
import "./StorefrontPage.css";

/** The two-step ritual: lifestyle art, the step's best sellers and a PLP deep-link. */
const RITUAL_STEPS = [
  {
    id: "cleansers",
    step: "01",
    verb: "Cleanse",
    title: "Begin with a clean canvas",
    description:
      "Foams, oils and milks that lift the day away without leaving skin tight, so everything after works harder.",
    image: categoryCleansersLifestyle,
    imageAlt: "Woman gently cleansing her face with a foaming cleanser",
    category: "Cleansers",
    catalogCategory: "Cleansers",
    cta: "Shop cleansers",
  },
  {
    id: "serums-treatments",
    step: "02",
    verb: "Treat",
    title: "Then give skin what it's asking for",
    description:
      "Concentrated serums for firmness, radiance and resilience, pressed in while skin is still soft from cleansing.",
    image: categoryTreatmentsLifestyle,
    imageAlt: "Woman applying serum to her cheek in soft morning light",
    category: "Serums",
    catalogCategory: "Serums & Treatments",
    cta: "Shop serums",
  },
] as const;

/** Collection banners: campaign photography, each opening its PLP collection. */
const COLLECTION_BANNERS = [
  {
    series: "ultimune",
    name: "Ultimune",
    line: "The serum skin leans on when it's had a long week.",
    image: "shiseido_product_images/ultimune/future-power-shot-0729238213098_8.jpg",
    position: "center 40%",
  },
  {
    series: "waso",
    name: "Waso",
    line: "Fresh yuzu, picked for a quick hit of glow.",
    image: "shiseido_product_images/waso/yuzu-c-beauty-hydrating-sleeping-face-mask-0768614178798_5.jpg",
    position: "center",
  },
  {
    series: "benefiance",
    name: "Benefiance",
    line: "For the first fine lines, and the ones after.",
    image: "shiseido_product_images/benefiance/brightening-gel-cream-0730852149328_6.jpg",
    position: "center 30%",
  },
  {
    series: "shiseido-men",
    name: "Shiseido Men",
    line: "Three steps, two minutes, no fuss.",
    image: "shiseido_product_images/shiseido-men/energizing-moisturizer-extra-light-fluid-0729238171541_5.jpg",
    position: "center 42%",
  },
] as const;

export default function StorefrontPage() {
  const { featuredProducts, spotlightProducts, products } = useCatalog();
  const { navigate, navigateToProduct } = usePrototypeNavigation();
  const { openSearchOverlay } = useSearchOverlay();
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);

  const heroSlides = [
    {
      id: "ultimune",
      image: bannerUltimune,
      imageMobile: bannerUltimuneMobile,
      imageAlt: "Shiseido Ultimune Power Infusing Serum",
      eyebrow: "ULTIMUNE POWER INFUSING SERUM",
      title: "Slow the Skin Aging Cycle*",
      description: "95% saw improved radiance and texture with less visible wrinkles in 1 week.**",
      footnotes: [
        "*Cycle that leads to skin aging such as fine lines & wrinkles, started from dryness.",
        "** Consumer tested by 107 women.",
      ],
      onShop: () => navigateToProduct("ultimune-power-infusing-serum"),
    },
    {
      id: "mineral-clear",
      image: bannerMineralSunscreen,
      imageMobile: bannerMineralSunscreenMobile,
      imageAlt: "Shiseido Urban Environment Mineral Clear Sunscreen SPF 50",
      eyebrow: "URBAN ENVIRONMENT",
      title: "Urban Environment Mineral Clear Sunscreen SPF 50",
      description:
        "Experience lightweight, 100% mineral actives sunscreen that goes from sheer to clear upon application. New size available.",
      footnotes: [] as string[],
      onShop: () => navigateToProduct("urban-environment-mineral-clear-sunscreen-spf-50"),
    },
    {
      id: "ai-advisor",
      image: bannerAiAdvisor,
      imageMobile: bannerAiAdvisorMobile,
      // Fade-free top crop of the portrait, for the desktop split layout.
      imageSplit: bannerAiAdvisorSplit,
      imageAlt: "Two women with luminous, healthy skin in warm sunlight",
      eyebrow: "BEAUTY ADVISOR · POWERED BY AI",
      title: "Shop with AI Assistant",
      description:
        "Describe your skin in your own words. Your AI advisor reads the signs, builds a routine around them and compares every formula, so your glow is matched, not guessed.",
      footnotes: ["Always on, always learning you. Your glow, intelligently matched."],
      ctaLabel: "GLOW WITH ME",
      onShop: () => document.dispatchEvent(new CustomEvent("agentic:open-assistant")),
    },
  ];

  const goToSlide = (next: number) =>
    setCurrentSlide((prev) => (next + heroSlides.length) % heroSlides.length);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isPlaying, heroSlides.length]);

  const activeSlide = heroSlides[currentSlide];

  return (
    <div className="figma-storefront">
      <UnifiedTopHeader navigate={navigate} openSearchOverlay={openSearchOverlay} />

      <main className="figma-storefront__page-inner">
        <section className={"figma-storefront__hero figma-storefront__hero--" + activeSlide.id}>
          <button
            type="button"
            className="figma-storefront__hero-arrow figma-storefront__hero-arrow--play"
            aria-label={isPlaying ? "Pause slideshow" : "Play slideshow"}
            aria-pressed={isPlaying}
            onClick={() => setIsPlaying((prev) => !prev)}
          >
            {isPlaying ? <PauseIcon width={16} height={16} /> : <PlayIcon width={16} height={16} />}
          </button>
          <button
            type="button"
            className="figma-storefront__hero-arrow figma-storefront__hero-arrow--left"
            aria-label="Previous slide"
            onClick={() => goToSlide(currentSlide - 1)}
          >
            <ChevronRightIcon width={16} height={16} />
          </button>
          <button
            type="button"
            className="figma-storefront__hero-arrow figma-storefront__hero-arrow--right"
            aria-label="Next slide"
            onClick={() => goToSlide(currentSlide + 1)}
          >
            <ChevronRightIcon width={16} height={16} />
          </button>
          <div className="figma-storefront__hero-overlay">
            <div className="figma-storefront__hero-content">
              <div className="figma-storefront__hero-copy">
                <span className="figma-storefront__hero-eyebrow">{activeSlide.eyebrow}</span>
                <h1>{activeSlide.title}</h1>
                <p>{activeSlide.description}</p>
              </div>
              <button type="button" onClick={activeSlide.onShop}>
                {"ctaLabel" in activeSlide ? activeSlide.ctaLabel : "SHOP NOW"}
              </button>
              {activeSlide.footnotes.length > 0 && (
                <div className="figma-storefront__hero-footnotes">
                  {activeSlide.footnotes.map((footnote) => (
                    <p key={footnote}>{footnote}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
          <img
            src={activeSlide.image}
            alt={activeSlide.imageAlt}
            className="figma-storefront__hero-image figma-storefront__hero-image--desktop"
          />
          <img
            src={activeSlide.imageMobile}
            alt={activeSlide.imageAlt}
            className="figma-storefront__hero-image figma-storefront__hero-image--mobile"
          />
          {"imageSplit" in activeSlide && (
            <img
              src={activeSlide.imageSplit}
              alt=""
              aria-hidden="true"
              className="figma-storefront__hero-image figma-storefront__hero-image--split"
            />
          )}
        </section>

        <section className="figma-storefront__tagline-banner" aria-label="Brand promise">
          <p className="figma-storefront__tagline-banner-text">
            Modern Tradition. Thoughtful Technology. Timeless Beauty.
          </p>
        </section>

        <section className="figma-storefront__section">
          <h2>Loved right now</h2>
          <div className="figma-storefront__featured-grid">
            {featuredProducts.map((product) => (
              <ProductCard key={product.slug} {...toProductCardProps(product)} onSelect={() => navigateToProduct(product.slug)} />
            ))}
          </div>
          <div className="figma-storefront__featured-banner">
            <img
              src={bannerVitalPerfection}
              alt="Shiseido Vital Perfection"
              className="figma-storefront__featured-banner-image"
            />
            <div className="figma-storefront__featured-banner-overlay">
              <div className="figma-storefront__featured-banner-content">
                <span className="figma-storefront__featured-banner-eyebrow">
                  POTENTIAL HAS NO AGE
                </span>
                <h2 className="figma-storefront__featured-banner-title">
                  VITAL
                  <br />
                  PERFECTION
                </h2>
                <p className="figma-storefront__featured-banner-subtitle">
                  Uplifting and Firming Advanced Cream
                </p>
                <p className="figma-storefront__featured-banner-description">
                  100% clinically proven. A firmer, brighter, and more lifted look in just 1 week*
                </p>
                <button
                  type="button"
                  className="figma-storefront__featured-banner-cta"
                  onClick={() => navigate(ROUTES.productListing, { series: ["vital-perfection"] })}
                >
                  LEARN MORE
                </button>
                <p className="figma-storefront__featured-banner-footnote">
                  *Clinically tested on 33 women.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="figma-storefront__section" aria-labelledby="home-collections-title">
          <h2 id="home-collections-title">Find your collection</h2>
          <div className="home-collections">
            {COLLECTION_BANNERS.map((banner, index) => {
              const count = products.filter((p) => (p.series as string | null) === banner.series).length;
              return (
                <a
                  key={banner.series}
                  href={ROUTES.productListing}
                  className={`home-collections__tile home-collections__tile--${index + 1}`}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(ROUTES.productListing, { series: [banner.series] });
                  }}
                >
                  <img
                    src={`${import.meta.env.BASE_URL}${banner.image}`}
                    alt=""
                    loading="lazy"
                    style={{ objectPosition: banner.position }}
                  />
                  <span className="home-collections__copy">
                    <span className="home-collections__name">{banner.name}</span>
                    <span className="home-collections__line">{banner.line}</span>
                    <span className="home-collections__cta">
                      Shop {count > 0 ? `${count} products` : "the collection"}
                      <ArrowRightIcon width={14} height={14} />
                    </span>
                  </span>
                </a>
              );
            })}
          </div>
        </section>

        <section className="figma-storefront__section">
          <h2>The rituals people come back to</h2>
          <p className="figma-storefront__subtitle">Explore Shiseido favorites for cleansing, treating, and protecting your skin.</p>
          <div className="figma-storefront__steps-grid">
            {spotlightProducts.map((product) => (
              <article key={product.slug} className="figma-storefront__step-card">
                <div
                  className="figma-storefront__step-card-image-shell"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigateToProduct(product.slug)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigateToProduct(product.slug);
                    }
                  }}
                >
                  <img src={product.imageUrl} alt={product.imageAlt} />
                </div>
                <button type="button" className="figma-storefront__step-card-link" onClick={() => navigateToProduct(product.slug)}>
                  <span>{product.title}</span>
                  <ArrowRightIcon width={16} height={16} />
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="home-ritual" aria-labelledby="home-ritual-title">
          <header className="home-ritual__header">
            <h2 id="home-ritual-title">A ritual in two steps</h2>
            <p>Most good skin days start the same way. Here's where to begin.</p>
          </header>
          {RITUAL_STEPS.map((step, index) => {
            const picks = products
              .filter((p) => p.category === step.catalogCategory && p.imageUrl)
              .sort((x, y) => (y.reviewCount ?? 0) * (y.rating ?? 0) - (x.reviewCount ?? 0) * (x.rating ?? 0))
              .slice(0, 3);
            const openShelf = () => navigate(ROUTES.productListing, { category: step.category });
            return (
              <article
                key={step.id}
                className={`home-ritual__row${index % 2 ? " home-ritual__row--flip" : ""}`}
              >
                <div className="home-ritual__media">
                  <img src={step.image} alt={step.imageAlt} loading="lazy" />
                  <span className="home-ritual__verb">
                    <span>{step.step}</span>
                    {step.verb}
                  </span>
                </div>
                <div className="home-ritual__panel">
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  {picks.length > 0 && (
                    <ul className="home-ritual__picks" aria-label={`Best-loved ${step.verb.toLowerCase()} picks`}>
                      {picks.map((p) => (
                        <li key={p.slug}>
                          <button type="button" onClick={() => navigateToProduct(p.slug)}>
                            <span className="home-ritual__pick-image">
                              <img src={p.imageUrl} alt="" loading="lazy" />
                            </span>
                            <span className="home-ritual__pick-name">{p.title}</span>
                            {p.priceFormatted && (
                              <span className="home-ritual__pick-price">{p.priceFormatted}</span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button type="button" className="home-ritual__cta" onClick={openShelf}>
                    {step.cta}
                    <ArrowRightIcon width={14} height={14} />
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      </main>

      <section className="figma-storefront__newsletter">
        <h3>Stay Updated</h3>
        <p>Be first to hear about Shiseido launches, skincare tips, and limited-time sets.</p>
        <form>
          <input type="email" value="hello@shiseido-demo.com" readOnly aria-label="Email address" />
          <button type="button">Join</button>
        </form>
      </section>

      <footer className="figma-storefront__footer">
        <div>
          <img src={shiseidoLogo} alt={SITE_BRAND} className="figma-storefront__footer-logo" />
          <div className="figma-storefront__footer-links">
            <a href={ROUTES.about} onClick={(event) => { event.preventDefault(); navigate(ROUTES.about); }}>About Us</a>
            <a href="#">Loyalty & Rewards</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Support</a>
          </div>
          <p>{SITE_FOOTER_COPY}</p>
        </div>
        <div className="figma-storefront__footer-right">
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Use</a>
        </div>
      </footer>
    </div>
  );
}
