// Example data: invented fixes for the /dev/app gallery and unit tests. Not real results.
import type { FixView } from "./FixList";

export const exampleFixes: FixView[] = [
  {
    id: "f1",
    rule_key: "R10",
    title: "Example data: put your menu on your site as text",
    detail: "Example data: your menu is a PDF at exampleramen.test/menu.pdf. AI reads text pages more easily.",
    affected_answers: null,
    status: "todo",
  },
  {
    id: "f2",
    rule_key: "R11",
    title: "Example data: name your signature dishes",
    detail: "Example data: 3 of your dishes aren't on any page we could read.",
    affected_answers: 12,
    status: "doing",
  },
  {
    id: "f3",
    rule_key: "R14",
    title: "Example data: let AI search bots read your site",
    detail: "Your robots.txt blocks OAI-SearchBot from /menu. Check if you meant to.",
    affected_answers: null,
    status: "todo",
  },
];
export const exampleTidyUps: FixView[] = [
  {
    id: "h1",
    rule_key: "H1",
    title: "Example data: add restaurant schema",
    detail: "Example data: your home page has no Restaurant schema.",
    affected_answers: null,
    status: "todo",
  },
];
export const exampleUnchecked = [
  { rule_key: "R10", title: "Example data: put your menu on your site as text" },
  { rule_key: "R14", title: "Example data: let AI search bots read your site" },
];
