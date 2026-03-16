import type { SpacingToken } from '../types.js';

export function detectSpacingScale(tokens: SpacingToken[]): SpacingToken[] {
  if (tokens.length === 0) return [];

  // Sort by normalizedPx ascending
  const sorted = [...tokens].sort((a, b) => a.normalizedPx - b.normalizedPx);

  // Detect the base unit by finding the GCD of common values
  const baseUnit = detectBaseUnit(sorted.map((t) => t.normalizedPx));

  // Filter tokens to those that fit the base unit system (within a small tolerance)
  // and re-sort by occurrences
  const scaleTokens: SpacingToken[] = [];
  const seen = new Set<number>();

  for (const token of sorted) {
    const px = token.normalizedPx;
    if (px <= 0 || seen.has(px)) continue;
    seen.add(px);

    // Check if this value is a clean multiple of the base unit
    const multiplier = px / baseUnit;
    const isOnScale = Math.abs(multiplier - Math.round(multiplier)) < 0.1;

    scaleTokens.push({
      ...token,
      // Tag with the multiplier info via the value field for downstream use
      value: isOnScale
        ? `${px}px` // clean scale value
        : `${px}px`, // off-scale value still included
    });
  }

  // Sort by occurrences (most used first)
  scaleTokens.sort((a, b) => b.occurrences - a.occurrences);

  return scaleTokens;
}

/**
 * Detect the base unit from a list of spacing values.
 * Tries common bases (4, 8, 2, 6, 5, 10) and picks the one with the most multiples.
 * Falls back to computing the approximate GCD.
 */
function detectBaseUnit(values: number[]): number {
  const positiveValues = values.filter((v) => v > 0);
  if (positiveValues.length === 0) return 4;

  const candidates = [4, 8, 2, 6, 5, 10];
  let bestBase = 4;
  let bestScore = 0;

  for (const base of candidates) {
    let matchCount = 0;
    let totalWeight = 0;

    for (const v of positiveValues) {
      totalWeight++;
      const ratio = v / base;
      if (Math.abs(ratio - Math.round(ratio)) < 0.1) {
        matchCount++;
      }
    }

    const score = totalWeight > 0 ? matchCount / totalWeight : 0;
    if (score > bestScore) {
      bestScore = score;
      bestBase = base;
    }
  }

  return bestBase;
}
