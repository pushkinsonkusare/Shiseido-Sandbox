import { useMemo, useState, type ReactNode } from "react";
import { useCatalog } from "../../catalog/CatalogContext";
import type { CatalogProduct } from "../../catalog/catalog";
import { ChevronRightIcon, SparkleIcon } from "../../components/icons/StorefrontIcons";
import { useSearchOverlay } from "../../components/SearchOverlay/SearchOverlayContext";
import { UnifiedTopHeader } from "../../components/UnifiedTopHeader/UnifiedTopHeader";
import { ROUTES, usePrototypeNavigation } from "../../prototypeRoutes";
import { SITE_BRAND, SITE_FOOTER_COPY } from "../../siteContent";
import { BLOG_ARTICLES, blogPhotoUrl, getBlogArticle, type BlogArticle, type BlogBlock } from "./blogArticles";
import "./BlogPage.css";

const TOPICS = ["All", "Routines", "Sun care", "Skin concerns", "Men"] as const;
type TopicFilter = (typeof TOPICS)[number];

/** Opens the advisor with the question as the shopper's own turn. */
function askAdvisor(prompt: string) {
  document.dispatchEvent(new CustomEvent("agentic:ask-assistant", { detail: { prompt } }));
}

function useProductsByTitle() {
  const { products } = useCatalog();
  return useMemo(() => new Map(products.map((p) => [p.title, p])), [products]);
}

function BlogShell({ children }: { children: ReactNode }) {
  const { navigate } = usePrototypeNavigation();
  const { openSearchOverlay } = useSearchOverlay();
  return (
    <div className="blog">
      <UnifiedTopHeader navigate={navigate} openSearchOverlay={openSearchOverlay} />
      <div className="blog__inner">
        {children}
        <footer className="blog__footer">
          <div>
            <strong>{SITE_BRAND}</strong>
            <p>{SITE_FOOTER_COPY}</p>
          </div>
          <div className="blog__footer-links">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Use</a>
          </div>
        </footer>
      </div>
    </div>
  );
}

function ArticlePhoto({ article, eager = false }: { article: BlogArticle; eager?: boolean }) {
  return (
    <img
      src={blogPhotoUrl(article.slug)}
      alt={article.photoAlt}
      loading={eager ? "eager" : "lazy"}
      style={{ objectPosition: article.photoPosition }}
    />
  );
}

function ArticleCard({ article, featured = false }: { article: BlogArticle; featured?: boolean }) {
  const { navigateToBlogArticle } = usePrototypeNavigation();
  const href = `${ROUTES.blog}/${article.slug}`;
  return (
    <a
      href={href}
      className={featured ? "blog-card blog-card--featured" : "blog-card"}
      onClick={(event) => {
        event.preventDefault();
        navigateToBlogArticle(article.slug);
      }}
    >
      <span className="blog-card__media">
        <ArticlePhoto article={article} eager={featured} />
      </span>
      <span className="blog-card__body">
        <span className="blog-card__meta">
          {article.topic} · {article.readMinutes} min read
        </span>
        <span className="blog-card__title">{article.title}</span>
        <span className="blog-card__dek">{article.dek}</span>
        {featured && <span className="blog-card__cta">Read the guide</span>}
      </span>
    </a>
  );
}

