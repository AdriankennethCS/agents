import { AgentState, MarketSnapshot, Position } from '@domain';
import { PortfolioExposure } from './types';

export class InventoryManager {
  /**
   * Calculates the inventory taper factor based on time to resolution.
   * 
   * @param hoursToResolve Time remaining until market resolution in hours
   * @param taperStartHours When to start tapering (e.g., 24 hours before resolution)
   * @param taperEndHours When to reach zero exposure (e.g., 1 hour before resolution)
   * @returns Factor between 0 and 1
   */
  calculateTaperFactor(
    hoursToResolve: number,
    taperStartHours: number,
    taperEndHours: number
  ): number {
    if (hoursToResolve > taperStartHours) {
      return 1.0;
    }
    if (hoursToResolve < taperEndHours) {
      return 0.0;
    }

    // Linear decay
    return (hoursToResolve - taperEndHours) / (taperStartHours - taperEndHours);
  }

  /**
   * Gets current portfolio exposure from agent state
   */
  getPortfolioExposure(state: AgentState, markets: MarketSnapshot[]): PortfolioExposure {
    const exposure: PortfolioExposure = {
      totalYesInventory: 0,
      totalNoInventory: 0,
      categoryExposure: {},
      marketExposure: {},
    };

    const marketMap = new Map(markets.map(m => [m.id, m]));

    for (const pos of state.openPositions) {
      const market = marketMap.get(pos.marketId);
      const category = market?.category || 'Unknown';
      
      const value = pos.shares * pos.avgEntryPrice;

      if (pos.outcome === 'YES') {
        exposure.totalYesInventory += value;
      } else {
        exposure.totalNoInventory += value;
      }

      // Track by market
      if (!exposure.marketExposure[pos.marketId]) {
        exposure.marketExposure[pos.marketId] = { yes: 0, no: 0 };
      }
      if (pos.outcome === 'YES') {
        exposure.marketExposure[pos.marketId].yes += value;
      } else {
        exposure.marketExposure[pos.marketId].no += value;
      }

      // Track by category
      if (!exposure.categoryExposure[category]) {
        exposure.categoryExposure[category] = { yes: 0, no: 0 };
      }
      if (pos.outcome === 'YES') {
        exposure.categoryExposure[category].yes += value;
      } else {
        exposure.categoryExposure[category].no += value;
      }
    }

    return exposure;
  }

  /**
   * Calculates the maximum shares we can buy for a specific market outcome
   * given current inventory and global caps.
   */
  calculateMaxShares(
    market: MarketSnapshot,
    outcome: 'YES' | 'NO',
    price: number,
    bankroll: number,
    exposure: PortfolioExposure,
    config: {
      maxInventoryPerMarketPct: number;
      maxCategoryExposurePct: number;
      maxSideExposurePct: number;
      taperFactor: number;
    }
  ): number {
    const marketCap = bankroll * (config.maxInventoryPerMarketPct / 100) * config.taperFactor;
    const categoryCap = bankroll * (config.maxCategoryExposurePct / 100) * config.taperFactor;
    const sideCap = bankroll * (config.maxSideExposurePct / 100) * config.taperFactor;

    const currentMarketExposure = (exposure.marketExposure[market.id]?.[outcome.toLowerCase() as 'yes' | 'no'] || 0);
    const currentCategoryExposure = (exposure.categoryExposure[market.category || 'Unknown']?.[outcome.toLowerCase() as 'yes' | 'no'] || 0);
    const currentSideExposure = outcome === 'YES' ? exposure.totalYesInventory : exposure.totalNoInventory;

    const remainingMarket = Math.max(0, marketCap - currentMarketExposure);
    const remainingCategory = Math.max(0, categoryCap - currentCategoryExposure);
    const remainingSide = Math.max(0, sideCap - currentSideExposure);

    const minRemaining = Math.min(remainingMarket, remainingCategory, remainingSide);
    
    if (price <= 0) return 0;
    return Math.floor(minRemaining / price);
  }
}

