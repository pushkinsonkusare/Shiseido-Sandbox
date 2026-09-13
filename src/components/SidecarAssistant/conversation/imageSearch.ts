import type { CatalogProduct } from "../../../catalog/catalog";
import { getOpenAIClient, getOpenAIModel, isLlmConfigured } from "../../../lib/openaiClient";

const VISION_MAX_EDGE = 512;
const VISION_TARGET_DATA_URL_CHARS = 280_000;
const PACK_HASH_SIZE = 32;
const PACK_SCAN_MAX_EDGE = 160;
const PACK_WHITE_MIN = 248;
const PACK_FETCH_CONCURRENCY = 10;
const PACK_FETCH_TIMEOUT_MS = 8000;
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
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
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

  const seenTokens = new Set<string>();
  for (const token of tokenize(hay)) {
    if (seenTokens.has(token)) continue;
    seenTokens.add(token);
    if (queryTokens.has(token) || queryCompact.includes(token)) {
      score += token.length >= 6 ? 3 : token.length >= 4 ? 2 : 1;
    }
  }

  const spf = product.title.match(/spf\s*(\d+)/i);
  if (spf && new RegExp(`spf\\s*0*${spf[1]}\\b`, "i").test(text)) {
    score += 8;
  } else if (spf && !/\bspf\b/i.test(text)) {
    score -= 12;
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
  if (best.score < 14) return undefined;
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

type PackFingerprint = {
  hash: bigint;
  coverage: number;
};

type PackScore = {
  product: CatalogProduct;
  hamming: number;
};

const packFingerprintCache = new Map<string, Promise<PackFingerprint | null>>();

function popcount(value: bigint): number {
  let bits = 0;
  let x = value;
  while (x) {
    x &= x - 1n;
    bits += 1;
  }
  return bits;
}

function hammingDistance(left: bigint, right: bigint): number {
  return popcount(left ^ right);
}

function canvasContext(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } | null {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  return { canvas, context };
}

function fingerprintBitmap(bitmap: ImageBitmap): PackFingerprint | null {
  const scale = Math.min(
    1,
    PACK_SCAN_MAX_EDGE / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const scan = canvasContext(width, height);
  if (!scan) return null;
  scan.context.drawImage(bitmap, 0, 0, width, height);
  let pixels: ImageData;
  try {
    pixels = scan.context.getImageData(0, 0, width, height);
  } catch {
    return null;
  }

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let foreground = 0;
  const { data } = pixels;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      if (
        alpha < 8 ||
        (red > PACK_WHITE_MIN && green > PACK_WHITE_MIN && blue > PACK_WHITE_MIN)
      ) {
        continue;
      }
      foreground += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  const coverage = foreground / (width * height);
  if (coverage < 0.02 || maxX <= minX || maxY <= minY) return null;

  const crop = canvasContext(PACK_HASH_SIZE, PACK_HASH_SIZE);
  if (!crop) return null;
  crop.context.drawImage(
    scan.canvas,
    minX,
    minY,
    maxX - minX + 1,
    maxY - minY + 1,
    0,
    0,
    PACK_HASH_SIZE,
    PACK_HASH_SIZE,
  );
  let cropPixels: ImageData;
  try {
    cropPixels = crop.context.getImageData(0, 0, PACK_HASH_SIZE, PACK_HASH_SIZE);
  } catch {
    return null;
  }

  const gray: number[] = [];
  let total = 0;
  for (let i = 0; i < PACK_HASH_SIZE * PACK_HASH_SIZE; i += 1) {
    const index = i * 4;
    const value =
      0.299 * cropPixels.data[index] +
      0.587 * cropPixels.data[index + 1] +
      0.114 * cropPixels.data[index + 2];
    gray.push(value);
    total += value;
  }
  const average = total / gray.length;
  let hash = 0n;
  for (let i = 0; i < gray.length; i += 1) {
    if (gray[i] >= average) hash |= 1n << BigInt(i);
  }
  return { hash, coverage };
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

async function fetchImageBlob(url: string): Promise<Blob | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(
    () => controller.abort(),
    PACK_FETCH_TIMEOUT_MS,
  );
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

async function bitmapFromUrl(url: string): Promise<ImageBitmap | null> {
  const blob = await fetchImageBlob(url);
  if (!blob) return null;
  try {
    return await blobToBitmap(blob);
  } catch {
    return null;
  }
}

function fingerprintFromUrl(url: string): Promise<PackFingerprint | null> {
  const cached = packFingerprintCache.get(url);
  if (cached) return cached;
  const pending = (async () => {
    const bitmap = await bitmapFromUrl(url);
    if (!bitmap) return null;
    try {
      return fingerprintBitmap(bitmap);
    } finally {
      bitmap.close();
    }
  })();
  packFingerprintCache.set(url, pending);
  return pending;
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await mapper(items[index]);
      }
    }),
  );
  return results;
}

