import type { CatalogProduct } from "../../../catalog/catalog";
import { getOpenAIClient, getOpenAIModel, isLlmConfigured } from "../../../lib/openaiClient";

const VISION_MAX_EDGE = 768;
const VISION_TARGET_DATA_URL_CHARS = 550_000;
const GENERIC_FILE_STEM =
  /^(camera-?photo|image|img|photo|screenshot|untitled|download)(\s*\d+)?$/i;
const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "your",
  "new",
  "shiseido",
  "size",
  "fl",
  "oz",
]);

export const IMAGE_IDENTIFIED_PROMPT =
  "Let me know what you wish to do with this.";

export function buildImageIdentifiedBody(product: CatalogProduct): string {
  return `I can see you are showing me ${product.title}. ${IMAGE_IDENTIFIED_PROMPT}`;
}

export function buildImageUnmatchedBody(): string {
  return "I can see the photo, but I couldn't match it to a product in our catalog. Tell me the name, or try a clearer shot of the packaging.";
}

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => {
      if (!token) return false;
      if (/^\d+$/.test(token)) return token.length >= 2;
      return token.length >= 3 && !STOP_WORDS.has(token);
    });
}

function productSearchText(product: CatalogProduct): string {
  return [
    product.title,
    product.model,
    product.series?.replace(/-/g, " "),
    product.category,
    product.slug.replace(/-/g, " "),
  ]
    .filter(Boolean)
    .join(" ");
}

function isMensLine(product: CatalogProduct): boolean {
  return (
    /shiseido-men/.test(product.slug) ||
    /shiseido-men/.test(product.series || "") ||
    /^shiseido\s*men$/i.test(product.model || "")
  );
}

function mentionsMensPackaging(text: string): boolean {
  return /\b(shiseido\s*men|for men|male skin|men'?s)\b/i.test(text);
}

function packagingHint(product: CatalogProduct): string {
  if (product.id === "9990000000232") return "red glass bottle";
  if (product.slug === "shiseido-men-ultimune-power-infusing-serum") {
    return "black bottle, SHISEIDO MEN on pack";
  }
  return "";
}

function phraseBonus(queryCompact: string, title: string): number {
  const words = tokenize(title);
  let bonus = 0;
  for (let n = Math.min(4, words.length); n >= 2; n--) {
    for (let i = 0; i <= words.length - n; i++) {
      const phrase = words.slice(i, i + n).join("");
      if (phrase.length >= 8 && queryCompact.includes(phrase)) {
        bonus += n * 4;
      }
    }
  }
  return bonus;
}

function scoreProductAgainstText(text: string, product: CatalogProduct): number {
  const queryCompact = compact(text);
  if (queryCompact.length < 4) return 0;
  const queryTokens = new Set(tokenize(text));
  const hay = productSearchText(product);
  const titleCompact = compact(product.title);
  let score = 0;

  if (titleCompact.length >= 10 && queryCompact.includes(titleCompact)) {
    score += 40;
  }

  score += phraseBonus(queryCompact, product.title);

  for (const token of tokenize(hay)) {
    if (queryTokens.has(token) || queryCompact.includes(token)) {
      score += token.length >= 6 ? 3 : token.length >= 4 ? 2 : 1;
    }
  }

  const spf = product.title.match(/spf\s*(\d+)/i);
  if (spf && new RegExp(`spf\\s*0*${spf[1]}\\b`, "i").test(text)) {
    score += 8;
  }

  const productId = product.id || product.sku;
  if (productId && productId.length >= 8 && text.includes(productId)) {
    score += 50;
  }

  if (isMensLine(product) && !mentionsMensPackaging(text)) {
    score -= 30;
  } else if (
    !isMensLine(product) &&
    mentionsMensPackaging(text) &&
    /ultimune/i.test(product.title)
  ) {
    score -= 20;
  }

  if (/\bred\b/i.test(text) && product.id === "9990000000232") score += 15;
  if (/\bblack\b/i.test(text) && isMensLine(product)) score += 10;

  return score;
}

/**
 * Match OCR / filename / packaging words to a unique catalog SKU.
 * Prefers a clear winner (full title or a decisive score gap) so
 * "Oil-Control SPF 40" does not collapse into a sibling sunscreen.
 */
export function matchProductFromVisibleText(
  text: string,
  products: CatalogProduct[],
): CatalogProduct | undefined {
  const query = text.trim();
  if (query.length < 4) return undefined;

  const scored = products
    .map((product) => ({
      product,
      score: scoreProductAgainstText(query, product),
    }))
    .sort((left, right) => right.score - left.score);

  const best = scored[0];
  const second = scored[1];
  if (!best || best.score < 10) return undefined;

  const queryCompact = compact(query);
  const bestTitle = compact(best.product.title);
  const secondTitle = second ? compact(second.product.title) : "";
  const uniqueTitleHit =
    bestTitle.length >= 10 &&
    queryCompact.includes(bestTitle) &&
    !(secondTitle.length >= 10 && queryCompact.includes(secondTitle));

  if (uniqueTitleHit) return best.product;
  if (second && second.score >= best.score - 3 && second.score >= 10) {
    return undefined;
  }
  return best.product;
}

function matchProductFromCatalogId(
  fileName: string,
  products: CatalogProduct[],
): CatalogProduct | undefined {
  const ids = fileName.match(/\d{8,}/g) ?? [];
  for (const id of ids) {
    const hits = products.filter(
      (product) => product.id === id || product.sku === id,
    );
    if (hits.length === 1) return hits[0];
  }
  return undefined;
}

export function matchProductFromFileName(
  fileName: string | null | undefined,
  products: CatalogProduct[],
): CatalogProduct | undefined {
  if (!fileName) return undefined;
  const stem = fileName
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!stem || GENERIC_FILE_STEM.test(stem)) return undefined;

  const fromId = matchProductFromCatalogId(fileName, products);
  if (fromId) return fromId;

  if (/banner[-_\s]?ultimune/i.test(fileName)) {
    const heroUltimune = products.find(
      (product) => product.slug === "ultimune-power-infusing-serum",
    );
    if (heroUltimune) return heroUltimune;
  }

  const slugGuess = stem.replace(/\s+/g, "-");
  const bySlug = products.find((product) => product.slug === slugGuess);
  if (bySlug) return bySlug;

  return matchProductFromVisibleText(stem, products);
}

