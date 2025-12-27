import { describe, it, expect } from 'vitest';
import { RewardYieldEstimator } from './RewardYieldEstimator';
import { InventoryManager } from './inventory';
import { MarketMakerRewardsAgent } from './MarketMakerRewardsAgent';
import { MarketSnapshot, AgentState } from '@domain';

describe('RewardYieldEstimator', () => {
  const estimator = new RewardYieldEstimator();
  
  it('should estimate yield correctly', () => {
    const snapshot = {
      marketId: 'm1',
      dailyRewardPool: 2400, // $100/hour
      minShares: 100,
      maxSpread: 0.02,
      competitionProxy: 900, // total 1000 with our 100
    };
    
    const yieldPerHour = estimator.estimateYield(100, snapshot);
    expect(yieldPerHour).toBe(10); // (100 / 1000) * 100 = 10
  });
});

describe('InventoryManager', () => {
  const manager = new InventoryManager();

  it('should calculate taper factor correctly', () => {
    const taperStart = 24;
    const taperEnd = 1;

    expect(manager.calculateTaperFactor(30, taperStart, taperEnd)).toBe(1.0);
    expect(manager.calculateTaperFactor(0.5, taperStart, taperEnd)).toBe(0.0);
    expect(manager.calculateTaperFactor(12.5, taperStart, taperEnd)).toBeCloseTo(0.5, 1);
  });

  it('should respect global caps', () => {
    const bankroll = 1000;
    const exposure = {
      totalYesInventory: 400, // 40% of bankroll
      totalNoInventory: 0,
      categoryExposure: { 'Crypto': { yes: 150, no: 0 } },
      marketExposure: { 'm1': { yes: 50, no: 0 } },
    };

    const config = {
      maxInventoryPerMarketPct: 10, // $100 max
      maxCategoryExposurePct: 20, // $200 max
      maxSideExposurePct: 50, // $500 max
      taperFactor: 1.0,
    };

    const market: MarketSnapshot = {
      id: 'm1',
      externalId: 'ext-m1',
      title: 'm1',
      category: 'Crypto',
      status: 'open',
      yesTokenId: 't1',
      noTokenId: 't2',
      yes: { side: 'YES', price: 0.5, impliedProb: 50 },
      no: { side: 'NO', price: 0.5, impliedProb: 50 },
      lastUpdated: new Date().toISOString(),
    };

    const maxShares = manager.calculateMaxShares(market, 'YES', 0.5, bankroll, exposure, config);
    expect(maxShares).toBe(100);
  });
});

describe('MarketMakerRewardsAgent', () => {
  const config = {
    rewardThreshold: 0.01,
    minLiquidity: 100,
    maxVolatility: 0.1,
    taperStartHours: 24,
    taperEndHours: 1,
    maxInventoryPerMarketPct: 10,
    maxCategoryExposurePct: 30,
    maxSideExposurePct: 50,
    inventoryRiskLimit: 100,
  };

  const agent = new MarketMakerRewardsAgent(config);

  it('should produce quotes for reward markets', () => {
    const market: MarketSnapshot = {
      id: 'm1',
      externalId: 'ext-m1',
      title: 'Test Crypto Market',
      category: 'Crypto',
      status: 'open',
      yesTokenId: 't1',
      noTokenId: 't2',
      yes: { side: 'YES', price: 0.5, impliedProb: 50, bestBid: 0.49, bestAsk: 0.51 },
      no: { side: 'NO', price: 0.5, impliedProb: 50 },
      lastUpdated: new Date().toISOString(),
      resolvesAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    };

    const state: AgentState = {
      agentId: 'a1',
      name: 'mm',
      strategyType: 'marketMakerRewards',
      bankroll: 10000,
      startBankroll: 10000,
      pnlTotal: 0,
      openPositions: [],
      maxRiskPerTradePct: 10,
      maxExposurePct: 50,
      status: 'running',
      isPaperMode: true,
      timestamp: new Date().toISOString(),
    };

    const trace = agent.decide({ state, markets: [market] });
    expect(trace).toBeDefined();
    expect(trace.intents.length).toBeGreaterThan(0);
    expect(trace.decision.metadata?.tickSummary.marketsQuoted).toBe(1);
    expect(trace.decision.metadata?.marketDecisions['m1']).toBeDefined();
    expect(trace.decision.metadata?.marketDecisions['m1'].bidSize).toBeGreaterThan(0);
  });
});
