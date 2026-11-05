// True only for FOUNDER_EMAIL (case-insensitive). False for everyone while it is unset or blank.
export const isFounder = (email: unknown, founder = process.env.FOUNDER_EMAIL) =>
  typeof email === "string" &&
  Boolean(email.trim() && founder?.trim()) &&
  email.trim().toLowerCase() === founder!.trim().toLowerCase();

export const isAdminPath = (path: string) => path === "/admin" || path.startsWith("/admin/");
