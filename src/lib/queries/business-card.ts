import { buildQuestions, type KeyedQuestion, type Picks } from "@/lib/questions/templates";
import type { DbClient } from "./client";
import type { OnboardingInput, Vertical } from "./onboarding";

// The business card as Settings (UI5) saves it: the business fields plus the question picks.
export type BusinessCard = Pick<OnboardingInput["business"], "name" | "cuisine" | "city" | "state"> &
  Partial<
    Pick<
      OnboardingInput["business"],
      "address" | "phone" | "category" | "services" | "service_area" | "profile_sources" | "profile_links"
    >
  > & { vertical: Vertical; question_picks: Picks };

// The template questions for a card: the restaurant templates need a cuisine; other types get theirs
// with DP3 (until then none, so a save leaves their template rows off and owner rows as they are).
export const cardQuestions = (card: BusinessCard) =>
  card.vertical === "restaurant" && card.cuisine
    ? buildQuestions({ cuisine: card.cuisine, city: card.city, state: card.state }, card.question_picks)
    : [];

// Saves the card and reconciles its questions in one transaction (save_business_card): edited and
// hand-added rows are untouched; a row's text never changes, so an unedited row whose text is no longer
// produced is switched off and the new text reuses or adds a row; owner-off rows stay off; the rest
// fill the free slots of the 25 cap. Errors: 42501 not allowed, 22023 bad input, 23514 a CHECK.
// `build` is the template builder (tests inject a fixture set; DP3 extends cardQuestions).
export async function saveBusinessCard(
  db: DbClient,
  businessId: string,
  card: BusinessCard,
  build: (card: BusinessCard) => KeyedQuestion[] = cardQuestions,
): Promise<void> {
  const questions = build(card).map((q) => ({ key: q.key, short: q.short_text, long: q.long_text }));
  const { error } = await db.rpc("save_business_card", {
    p_business_id: businessId,
    p_card: card,
    p_questions: questions,
  });
  if (error) throw error;
}
