/**
 * Calculate the Kelly criterion fraction for a binary outcome (YES buy).
 * f* = (p - price) / (1 - price)
 * @param p Model probability (0.0 to 1.0)
 * @param price Market price (0.0 to 1.0)
 * @returns Kelly fraction (can be negative if no edge)
 */
export function calculateKellyFraction(p: number, price: number): number {
  if (price >= 1 || price <= 0) return 0;
  return (p - price) / (1 - price);
}

/**
 * Calculate the stake amount based on fractional Kelly and confidence scaling.
 * @param bankroll Current bankroll in USD
 * @param kellyFraction User-defined fractional Kelly multiplier (e.g., 0.25)
 * @param fStar Calculated Kelly fraction (f*)
 * @param confidence Model confidence (0.0 to 1.0)
 * @param maxRiskPerTradePct Maximum risk as % of bankroll (0-100)
 * @returns Stake amount in USD
 */
export function calculateStakeUsd(
  bankroll: number,
  kellyFraction: number,
  fStar: number,
  confidence: number,
  maxRiskPerTradePct: number
): { stakeUsd: number; capsApplied: string[] } {
  const capsApplied: string[] = [];
  
  // Basic fractional Kelly: bankroll * kellyFraction * f*
  // Scaled by confidence: * confidence
  let stakeUsd = bankroll * kellyFraction * Math.max(0, fStar) * confidence;
  
  // Cap by max risk per trade
  const maxRiskUsd = bankroll * (maxRiskPerTradePct / 100);
  if (stakeUsd > maxRiskUsd) {
    stakeUsd = maxRiskUsd;
    capsApplied.push(`maxRiskPerTradePct (${maxRiskPerTradePct}%)`);
  }
  
  return {
    stakeUsd: Math.max(0, stakeUsd),
    capsApplied
  };
}

