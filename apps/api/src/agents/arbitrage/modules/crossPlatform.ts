import { ArbMarketSnapshot, ArbOpportunity, ArbRiskPolicy, FeeModel, ArbLeg } from '../types';
import { ExecutionCostModel } from '../../../execution/ExecutionCostModel';
import { ArbModule } from './types';

export class CrossPlatformArbModule implements ArbModule {
  name = 'cross-platform';

  detect(marketGroups: ArbMarketSnapshot[][], policy: ArbRiskPolicy, feeModel: FeeModel): ArbOpportunity[] {
    const opportunities: ArbOpportunity[] = [];

    for (const group of marketGroups) {
      if (group.length < 2) continue;

      // Group by eventId or externalId to find same market on different platforms
      // For this v1, we assume the group passed in contains the same event across platforms
      
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const m1 = group[i];
          const m2 = group[j];

          // Check YES on m1 vs NO on m2
          // If YES_m1 + NO_m2 < 1.0, it's an arb
          const yes1 = m1.yes.bestAsk || 1.0;
          const no2 = m2.no.bestAsk || 1.0;

          if (yes1 + no2 < 1.0 - (policy.minEdgePct / 100)) {
            const sizeUsd = 100;
            const est1 = ExecutionCostModel.estimateExecution('BUY', sizeUsd / 2, m1.yesBook, feeModel);
            const est2 = ExecutionCostModel.estimateExecution('BUY', sizeUsd / 2, m2.noBook, feeModel);

            const opportunity: ArbOpportunity = {
              id: `cross-${m1.id}-${m2.id}-${Date.now()}`,
              module: this.name,
              legs: [
                { platform: m1.platform, marketId: m1.id, side: 'YES', action: 'BUY', rawPrice: yes1, sizeUsd: sizeUsd / 2, shares: (sizeUsd / 2) / est1.expectedFillPriceVWAP },
                { platform: m2.platform, marketId: m2.id, side: 'NO', action: 'BUY', rawPrice: no2, sizeUsd: sizeUsd / 2, shares: (sizeUsd / 2) / est2.expectedFillPriceVWAP }
              ],
              estimatedCosts: { feesUsd: est1.feesUsd + est2.feesUsd, slippagePct: Math.max(est1.slippagePct, est2.slippagePct), totalCostUsd: est1.totalCostUsd + est2.totalCostUsd },
              requiredCapitalUsd: sizeUsd,
              edgePct: (1.0 - (est1.expectedFillPriceVWAP + est2.expectedFillPriceVWAP)) * 100,
              edgeDollars: sizeUsd * (1.0 - (est1.expectedFillPriceVWAP + est2.expectedFillPriceVWAP)) - (est1.feesUsd + est2.feesUsd),
              liquidity: { depthUsed: sizeUsd, expectedFillPct: (est1.expectedFillPct + est2.expectedFillPct) / 2 },
              rejectReasons: []
            };

            if (opportunity.liquidity.expectedFillPct < policy.minFillPct) opportunity.rejectReasons?.push('low_fill');
            opportunities.push(opportunity);
          }
        }
      }
    }

    return opportunities;
  }
}

