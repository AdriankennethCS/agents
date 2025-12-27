import { Orderbook, OrderbookLevel, FeeModel } from '../agents/arbitrage/types';
import { OrderSide } from '@domain';

export interface ExecutionEstimate {
  expectedFillPriceVWAP: number;
  slippagePct: number;
  expectedFillPct: number;
  feesUsd: number;
  totalCostUsd: number;
}

export class ExecutionCostModel {
  /**
   * Estimates execution costs and fill quality for a given size and orderbook
   */
  static estimateExecution(
    side: OrderSide,
    sizeUsd: number,
    orderbook: Orderbook,
    feeModel: FeeModel,
    maxPriceImpactPct: number = 0.05
  ): ExecutionEstimate {
    // For simplicity in this v1, we assume we are TAKING liquidity
    const levels = side === 'BUY' ? orderbook.asks : orderbook.bids;
    
    let remainingUsd = sizeUsd;
    let filledShares = 0;
    let totalPaidUsd = 0;
    let depthUsed = 0;

    // Best price available
    const bestPrice = levels.length > 0 ? levels[0].price : (side === 'BUY' ? 1.0 : 0.0);

    for (const level of levels) {
      if (remainingUsd <= 0) break;

      const levelPrice = level.price;
      const levelShares = level.size;
      const levelUsd = levelShares * levelPrice;

      // Check price impact
      const priceImpact = Math.abs(levelPrice - bestPrice) / bestPrice;
      if (priceImpact > maxPriceImpactPct) break;

      const fillUsd = Math.min(remainingUsd, levelUsd);
      const fillShares = fillUsd / levelPrice;

      totalPaidUsd += fillUsd;
      filledShares += fillShares;
      remainingUsd -= fillUsd;
      depthUsed += fillUsd;
    }

    const expectedFillPct = (sizeUsd - remainingUsd) / sizeUsd;
    const vwap = filledShares > 0 ? totalPaidUsd / filledShares : bestPrice;
    
    const slippagePct = bestPrice > 0 ? (Math.abs(vwap - bestPrice) / bestPrice) * 100 : 0;
    
    // Fees calculation
    const takerFees = totalPaidUsd * (feeModel.takerFeePct / 100);
    
    return {
      expectedFillPriceVWAP: vwap,
      slippagePct,
      expectedFillPct: expectedFillPct * 100,
      feesUsd: takerFees,
      totalCostUsd: totalPaidUsd + takerFees
    };
  }
}

