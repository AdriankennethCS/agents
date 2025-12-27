import { ArbMarketSnapshot, ArbOpportunity, ArbRiskPolicy, FeeModel, ArbLeg } from '../types';
import { ExecutionCostModel } from '../../../execution/ExecutionCostModel';
import { ArbModule } from './types';

export class SingleOutcomeArbModule implements ArbModule {
  name = 'single-outcome';

  detect(marketGroups: ArbMarketSnapshot[][], policy: ArbRiskPolicy, feeModel: FeeModel): ArbOpportunity[] {
    const opportunities: ArbOpportunity[] = [];

    for (const group of marketGroups) {
      for (const market of group) {
        // Simple YES + NO < 1.0 arb on the same market
        const yesPrice = market.yes.bestAsk || 1.0;
        const noPrice = market.no.bestAsk || 1.0;
        
        const combinedPrice = yesPrice + noPrice;
        
        // Check for potential arb
        const sizeUsd = 100; // Default test size, should be optimized later
        
        const yesEstimate = ExecutionCostModel.estimateExecution('BUY', sizeUsd / 2, market.yesBook, feeModel);
        const noEstimate = ExecutionCostModel.estimateExecution('BUY', sizeUsd / 2, market.noBook, feeModel);
        
        const totalCost = yesEstimate.totalCostUsd + noEstimate.totalCostUsd;
        const totalFees = yesEstimate.feesUsd + noEstimate.feesUsd;
        const avgFillPct = (yesEstimate.expectedFillPct + noEstimate.expectedFillPct) / 2;
        const maxSlippage = Math.max(yesEstimate.slippagePct, noEstimate.slippagePct);

        const edgePct = (1.0 - (yesEstimate.expectedFillPriceVWAP + noEstimate.expectedFillPriceVWAP)) * 100;

        // Even if edge is negative, we might want to track it for metrics if it's close?
        // But for v1, let's say we only track if combined price is < 1.001 (small buffer)
        if (combinedPrice < 1.001) {
          const opportunity: ArbOpportunity = {
            id: `single-${market.id}-${Date.now()}`,
            module: this.name,
            legs: [
              {
                platform: market.platform,
                marketId: market.id,
                side: 'YES',
                action: 'BUY',
                rawPrice: yesPrice,
                sizeUsd: sizeUsd / 2,
                shares: (sizeUsd / 2) / yesEstimate.expectedFillPriceVWAP
              },
              {
                platform: market.platform,
                marketId: market.id,
                side: 'NO',
                action: 'BUY',
                rawPrice: noPrice,
                sizeUsd: sizeUsd / 2,
                shares: (sizeUsd / 2) / noEstimate.expectedFillPriceVWAP
              }
            ],
            estimatedCosts: {
              feesUsd: totalFees,
              slippagePct: maxSlippage,
              totalCostUsd: totalCost
            },
            requiredCapitalUsd: sizeUsd,
            edgePct: edgePct,
            edgeDollars: sizeUsd * (1.0 - (yesEstimate.expectedFillPriceVWAP + noEstimate.expectedFillPriceVWAP)) - totalFees,
            liquidity: {
              depthUsed: sizeUsd,
              expectedFillPct: avgFillPct
            },
            rejectReasons: []
          };

          // Apply filters
          if (opportunity.liquidity.expectedFillPct < policy.minFillPct) opportunity.rejectReasons?.push('low_fill');
          if (opportunity.estimatedCosts.slippagePct > policy.maxSlippagePct) opportunity.rejectReasons?.push('high_slippage');
          if (opportunity.edgePct < policy.minEdgePct) opportunity.rejectReasons?.push('low_edge');

          opportunities.push(opportunity);
        }
      }
    }

    return opportunities;
  }
}

