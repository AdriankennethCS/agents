import { describe, it, expect } from 'vitest';
import { ExecutionCostModel } from '../../execution/ExecutionCostModel';
import { Orderbook, FeeModel } from './types';

describe('ExecutionCostModel', () => {
  const mockOrderbook: Orderbook = {
    bids: [
      { price: 0.50, size: 100 },
      { price: 0.49, size: 200 },
    ],
    asks: [
      { price: 0.51, size: 100 },
      { price: 0.52, size: 200 },
    ]
  };

  const mockFeeModel: FeeModel = {
    makerFeePct: 0.1,
    takerFeePct: 0.2,
    settlementFeePct: 0
  };

  it('calculates VWAP and slippage for a small BUY order', () => {
    const result = ExecutionCostModel.estimateExecution('BUY', 51, mockOrderbook, mockFeeModel);
    
    expect(result.expectedFillPriceVWAP).toBe(0.51);
    expect(result.expectedFillPct).toBe(100);
    expect(result.slippagePct).toBe(0);
    expect(result.feesUsd).toBe(51 * 0.002);
  });

  it('calculates VWAP and slippage for a larger BUY order that hits multiple levels', () => {
    const result = ExecutionCostModel.estimateExecution('BUY', 102, mockOrderbook, mockFeeModel);
    
    // Level 1: 100 shares at 0.51 = 51 USD
    // Level 2: 51 USD left / 0.52 = 98.07 shares
    // Total USD = 102
    // Total Shares = 100 + 98.07 = 198.07
    // VWAP = 102 / 198.07 = 0.5149
    expect(result.expectedFillPriceVWAP).toBeGreaterThan(0.51);
    expect(result.expectedFillPriceVWAP).toBeLessThan(0.52);
    expect(result.slippagePct).toBeGreaterThan(0);
  });

  it('handles partial fills when orderbook depth is insufficient', () => {
    const result = ExecutionCostModel.estimateExecution('BUY', 1000, mockOrderbook, mockFeeModel);
    
    expect(result.expectedFillPct).toBeLessThan(100);
  });
});

