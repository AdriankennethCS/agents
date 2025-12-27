import { describe, it, expect } from 'vitest';
import { SingleOutcomeArbModule } from './single';
import { ArbMarketSnapshot, ArbRiskPolicy, FeeModel } from '../types';

describe('SingleOutcomeArbModule', () => {
  const policy: ArbRiskPolicy = {
    minEdgePct: 2,
    minEdgeDollars: 1,
    maxRiskPerTradePct: 5,
    maxExposurePct: 20,
    maxSlippagePct: 1,
    minOrderbookDepth: 100,
    minFillPct: 90,
    moduleWeights: { 'single-outcome': 1 },
    moduleRiskScores: { 'single-outcome': 1 }
  };

  const feeModel: FeeModel = {
    makerFeePct: 0,
    takerFeePct: 0,
    settlementFeePct: 0
  };

  it('detects a simple YES+NO < 1 arb', () => {
    const market: ArbMarketSnapshot = {
      id: 'm1',
      externalId: 'ext1',
      title: 'Test Market',
      status: 'open',
      yesTokenId: 't1',
      noTokenId: 't2',
      yes: { side: 'YES', price: 0.45, impliedProb: 45, bestAsk: 0.45, bestBid: 0.44 },
      no: { side: 'NO', price: 0.45, impliedProb: 45, bestAsk: 0.45, bestBid: 0.44 },
      yesBook: { bids: [], asks: [{ price: 0.45, size: 1000 }] },
      noBook: { bids: [], asks: [{ price: 0.45, size: 1000 }] },
      lastUpdated: new Date().toISOString(),
      platform: 'polymarket',
      eventId: 'e1'
    };

    const module = new SingleOutcomeArbModule();
    const opportunities = module.detect([[market]], policy, feeModel);

    expect(opportunities.length).toBe(1);
    expect(opportunities[0].edgePct).toBeCloseTo(10, 1); // 1 - (0.45+0.45) = 0.1 = 10%
  });

  it('filters out opportunities with low edge', () => {
    const market: ArbMarketSnapshot = {
        id: 'm1',
        externalId: 'ext1',
        title: 'Test Market',
        status: 'open',
        yesTokenId: 't1',
        noTokenId: 't2',
        yes: { side: 'YES', price: 0.495, impliedProb: 49.5, bestAsk: 0.495, bestBid: 0.49 },
        no: { side: 'NO', price: 0.495, impliedProb: 49.5, bestAsk: 0.495, bestBid: 0.49 },
        yesBook: { bids: [], asks: [{ price: 0.495, size: 1000 }] },
        noBook: { bids: [], asks: [{ price: 0.495, size: 1000 }] },
        lastUpdated: new Date().toISOString(),
        platform: 'polymarket',
        eventId: 'e1'
      };
  
      const module = new SingleOutcomeArbModule();
      const opportunities = module.detect([[market]], policy, feeModel);
  
      expect(opportunities.length).toBe(1);
      expect(opportunities[0].rejectReasons).toContain('low_edge');
  });
});