function isConfidentPackShot(best: PackScore, second: PackScore | undefined): boolean {
  const gap = second ? second.hamming - best.hamming : PACK_HASH_SIZE * PACK_HASH_SIZE;
  /* Only treat near-duplicate catalog stills as a hash match. Similar
   * jars (Vital Perfection cream vs day cream) sit ~20 bits apart, so
   * a looser threshold picked the wrong sibling and skipped vision. */
  if (best.hamming <= 3 && gap >= 4) return true;
  if (best.hamming <= 3 && !second) return true;
  return false;
}

async function matchProductFromPackShot(
  shopper: PackFingerprint,
  products: CatalogProduct[],
): Promise<CatalogProduct | undefined> {
  if (shopper.coverage < 0.02) return undefined;

  const scored: PackScore[] = [];
  await mapPool(products, PACK_FETCH_CONCURRENCY, async (product) => {
    if (!product.imageUrl) return;
    const fingerprint = await fingerprintFromUrl(product.imageUrl);
    if (!fingerprint) return;
    scored.push({
      product,
      hamming: hammingDistance(shopper.hash, fingerprint.hash),
    });
  });

  scored.sort((left, right) => left.hamming - right.hamming);
  const best = scored[0];
  const second = scored[1];
  if (!best || !isConfidentPackShot(best, second)) return undefined;
  return best.product;
}

