import { AgentState, MarketSnapshot, OrderIntent } from '@domain';
import { DecisionTrace, AgentInput, IAgentStrategy } from './contracts';

export type { DecisionTrace, AgentInput, IAgentStrategy };

/**
 * Configuration for FlatValueAgent
 */
export interface FlatValueAgentConfig {
  /** Minimum edge percentage required to place an order (0-100) */
  edgeThresholdPct: number;
  /** Stake as percentage of bankroll (0-100) */
  stakePct: number;
  /** Bias to add to market probability (can be negative) */
  biasPct: number;
}

/**
 * Configuration for FractionalKellyAgent
 */
export interface FractionalKellyAgentConfig {
  /** Fraction of Kelly criterion to use (0-1, typically 0.25-0.5) */
  kellyFraction: number;
  /** Minimum edge percentage required (0-100) */
  edgeFloorPct: number;
  /** Bias to add to market probability (can be negative) */
  biasPct: number;
}

/**
 * Configuration for RandomBaselineAgent
 */
export interface RandomBaselineAgentConfig {
  /** Probability of placing an order per market tick (0-1) */
  chancePerTick: number;
  /** Stake as percentage of bankroll (0-100) */
  stakePct: number;
}

/**
 * Configuration for MarketMakerRewardsAgent
 */
export interface MarketMakerAgentConfig {
  rewardThreshold: number;
  minLiquidity: number;
  maxVolatility: number;
  taperStartHours: number;
  taperEndHours: number;
  maxInventoryPerMarketPct: number;
  maxCategoryExposurePct: number;
  maxSideExposurePct: number;
  inventoryRiskLimit: number;
}

export type { NicheLLMModelAgentConfig } from './model/types';

