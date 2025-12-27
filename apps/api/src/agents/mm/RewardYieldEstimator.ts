import { RewardsSnapshot } from './types';

export class RewardYieldEstimator {
  /**
   * Estimates the expected reward yield in USD per hour.
   * 
   * @param myShares The number of shares we plan to provide as liquidity
   * @param snapshot The rewards snapshot for the market
   * @returns Estimated $/hour
   */
  estimateYield(myShares: number, snapshot: RewardsSnapshot): number {
    const dailyPool = snapshot.dailyRewardPool;
    const hourlyPool = dailyPool / 24;
    
    // If competition proxy is available, use it. Otherwise assume some baseline.
    const totalCompetition = snapshot.competitionProxy ?? 1000; // Default baseline if unknown
    
    // Reward is proportional to our share of the total liquidity in the pool
    // Reward = (myShares / (totalCompetition + myShares)) * hourlyPool
    // Note: totalCompetition should ideally include our shares if it's the total pool size,
    // but usually it's easier to think of it as "other people's shares".
    
    const yieldPerHour = (myShares / (totalCompetition + myShares)) * hourlyPool;
    
    return yieldPerHour;
  }
}