function bitmapToJpegDataUrl(
  bitmap: ImageBitmap,
  maxEdge: number,
  quality: number,
): string {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not read the photo.");
  context.drawImage(bitmap, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

function compressBitmapForVision(bitmap: ImageBitmap): string {
  let maxEdge = VISION_MAX_EDGE;
  let quality = 0.62;
  let dataUrl = bitmapToJpegDataUrl(bitmap, maxEdge, quality);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (dataUrl.length <= VISION_TARGET_DATA_URL_CHARS) return dataUrl;
    quality = Math.max(0.4, quality - 0.12);
    maxEdge = Math.round(maxEdge * 0.75);
    dataUrl = bitmapToJpegDataUrl(bitmap, maxEdge, quality);
  }
  return dataUrl;
}

function parseVisionPayload(raw: string): {
  slug: string | null;
  visibleText: string;
} {
  try {
    const parsed = JSON.parse(raw) as {
      slug?: unknown;
      visibleText?: unknown;
      packNotes?: unknown;
    };
    const slug = typeof parsed.slug === "string" ? parsed.slug.trim() : "";
    const visibleText = [
      typeof parsed.visibleText === "string" ? parsed.visibleText.trim() : "",
      typeof parsed.packNotes === "string" ? parsed.packNotes.trim() : "",
    ]
      .filter(Boolean)
      .join(" ");
    return {
      slug: slug && slug.toLowerCase() !== "null" ? slug : null,
      visibleText,
    };
  } catch {
    return { slug: null, visibleText: "" };
  }
}

function isPayloadTooLarge(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  const message = error instanceof Error ? error.message : String(error);
  return status === 413 || /413|payload too large|request too large/i.test(message);
}

function resolveVisionMatch(
  slug: string | null,
  visibleText: string,
  products: CatalogProduct[],
): CatalogProduct | undefined {
  const fromText = visibleText
    ? matchProductFromVisibleText(visibleText, products)
    : undefined;
  if (fromText) return fromText;

  if (!slug) return undefined;
  const bySlug = products.find((product) => product.slug === slug);
  if (!bySlug) return undefined;

  if (
    isMensLine(bySlug) &&
    /ultimune/i.test(visibleText) &&
    !mentionsMensPackaging(visibleText)
  ) {
    return (
      products.find((product) => product.slug === "ultimune-power-infusing-serum") ??
      bySlug
    );
  }

  return bySlug;
}

async function identifyWithVision(
  bitmap: ImageBitmap,
  products: CatalogProduct[],
  dataUrl: string,
): Promise<CatalogProduct | undefined> {
  const client = getOpenAIClient();
  if (!client) return undefined;

  const requestOcr = (imageDataUrl: string) =>
    client.chat.completions.create({
      model: getOpenAIModel(),
      temperature: 0,
      max_tokens: 250,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Read the product packaging in the shopper photo. Return json {"visibleText": string, "packNotes": string}. visibleText is every printed word you can actually read (brand, collection, product name, SPF). packNotes is color and shape (red bottle, gold jar, white tube). If there is no product packaging, return {"visibleText":"","packNotes":""}. Do not invent a product name.',
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Transcribe the packaging and describe it. Return json.",
            },
            {
              type: "image_url",
              image_url: { url: imageDataUrl, detail: "high" },
            },
          ],
        },
      ],
    });

  let ocrDataUrl = dataUrl;
  let completion;
  try {
    completion = await requestOcr(ocrDataUrl);
  } catch (error) {
    if (!isPayloadTooLarge(error)) throw error;
    ocrDataUrl = bitmapToJpegDataUrl(bitmap, 320, 0.42);
    completion = await requestOcr(ocrDataUrl);
  }

  const ocr = parseVisionPayload(completion.choices[0]?.message?.content?.trim() ?? "");
  const fromOcr = resolveVisionMatch(ocr.slug, ocr.visibleText, products);
  if (fromOcr) return fromOcr;
  if (!ocr.visibleText) return undefined;

  const catalog = products
    .map((product) => {
      const collection = product.model || product.series || "";
      const pack = packagingHint(product);
      return `${product.slug} | ${product.title}${
        collection ? ` | ${collection}` : ""
      }${pack ? ` | ${pack}` : ""}`;
    })
    .join("\n");

  const catalogCompletion = await client.chat.completions.create({
    model: getOpenAIModel(),
    temperature: 0,
    max_tokens: 200,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          'Pick the matching catalog slug from packaging text. Red Ultimune Power Infusing Serum is not Shiseido Men Ultimune. Urban Environment Oil-Control SPF 40 is not Fresh-Moisture SPF 40. Return json {"slug": string|null}. If two rows still fit, return {"slug":null}. Never guess a recently purchased SKU.',
      },
      {
        role: "user",
        content: `Packaging: ${ocr.visibleText}\n\nCatalog (slug | title | collection):\n${catalog}`,
      },
    ],
  });
  const { slug } = parseVisionPayload(
    catalogCompletion.choices[0]?.message?.content?.trim() ?? "",
  );
  return resolveVisionMatch(slug, ocr.visibleText, products);
}

/**
 * Resolve a shopper photo to a catalog SKU.
 * Filename / catalog-id match is instant. White-background pack shots
 * are matched locally against catalog images so GitHub Pages still
 * works when the vision proxy rejects a large request. Vision reads
 * packaging for camera photos when an LLM is configured.
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

  const bitmap = await bitmapFromUrl(imageUrl);
  if (!bitmap) return null;

  try {
    const shopperPrint = fingerprintBitmap(bitmap);
    if (shopperPrint) {
      const fromPack = await matchProductFromPackShot(shopperPrint, products);
      if (fromPack) return fromPack;
    }

    if (!isLlmConfigured()) return null;

    const dataUrl = compressBitmapForVision(bitmap);
    return (await identifyWithVision(bitmap, products, dataUrl)) ?? null;
  } catch (error) {
    console.error("[imageSearch] identify failed", error);
    return null;
  } finally {
    bitmap.close();
  }
}
