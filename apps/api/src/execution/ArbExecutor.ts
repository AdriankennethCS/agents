import { ArbOpportunity, ArbLeg } from '../agents/arbitrage/types';

export interface LegResult {
  marketId: string;
  platform: string;
  status: 'FILLED' | 'PARTIAL' | 'TIMEOUT' | 'FAILED';
  filledShares: number;
  avgPrice: number;
}

export interface ExecutionResult {
  opportunityId: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  legs: LegResult[];
  timestamp: string;
}

export class ArbExecutor {
  /**
   * Simulates execution of an arbitrage opportunity (paper mode)
   */
  async execute(opportunity: ArbOpportunity): Promise<ExecutionResult> {
    const results: LegResult[] = [];
    let allSuccess = true;
    let anySuccess = false;

    // Simulate parallel execution
    for (const leg of opportunity.legs) {
      const result = await this.simulateLegExecution(leg, opportunity.liquidity.expectedFillPct);
      results.push(result);
      
      if (result.status !== 'FILLED') {
        allSuccess = false;
      } else {
        anySuccess = true;
      }
    }

    let status: 'SUCCESS' | 'PARTIAL' | 'FAILED' = 'SUCCESS';
    if (!allSuccess) {
      status = anySuccess ? 'PARTIAL' : 'FAILED';
    }

    // If partial, simulate rollback (e.g., exiting the successful legs at a loss)
    if (status === 'PARTIAL') {
      // Logic for simulated rollback/hedge could go here
    }

    return {
      opportunityId: opportunity.id,
      status,
      legs: results,
      timestamp: new Date().toISOString()
    };
  }

  private async simulateLegExecution(leg: ArbLeg, expectedFillPct: number): Promise<LegResult> {
    // Randomness for paper simulation
    const rand = Math.random() * 100;
    
    if (rand < 2) { // 2% chance of total failure/timeout
      return {
        marketId: leg.marketId,
        platform: leg.platform,
        status: 'TIMEOUT',
        filledShares: 0,
        avgPrice: 0
      };
    }

    if (rand < 10) { // 8% chance of partial fill
      const partialPct = Math.random() * 0.5; // fill between 0-50%
      return {
        marketId: leg.marketId,
        platform: leg.platform,
        status: 'PARTIAL',
        filledShares: leg.shares * partialPct,
        avgPrice: leg.rawPrice * 1.01 // worse price on partial
      };
    }

    // Default to success if rand > 10, but respect expectedFillPct
    const fillPct = Math.min(100, expectedFillPct) / 100;
    return {
      marketId: leg.marketId,
      platform: leg.platform,
      status: fillPct === 1 ? 'FILLED' : 'PARTIAL',
      filledShares: leg.shares * fillPct,
      avgPrice: leg.rawPrice
    };
  }
}