export function BlogIndexPage() {
  const [topic, setTopic] = useState<TopicFilter>("All");
  const visible = topic === "All" ? BLOG_ARTICLES : BLOG_ARTICLES.filter((a) => a.topic === topic);
  const [featured, ...rest] = visible;

  return (
    <BlogShell>
      <header className="blog-index__hero">
        <p className="blog__eyebrow">Shiseido Skincare Blog</p>
        <h1 className="blog-index__title">Skin, explained</h1>
        <p className="blog-index__lede">
          Plain-spoken guides to routines, ingredients and skin concerns, from 150 years of Japanese skincare science.
        </p>
      </header>

      <div className="blog-index__topics" role="group" aria-label="Filter by topic">
        {TOPICS.map((t) => (
          <button
            key={t}
            type="button"
            className="blog-index__topic"
            aria-pressed={topic === t}
            onClick={() => setTopic(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {featured && (
        <ArticleCard article={featured} featured />
      )}
      {rest.length > 0 && (
        <div className="blog-index__grid">
          {rest.map((a) => (
            <ArticleCard key={a.slug} article={a} />
          ))}
        </div>
      )}
    </BlogShell>
  );
}

function Block({ block }: { block: BlogBlock }) {
  switch (block.kind) {
    case "p":
      return <p className="blog-article__p">{block.text}</p>;
    case "h2":
      return <h2 className="blog-article__h2">{block.text}</h2>;
    case "list":
      return (
        <ul className="blog-article__list">
          {block.items.map((item) => (
            <li key={item.term ?? item.text}>
              {item.term && <strong>{item.term}. </strong>}
              {item.text}
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="blog-article__steps">
          {block.items.map((item, i) => (
            <li key={item.title}>
              <span className="blog-article__step-num" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>
                <strong>{item.title}</strong>
                {item.text}
              </span>
            </li>
          ))}
        </ol>
      );
    case "tip":
      return (
        <aside className="blog-article__tip">
          <strong>Tip</strong>
          {block.text}
        </aside>
      );
  }
}

export function BlogArticlePage() {
  const { currentBlogSlug, navigate, navigateToProduct } = usePrototypeNavigation();
  const productsByTitle = useProductsByTitle();
  const article = getBlogArticle(currentBlogSlug);

  if (!article) {
    return (
      <BlogShell>
        <div className="blog-article__missing">
          <h1>We couldn't find that article.</h1>
          <button type="button" className="blog-article__back" onClick={() => navigate(ROUTES.blog)}>
            Browse the Skincare Blog
          </button>
        </div>
      </BlogShell>
    );
  }

  const shop = article.shop
    .map((title) => productsByTitle.get(title))
    .filter((p): p is CatalogProduct => Boolean(p));
  const more = BLOG_ARTICLES.filter((a) => a.slug !== article.slug)
    .sort((a, b) => Number(b.topic === article.topic) - Number(a.topic === article.topic))
    .slice(0, 3);

  return (
    <BlogShell>
      <nav className="blog__breadcrumbs" aria-label="Breadcrumb">
        <a
          href={ROUTES.home}
          onClick={(event) => {
            event.preventDefault();
            navigate(ROUTES.home);
          }}
        >
          Home
        </a>
        <ChevronRightIcon width={14} height={14} />
        <a
          href={ROUTES.blog}
          onClick={(event) => {
            event.preventDefault();
            navigate(ROUTES.blog);
          }}
        >
          Skincare Blog
        </a>
        <ChevronRightIcon width={14} height={14} />
        <span aria-current="page">{article.title}</span>
      </nav>

      <article className="blog-article">
        <header className="blog-article__header">
          <div className="blog-article__heading">
            <p className="blog__eyebrow">
              {article.topic} · {article.readMinutes} min read
            </p>
            <h1 className="blog-article__title">{article.title}</h1>
            <p className="blog-article__dek">{article.dek}</p>
          </div>
          <div className="blog-article__hero">
            <ArticlePhoto article={article} eager />
          </div>
        </header>

        <div className="blog-article__layout">
          <div className="blog-article__body">
            {article.body.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </div>

          <aside className="blog-article__ask" aria-labelledby="blog-ask-title">
            <span className="blog-article__ask-icon" aria-hidden="true">
              <SparkleIcon width={18} height={18} />
            </span>
            <h2 id="blog-ask-title" className="blog-article__ask-title">
              Make it personal
            </h2>
            <p className="blog-article__ask-copy">Ask the Beauty Advisor to apply this guide to your skin.</p>
            <ul className="blog-article__ask-pills">
              {article.asks.map((ask) => (
                <li key={ask.label}>
                  <button type="button" className="blog-article__ask-pill" onClick={() => askAdvisor(ask.prompt)}>
                    {ask.label}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>

        {shop.length > 0 && (
          <section className="blog-article__shop" aria-labelledby="blog-shop-title">
            <h2 id="blog-shop-title" className="blog-article__section-title">
              Shop the routine
            </h2>
            <ul className="blog-article__shop-grid">
              {shop.map((p) => (
                <li key={p.slug}>
                  <a
                    href={`/products/${p.slug}`}
                    className="blog-product"
                    onClick={(event) => {
                      event.preventDefault();
                      navigateToProduct(p.slug);
                    }}
                  >
                    <span className="blog-product__media">
                      <img src={p.imageUrl} alt="" loading="lazy" />
                    </span>
                    <span className="blog-product__brand">{p.brand}</span>
                    <span className="blog-product__title">{p.title}</span>
                    <span className="blog-product__price">{p.priceFormatted}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>

      <section className="blog-article__more" aria-labelledby="blog-more-title">
        <h2 id="blog-more-title" className="blog-article__section-title">
          More from the blog
        </h2>
        <div className="blog-index__grid">
          {more.map((a) => (
            <ArticleCard key={a.slug} article={a} />
          ))}
        </div>
      </section>
    </BlogShell>
  );
}
