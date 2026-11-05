import "server-only";

// Stand-ins for data-pipeline's Step 14 Stripe functions (src/lib/stripe), under the agreed names. They
// throw until that branch lands, so the UI shows its failure copy instead of pretending to bill.
// TODO(step14): swap these for the real imports when data-pipeline's branch is merged.
const pending = (name: string) => async (): Promise<never> => {
  throw new Error(`${name} is not wired yet (data-pipeline Step 14)`);
};

export const createCheckoutSession: (a: { workspaceId: string; quantity: number }) => Promise<{ url: string }> =
  pending("createCheckoutSession");
export const createPortalSession: (a: { workspaceId: string }) => Promise<{ url: string }> =
  pending("createPortalSession");
export const updateQuantity: (a: { workspaceId: string; quantity: number }) => Promise<void> =
  pending("updateQuantity");
export const scheduleRemoval: (a: { workspaceId: string; businessId: string }) => Promise<{ archiveAt: string }> =
  pending("scheduleRemoval");
