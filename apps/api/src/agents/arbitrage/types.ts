import { MarketSnapshot, OrderIntent, AgentState, OutcomeSide, OrderSide } from '@domain';

export interface OrderbookLevel {
  price: number;
  size: number; // in shares or USD? User said "depth ladders", usually shares or contracts. 
  // Requirement says "expectedFillPriceVWAP" needs depth ladder.
}

export interface Orderbook {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
}

export interface ArbMarketSnapshot extends MarketSnapshot {
  platform: string;
  eventId: string;
  yesBook: Orderbook;
  noBook: Orderbook;
  liquidityUsd?: number;
}

export interface FeeModel {
  makerFeePct: number;
  takerFeePct: number;
  settlementFeePct: number;
}

export interface ArbRiskPolicy {
  minEdgeDollars: number;
  minEdgePct: number;
  maxRiskPerTradePct: number;
  maxExposurePct: number;
  maxSlippagePct: number;
  minOrderbookDepth: number;
  minFillPct: number;
  moduleWeights: Record<string, number>;
  moduleRiskScores: Record<string, number>;
}

export interface ArbOrderIntent extends OrderIntent {
  platform: string;
  action: OrderSide;
  limitPrice: number;
  sizeUsd: number;
  tif: 'GTC' | 'IOC' | 'FOK';
}

export interface ArbLeg {
  platform: string;
  marketId: string;
  side: OutcomeSide;
  action: OrderSide;
  rawPrice: number;
  sizeUsd: number;
  shares: number;
}

export interface ArbOpportunity {
  id: string;
  module: string;
  legs: ArbLeg[];
  estimatedCosts: {
    feesUsd: number;
    slippagePct: number;
    totalCostUsd: number;
  };
  requiredCapitalUsd: number;
  edgePct: number;
  edgeDollars: number;
  liquidity: {
    depthUsed: number;
    expectedFillPct: number;
  };
  rejectReasons?: string[];
}

export interface DecisionTrace {
  agentId: string;
  timestamp: string;
  type: 'SKIP' | 'EXECUTE';
  evaluatedGroupsCount: number;
  evaluatedMarketsCount: number;
  opportunitiesFoundCount: number;
  opportunitiesExecutedCount: number;
  moduleStats: Record<string, {
    found: number;
    rejected: number;
    executed: number;
    rejectReasons: Record<string, number>;
  }>;
  executedOpportunities: ArbOpportunity[];
  rejectedOpportunities: ArbOpportunity[];
  tickSummary?: string;
}

export interface ArbAgentState extends AgentState {
  bankroll: number;
  exposureUsd: number;
  positions: any[]; // Position type from domain
}

