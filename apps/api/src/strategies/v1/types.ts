import { MarketSnapshot, AgentState, OrderIntent } from '@domain';

/**
 * Risk policy configuration
 */
export interface RiskPolicy {
  /** Maximum risk per trade as percentage of bankroll (0-100) */
  maxRiskPerTradePct: number;
  /** Maximum total exposure as percentage of bankroll (0-100) */
  maxExposurePct: number;
  /** Minimum spread required (0-1), e.g., 0.01 = 1% */
  minSpread?: number;
  /** Minimum liquidity (volume24h), if available */
  minLiquidity?: number;
}

/**
 * Strategy specification for v1 deterministic strategy
 */
export interface StrategySpec {
  /** Risk policy */
  riskPolicy: RiskPolicy;
  /** Minimum edge percentage required to enter (0-100) */
  minEdgePct: number;
  /** Stake as percentage of bankroll per trade (0-100) */
  stakePct: number;
  /** Bias to add to market probability (can be negative) */
  biasPct: number;
}

/**
 * Risk check result
 */
export interface RiskCheckResult {
  /** Name/identifier of the check */
  check: string;
  /** Whether the check passed */
  passed: boolean;
  /** Reason for pass/fail */
  reason: string;
}

/**
 * Risk assessment result
 */
export interface RiskAssessment {
  /** Checks that passed */
  checksPassed: RiskCheckResult[];
  /** Checks that failed */
  checksFailed: RiskCheckResult[];
  /** Whether execution should be blocked */
  blocked: boolean;
}

/**
 * Enhanced decision log with risk checks and reasoning
 */
export interface DecisionLog {
  /** Agent identifier */
  agentId: string;
  /** ISO timestamp of decision */
  timestamp: string;
  /** Summary of the decision */
  summary: string;
  /** Bullet points explaining the reasoning */
  reasoningBullets: string[];
  /** Risk assessment */
  risk: RiskAssessment;
  /** Order intents generated (if any) */
  intents: OrderIntent[];
  /** Number of intents that would be filled (paper mode: 0) */
  filledCount: number;
  /** Number of intents that would be rejected (paper mode: 0) */
  rejectedCount: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Market filter result
 */
export interface MarketFilterResult {
  /** Markets that passed the filter */
  eligible: MarketSnapshot[];
  /** Markets that were filtered out */
  filtered: Array<{ market: MarketSnapshot; reason: string }>;
}

/**
 * Strategy decision result
 */
export interface StrategyDecision {
  /** Whether to skip this tick */
  skip: boolean;
  /** Skip reason if skipping */
  skipReason?: string;
  /** Order intents if not skipping */
  intents: OrderIntent[];
  /** Reasoning bullets */
  reasoningBullets: string[];
}

