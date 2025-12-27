export class VolatilityEstimator {
  private history: Map<string, number[]> = new Map();
  private readonly maxHistory = 20;

  /**
   * Updates history and returns current volatility estimate.
   * Volatility is calculated as the standard deviation of mid price moves.
   */
  updateAndGetVolatility(marketId: string, currentMid: number): number {
    let prices = this.history.get(marketId) || [];
    prices.push(currentMid);
    
    if (prices.length > this.maxHistory) {
      prices.shift();
    }
    
    this.history.set(marketId, prices);

    if (prices.length < 2) {
      return 0;
    }

    // Simple volatility: average absolute change
    let totalChange = 0;
    for (let i = 1; i < prices.length; i++) {
      totalChange += Math.abs(prices[i] - prices[i - 1]);
    }

    return totalChange / (prices.length - 1);
  }

  getVolatility(marketId: string): number {
    const prices = this.history.get(marketId) || [];
    if (prices.length < 2) return 0;
    
    let totalChange = 0;
    for (let i = 1; i < prices.length; i++) {
      totalChange += Math.abs(prices[i] - prices[i - 1]);
    }
    return totalChange / (prices.length - 1);
  }
}

