import "server-only";
import { createHash } from "node:crypto";

// Vercel sets x-forwarded-for; its first entry is the visitor.
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip")?.trim() || "unknown";
}

// SHA-256 of IP + IP_HASH_SALT, so raw IPs are never stored. No salt is a config error.
export function hashIp(ip: string, salt = process.env.IP_HASH_SALT): string {
  if (!salt) throw new Error("IP_HASH_SALT is not set");
  return createHash("sha256")
    .update(ip + salt)
    .digest("hex");
}