async function blobToBitmap(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob);
  } catch {
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("Could not read the photo."));
        element.src = objectUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, image.naturalWidth || image.width);
      canvas.height = Math.max(1, image.naturalHeight || image.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not read the photo.");
      context.drawImage(image, 0, 0);
      return await createImageBitmap(canvas);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

async function imageUrlToDataUrl(url: string): Promise<string> {
  const blob = await fetch(url).then((response) => {
    if (!response.ok) throw new Error("Could not read the photo.");
    return response.blob();
  });
  const bitmap = await blobToBitmap(blob);
  let maxEdge = VISION_MAX_EDGE;
  let quality = 0.72;
  let dataUrl = "";
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not read the photo.");
      context.drawImage(bitmap, 0, 0, width, height);
      dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length <= VISION_TARGET_DATA_URL_CHARS) return dataUrl;
      quality = Math.max(0.45, quality - 0.16);
      maxEdge = Math.round(maxEdge * 0.75);
    }
  } finally {
    bitmap.close();
  }
  return dataUrl;
}

function parseVisionPayload(raw: string): { slug: string | null; visibleText: string } {
  try {
    const parsed = JSON.parse(raw) as { slug?: unknown; visibleText?: unknown };
    const slug = typeof parsed.slug === "string" ? parsed.slug.trim() : "";
    const visibleText =
      typeof parsed.visibleText === "string" ? parsed.visibleText.trim() : "";
    return {
      slug: slug && slug.toLowerCase() !== "null" ? slug : null,
      visibleText,
    };
  } catch {
    return { slug: null, visibleText: "" };
  }
}

async function identifyWithVision(
  imageUrl: string,
  products: CatalogProduct[],
): Promise<CatalogProduct | undefined> {
  const client = getOpenAIClient();
  if (!client) return undefined;
  const dataUrl = await imageUrlToDataUrl(imageUrl);
  const catalog = products
    .map((product) => {
      const collection = product.model || product.series || "";
      const pack = packagingHint(product);
      return `${product.slug} | ${product.title} | ${product.category}${
        collection ? ` | ${collection}` : ""
      }${pack ? ` | ${pack}` : ""}`;
    })
    .join("\n");
  const completion = await client.chat.completions.create({
    model: getOpenAIModel(),
    temperature: 0,
    max_tokens: 300,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          'Identify which Shiseido catalog product appears in the shopper photo. Read every word on the packaging (collection, product name, SPF) and note bottle color. The iconic red Ultimune Power Infusing Serum (Ultimune collection) is not the black Shiseido Men Ultimune. Several Urban Environment sunscreens look similar — Oil-Control SPF 40 is not Fresh Moisture SPF 40. Return JSON {"visibleText": string, "slug": string|null}. visibleText must be the words you can actually read. Set slug only when that text uniquely matches one catalog row. If the photo is a person, a room, a selfie, or the product is unclear, return {"visibleText":"","slug":null}. Never guess a popular or recently purchased SKU.',
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Catalog (slug | title | category | collection):\n${catalog}`,
          },
          {
            type: "image_url",
            image_url: { url: dataUrl, detail: "high" },
          },
        ],
      },
    ],
  });
  const raw = completion.choices[0]?.message?.content?.trim() ?? "";
  const { slug, visibleText } = parseVisionPayload(raw);
  const fromText = visibleText
    ? matchProductFromVisibleText(visibleText, products)
    : undefined;
  if (fromText) return fromText;

  if (slug && visibleText) {
    const bySlug = products.find((product) => product.slug === slug);
    if (bySlug && scoreProductAgainstText(visibleText, bySlug) >= 8) {
      return bySlug;
    }
  }
  return undefined;
}

/**
 * Resolve a shopper photo to a catalog SKU. Filename / catalog-id match
 * is instant; vision reads packaging when an LLM is configured.
 * Returns null when the photo cannot be matched — never a random
 * fallback SKU (that used to answer as the last order).
 */
export async function identifyCatalogProductFromImage(
  imageUrl: string,
  products: CatalogProduct[],
  options?: { fileName?: string | null },
): Promise<CatalogProduct | null> {
  const fromName = matchProductFromFileName(options?.fileName, products);
  if (fromName) return fromName;

  if (!isLlmConfigured()) return null;

  try {
    return (await identifyWithVision(imageUrl, products)) ?? null;
  } catch (error) {
    console.error("[imageSearch] vision identify failed", error);
    return null;
  }
}
