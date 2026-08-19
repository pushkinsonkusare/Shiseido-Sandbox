const STORAGE_KEY = "nto-site-gate";
const STORAGE_VALUE = "ok";

/** SHA-256 of the shared preview password. Override at build time with
 *  `VITE_SITE_PASSWORD_HASH` if you need to rotate it. */
const PASSWORD_HASH =
  (import.meta.env.VITE_SITE_PASSWORD_HASH as string | undefined)?.trim() ||
  "d4f0bc5a29de06b510f9aa428f1eedba926012b591fef7a518e776a7c9bd1824";

export async function hashPassword(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function isSiteUnlocked(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === STORAGE_VALUE;
  } catch {
    return false;
  }
}

export function unlockSite(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, STORAGE_VALUE);
  } catch {
    /* Private mode can refuse storage; the session still proceeds. */
  }
}

export async function checkSitePassword(value: string): Promise<boolean> {
  const hash = await hashPassword(value.trim());
  return hash === PASSWORD_HASH;
}
