import { MarketSnapshot } from '@domain';

/**
 * Generic key-value pair for niche features
 */
export type FeatureVector = Record<string, string | number | boolean>;

/**
 * Model prediction result
 */
export interface ModelPrediction {
  p: number;
  confidence: number;
  modelVersion: string;
  featuresUsed?: string[];
}

/**
 * Detailed trace of a decision made by the agent
 */
export interface DecisionTrace {
  marketId: string;
  marketTitle: string;
  timestamp: string;
  
  // Input Probabilities
  modelProb: number;
  confidence: number;
  marketProb: number;
  edgePct: number;
  
  // Decision Result
  accepted: boolean;
  rejectReason?: string;
  
  // Sizing (if accepted)
  kellyF?: number;
  stakeUsd?: number;
  stakePct?: number;
  capsApplied?: string[];
  
  // Metadata
  modelVersion: string;
  featureKeys: string[];
}

/**
 * Configuration for NicheLLMModelAgent
 */
export interface NicheLLMModelAgentConfig {
  /** Niche keywords to filter markets (e.g., ["AI", "Crypto"]) */
  nicheKeywords: string[];
  
  /** Minimum liquidity (24h volume) required to trade */
  minLiquidityUsd: number;
  
  /** Maximum number of markets to evaluate per tick */
  maxMarketsPerTick: number;
  
  /** Minimum edge percentage required (0-100) */
  edgeThresholdPct: number;
  
  /** Fraction of Kelly criterion to use (0-1) */
  kellyFraction: number;
  
  /** Maximum risk per trade as percentage of bankroll (0-100) */
  maxRiskPerTradePct: number;
  
  /** Cooldown period in minutes per market to avoid overtrading */
  cooldownMinutes: number;
  
  /** Re-trade threshold: minimum change in model prediction to trade again within cooldown (optional) */
  retradeThresholdPct?: number;
}

/**
 * Calibration metrics
 */
export interface CalibrationSummary {
  periodDays: number;
  totalPredictions: number;
  brierScore: number;
  logLoss: number;
  reliabilityBuckets: {
    bucket: string;
    avgPredicted: number;
    actualFreq: number;
    count: number;
  }[];
}

