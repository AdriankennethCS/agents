import { MarketSnapshot } from '@domain';
import { RiskPolicy, MarketFilterResult } from './types';

/**
 * Filter markets based on risk policy criteria
 */
export function filterMarkets(
  markets: MarketSnapshot[],
  riskPolicy: RiskPolicy
): MarketFilterResult {
  const eligible: MarketSnapshot[] = [];
  const filtered: Array<{ market: MarketSnapshot; reason: string }> = [];

  for (const market of markets) {
    // Only consider open markets
    if (market.status !== 'open') {
      filtered.push({ market, reason: `Market status: ${market.status}` });
      continue;
    }

    // Check spread if required
    if (riskPolicy.minSpread !== undefined) {
      const yesAsk = market.yes.bestAsk ?? market.yes.price;
      const yesBid = market.yes.bestBid ?? market.yes.price;
      const spread = yesAsk - yesBid;
      
      if (spread > riskPolicy.minSpread) {
        filtered.push({
          market,
          reason: `Spread too wide: ${(spread * 100).toFixed(2)}% > ${(riskPolicy.minSpread * 100).toFixed(2)}%`,
        });
        continue;
      }
    }

    // Check liquidity if required and available
    if (riskPolicy.minLiquidity !== undefined) {
      const volume = market.yes.volume24h ?? 0;
      if (volume < riskPolicy.minLiquidity) {
        filtered.push({
          market,
          reason: `Insufficient liquidity: ${volume} < ${riskPolicy.minLiquidity}`,
        });
        continue;
      }
    }

    // Check if price is valid (not 0 or 1)
    const yesPrice = market.yes.bestAsk ?? market.yes.lastTradedPrice ?? market.yes.price;
    if (yesPrice === undefined || yesPrice <= 0 || yesPrice >= 1) {
      filtered.push({ market, reason: 'Invalid price' });
      continue;
    }

    eligible.push(market);
  }

  return { eligible, filtered };
}

