import { describe, it, expect } from 'vitest';
import { MarketSnapshot, AgentState } from '@domain';
import { NicheLLMModelAgent } from './NicheLLMModelAgent';
import { StubProbabilityModel } from './models/StubProbabilityModel';
import { DefaultFeatureProvider } from './features/FeatureProvider';
import { NicheLLMModelAgentConfig } from './types';
import { AgentInput } from '../contracts';

/**
 * Helper to create a test market snapshot
 */
function createTestMarket(overrides?: Partial<MarketSnapshot>): MarketSnapshot {
  return {
    id: 'market-1',
    externalId: 'ext-1',
    title: 'AI Market Test',
    category: 'Technology',
    status: 'open',
    yesTokenId: 'token-yes',
    noTokenId: 'token-no',
    yes: {
      side: 'YES',
      price: 0.5,
      impliedProb: 50,
      bestBid: 0.49,
      bestAsk: 0.51,
      lastTradedPrice: 0.5,
      volume24h: 1000,
    },
    no: {
      side: 'NO',
      price: 0.5,
      impliedProb: 50,
    },
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Helper to create a test agent state
 */
function createTestAgentState(overrides?: Partial<AgentState>): AgentState {
  return {
    agentId: 'agent-1',
    name: 'Niche Model Agent',
    strategyType: 'nicheLLMModel',
    bankroll: 10000,
    startBankroll: 10000,
    pnlTotal: 0,
    openPositions: [],
    maxRiskPerTradePct: 2,
    maxExposurePct: 10,
    status: 'running',
    isPaperMode: true,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

const defaultConfig: NicheLLMModelAgentConfig = {
  nicheKeywords: ['AI', 'NVIDIA'],
  minLiquidityUsd: 500,
  maxMarketsPerTick: 5,
  edgeThresholdPct: 5,
  kellyFraction: 0.5,
  maxRiskPerTradePct: 2,
  cooldownMinutes: 10,
};

describe('NicheLLMModelAgent', () => {
  it('should identify and trade on a niche market with edge', async () => {
    // Model predicts 60%, market is at 50% -> 10% edge
    const model = new StubProbabilityModel(60, 1.0);
    const agent = new NicheLLMModelAgent(defaultConfig, model);

    const state = createTestAgentState();
    const market = createTestMarket({ title: 'Will NVIDIA release a new AI chip?' });
    
    const input: AgentInput = {
      state,
      markets: [market],
    };

    const trace = await agent.decide(input);
    
    expect(trace.decision.action).toBe('ORDER');
    expect(trace.intents).toHaveLength(1);
    const intent = trace.intents[0];
    
    expect(intent.marketId).toBe(market.id);
    expect(intent.edgePct).toBeCloseTo(10, 5);
    expect(intent.modelProb).toBe(60);
    
    // Sizing check:
    // f* = (0.6 - 0.51) / (1 - 0.51) = 0.09 / 0.49 ≈ 0.1836
    // stakeUsd = 10000 * 0.5 (kellyFraction) * 0.1836 * 1.0 (confidence) = 918
    // maxRisk = 10000 * 0.02 = 200
    // So stake should be capped at 200
    expect(intent.shares).toBe(Math.floor(200 / 0.51));
  });

  it('should skip markets that are not in the niche', async () => {
    const model = new StubProbabilityModel(60, 1.0);
    const agent = new NicheLLMModelAgent(defaultConfig, model);

    const state = createTestAgentState();
    const market = createTestMarket({ title: 'Will it rain in London?' });
    
    const input: AgentInput = {
      state,
      markets: [market],
    };

    const trace = await agent.decide(input);
    
    expect(trace.decision.action).toBe('SKIP');
    expect(trace.intents).toHaveLength(0);
  });

  it('should enforce cooldown', async () => {
    const model = new StubProbabilityModel(60, 1.0);
    const agent = new NicheLLMModelAgent(defaultConfig, model);

    const state = createTestAgentState();
    const market = createTestMarket({ title: 'AI progress' });
    
    const input: AgentInput = {
      state,
      markets: [market],
    };

    // First decision: ORDER
    const trace1 = await agent.decide(input);
    expect(trace1.decision.action).toBe('ORDER');

    // Second decision immediately: SKIP (cooldown)
    const trace2 = await agent.decide(input);
    expect(trace2.decision.action).toBe('SKIP');
    expect(trace2.decision.reasoningBullets).toContain(`Market ${market.id}: Skipping due to cooldown.`);
  });

  it('should skip markets with low liquidity', async () => {
    const model = new StubProbabilityModel(60, 1.0);
    const agent = new NicheLLMModelAgent(defaultConfig, model);

    const state = createTestAgentState();
    const market = createTestMarket({ 
      title: 'AI progress',
      yes: { ...createTestMarket().yes, volume24h: 100 } // Low liquidity
    });
    
    const input: AgentInput = {
      state,
      markets: [market],
    };

    const trace = await agent.decide(input);
    expect(trace.decision.action).toBe('SKIP');
  });
});

