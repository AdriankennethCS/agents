import { MarketSnapshot } from '@domain';
import { FeatureVector } from '../types';

/**
 * Interface for feature providers that extract/fetch features for a market
 */
export interface IFeatureProvider {
  /**
   * Get features for a specific market
   * @param market The market snapshot
   * @returns A feature vector containing relevant niche features
   */
  getFeatures(market: MarketSnapshot): Promise<FeatureVector>;
}

/**
 * Default implementation of a feature provider (can be extended)
 */
export class DefaultFeatureProvider implements IFeatureProvider {
  async getFeatures(market: MarketSnapshot): Promise<FeatureVector> {
    // Basic features extracted from market snapshot
    return {
      titleLength: market.title.length,
      category: market.category || 'none',
      volume24h: market.yes.volume24h || 0,
      timeToResolutionHours: market.resolvesAt 
        ? (new Date(market.resolvesAt).getTime() - Date.now()) / (1000 * 60 * 60)
        : -1,
      impliedProb: market.yes.impliedProb,
      spread: (market.yes.bestAsk || 1) - (market.yes.bestBid || 0),
    };
  }
}

