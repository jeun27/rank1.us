import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Provider tokens are stored only as AES-256-GCM ciphertext: "v1.<iv>.<tag>.<ciphertext>" (base64url,
// 12-byte random IV, 16-byte tag). The key is GOOGLE_TOKEN_ENCRYPTION_KEY (32 bytes, base64), set by the lead.
export class TokenKeyError extends Error {
  constructor() {
    super("not_configured");
  }
}

export function tokenKey(env: Record<string, string | undefined> = process.env): Buffer {
  const key = Buffer.from(env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? "", "base64");
  if (key.length !== 32) throw new TokenKeyError();
  return key;
}

export function encryptToken(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), ct]
    .map((p) => (typeof p === "string" ? p : p.toString("base64url")))
    .join(".");
}

// Throws on any tampering, a wrong key or an unknown format (GCM authenticates the ciphertext).
export function decryptToken(enc: string, key: Buffer): string {
  const [v, iv, tag, ct, ...rest] = enc.split(".");
  if (v !== "v1" || !iv || !tag || ct === undefined || rest.length) throw new Error("bad token format");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
