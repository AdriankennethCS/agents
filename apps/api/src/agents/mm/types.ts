import { MarketSnapshot, OrderIntent, OutcomeSide } from '@domain';

export interface RewardsSnapshot {
  marketId: string;
  dailyRewardPool: number; // in USD
  minShares: number;
  maxSpread: number; // as a decimal (e.g., 0.05 for 5%)
  competitionProxy?: number; // estimated competition (e.g., total active shares in pool)
}

export interface QuotePlan {
  marketId: string;
  mid: number;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  rewardEligible: boolean;
  expectedRewardYield: number; // $/hour
}

export interface PortfolioExposure {
  totalYesInventory: number;
  totalNoInventory: number;
  categoryExposure: Record<string, { yes: number; no: number }>;
  marketExposure: Record<string, { yes: number; no: number }>;
}

export interface DecisionTrace {
  timestamp: string;
  agentId: string;
  tickSummary: {
    totalMarketsConsidered: number;
    marketsQuoted: number;
    rejectedMarkets: Array<{ marketId: string; reason: string }>;
  };
  marketDecisions: Record<string, MarketDecision>;
}

export interface MarketDecision {
  marketId: string;
  mid: number;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  spread: number;
  rewardConstraints: {
    minShares: number;
    maxSpread: number;
  };
  estimatedRewardYield: number;
  expectedSpreadPnlProxy: number;
  inventoryBefore: { yes: number; no: number };
  inventoryAfter: { yes: number; no: number };
  categoryExposureBefore: { yes: number; no: number };
  categoryExposureAfter: { yes: number; no: number };
  timeToResolve: number; // hours
  taperFactor: number;
  fairMidAdjustment?: number;
  rationale: string;
}

export interface FairMidProvider {
  getFairMid(marketId: string): number | null;
}

export interface MarketMakerConfig {
  rewardThreshold: number; // minimum $/hour to consider a market
  minLiquidity: number; // minimum volume or depth
  maxVolatility: number; // maximum mid move
  taperStartHours: number;
  taperEndHours: number;
  maxInventoryPerMarketPct: number;
  maxCategoryExposurePct: number;
  maxSideExposurePct: number; // total YES vs total NO
  inventoryRiskLimit: number; // for skew adjustment
}

/**
 * Extended OrderIntent that includes quoting specific fields
 */
export interface QuoteIntent extends OrderIntent {
  quotePlan?: QuotePlan;
}

