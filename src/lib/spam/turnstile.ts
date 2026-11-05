import "server-only";

// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
export const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// True only when Cloudflare says success. Missing secret, missing token or a network error fail closed.
export async function verifyTurnstile(token: unknown, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || typeof token !== "string" || token.length === 0 || token.length > 2048) return false;
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret, response: token, ...(ip !== "unknown" && { remoteip: ip }) }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
