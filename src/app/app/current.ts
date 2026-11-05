import "server-only";
import { cookies } from "next/headers";

// The switcher's pick (Step 14). getCurrentBusiness honors it only for one of the caller's active
// self-serve businesses, else the oldest.
export const BUSINESS_COOKIE = "rank1_business";

export async function selectedBusinessId(): Promise<string | null> {
  return (await cookies()).get(BUSINESS_COOKIE)?.value ?? null;
}
