import { buildQuestions } from "@/lib/questions/templates";
import type { BuiltQuestion, SuggestQuestionsInput } from "./types";

// Up to 25 questions from the restaurant templates for this business and its picks.
export const suggestQuestions = ({ business, picks }: SuggestQuestionsInput): BuiltQuestion[] =>
  buildQuestions(business, picks);
