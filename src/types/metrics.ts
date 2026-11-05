// Every metric carries its sample size so the UI can say "named in 9 of 30 answers".
// value = numerator / denominator, or null when there are no successful answers.
export type Metric = { value: number | null; numerator: number; denominator: number };
