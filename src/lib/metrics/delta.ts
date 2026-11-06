// Signed floored points with a real minus sign; never a %.
export const signedPts = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)} pts`;

// A delta's badge tone. The sign carries the meaning, the colour repeats it (R1). Never info blue (R2).
export const deltaTone = (n: number) => (n > 0 ? "success" : n < 0 ? "error" : "neutral");
