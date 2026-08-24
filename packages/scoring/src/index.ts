/**
 * CODE × CAP scoring — transparent weights live HERE only.
 * Experimental. Not scientifically precise. Do not hide weights in UI.
 *
 * Phase 6 will compute composites. Phase 1 only stores component scores manually.
 */

export const SCORE_WEIGHTS = {
  buildSubstance: 0.2,
  developmentMomentum: 0.2,
  productReality: 0.15,
  externalAdoption: 0.1,
  identityConfidence: 0.15,
  marketQuality: 0.1,
  trustSecurity: 0.05,
  asymmetry: 0.05,
} as const;

/** Liquidity below this USD is treated as effectively nonexistent for ranking. */
export const MIN_MEANINGFUL_LIQUIDITY_USD = 5_000;

/**
 * Penalty multiplier for thin liquidity.
 * Example: $10K mcap with $150 liq should not outrank healthier microcaps.
 */
export function liquidityQualityMultiplier(liquidityUsd: number | null | undefined): number {
  if (liquidityUsd == null || liquidityUsd <= 0) return 0.15;
  if (liquidityUsd < 1_000) return 0.25;
  if (liquidityUsd < MIN_MEANINGFUL_LIQUIDITY_USD) return 0.5;
  if (liquidityUsd < 25_000) return 0.85;
  return 1;
}

export interface ComponentScores {
  identityConfidence: number;
  buildSubstance: number;
  developmentMomentum: number;
  productReality: number;
  marketQuality: number;
  externalAdoption: number;
  trustSecurity: number;
  asymmetry: number;
}

export function builderStrength(scores: ComponentScores): number {
  const w = SCORE_WEIGHTS;
  const raw =
    scores.buildSubstance * w.buildSubstance +
    scores.developmentMomentum * w.developmentMomentum +
    scores.productReality * w.productReality +
    scores.externalAdoption * w.externalAdoption +
    scores.identityConfidence * w.identityConfidence +
    scores.trustSecurity * w.trustSecurity +
    scores.asymmetry * w.asymmetry;
  // Normalize excluding marketQuality so builder strength stays separate
  const denom =
    w.buildSubstance +
    w.developmentMomentum +
    w.productReality +
    w.externalAdoption +
    w.identityConfidence +
    w.trustSecurity +
    w.asymmetry;
  return Math.round((raw / denom) * 100) / 10; // 0–10 scale
}

export function codeXCapScore(
  scores: ComponentScores,
  opts: { marketCapUsd?: number | null; liquidityUsd?: number | null } = {},
): number {
  const builder = builderStrength(scores);
  const market = scores.marketQuality;
  const liqMult = liquidityQualityMultiplier(opts.liquidityUsd);
  // Higher builder relative to market attention → higher experimental score
  const attention = Math.max(1, Math.log10((opts.marketCapUsd ?? 0) + 10));
  const raw = ((builder * 0.7 + market * 0.3) / attention) * 10 * liqMult;
  return Math.round(Math.min(10, Math.max(0, raw)) * 10) / 10;
}
