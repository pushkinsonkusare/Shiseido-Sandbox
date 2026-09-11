import type { CatalogProduct } from "../../../catalog/catalog";
import { getOpenAIClient, getOpenAIModel, isLlmConfigured } from "../../../lib/openaiClient";

const VISION_MAX_EDGE = 768;
const GENERIC_FILE_STEM =
  /^(camera-?photo|image|img|photo|screenshot|untitled|download)(\s*\d+)?$/i;

export const IMAGE_IDENTIFIED_PROMPT =
  "Let me know what you wish to do with this.";

export function buildImageIdentifiedBody(product: CatalogProduct): string {
  return `I can see you are showing me ${product.title}. ${IMAGE_IDENTIFIED_PROMPT}`;
}

export function buildImageUnmatchedBody(): string {
  return "I can see the photo, but I couldn't match it to a product in our catalog. Tell me the name, or try a clearer shot of the packaging.";
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

  const slugGuess = stem.replace(/\s+/g, "-");
  const bySlug = products.find((product) => product.slug === slugGuess);
  if (bySlug) return bySlug;

  const compact = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const needle = compact(stem);
  if (needle.length < 6) return undefined;
  const hits = products.filter((product) => {
    const title = compact(product.title);
    const slug = compact(product.slug);
    return title.includes(needle) || slug.includes(needle) || needle.includes(slug);
  });
  return hits.length === 1 ? hits[0] : undefined;
}

async function imageUrlToDataUrl(url: string): Promise<string> {
  const blob = await fetch(url).then((response) => {
    if (!response.ok) throw new Error("Could not read the photo.");
    return response.blob();
  });
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, VISION_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Could not read the photo.");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

function parseIdentifiedSlug(raw: string, products: CatalogProduct[]): CatalogProduct | undefined {
  try {
    const parsed = JSON.parse(raw) as { slug?: unknown };
    const slug = typeof parsed.slug === "string" ? parsed.slug.trim() : "";
    if (!slug || slug.toLowerCase() === "null") return undefined;
    return products.find((product) => product.slug === slug);
  } catch {
    return undefined;
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
      const collection = product.series ? ` | ${product.series}` : "";
      return `${product.slug} | ${product.title} | ${product.category}${collection}`;
    })
    .join("\n");
  const completion = await client.chat.completions.create({
    model: getOpenAIModel(),
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          'Identify which Shiseido catalog product appears in the shopper photo. Return JSON {"slug": string|null}. Only return a catalog slug when packaging or the product itself is clearly visible. If the photo is a person, a room, a selfie, or otherwise unclear, return {"slug": null}.',
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
            image_url: { url: dataUrl, detail: "low" },
          },
        ],
      },
    ],
  });
  const raw = completion.choices[0]?.message?.content?.trim() ?? "";
  return parseIdentifiedSlug(raw, products);
}

/**
 * Resolve a shopper photo to a catalog SKU. Filename match is instant;
 * vision runs when an LLM is configured; otherwise a demo fallback SKU
 * (typically a recent order) keeps the flow usable without an API key.
 */
export async function identifyCatalogProductFromImage(
  imageUrl: string,
  products: CatalogProduct[],
  options?: { fileName?: string | null; fallbackSlug?: string | null },
): Promise<CatalogProduct | null> {
  const fromName = matchProductFromFileName(options?.fileName, products);
  if (fromName) return fromName;

  if (isLlmConfigured()) {
    try {
      const fromVision = await identifyWithVision(imageUrl, products);
      if (fromVision) return fromVision;
      return null;
    } catch (error) {
      console.error("[imageSearch] vision identify failed", error);
    }
  }

  const fallbackSlug = options?.fallbackSlug;
  if (!fallbackSlug) return null;
  return products.find((product) => product.slug === fallbackSlug) ?? null;
}
