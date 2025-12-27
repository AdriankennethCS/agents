import { AgentInput, IAgentStrategy, DecisionTrace } from '../contracts';
import { OrderIntent, MarketSnapshot } from '@domain';
import {
  MarketMakerAgentConfig,
  RewardsSnapshot,
  FairMidProvider,
  QuoteIntent,
  MarketDecision,
} from './types';
import { RewardYieldEstimator } from './RewardYieldEstimator';
import { VolatilityEstimator } from './VolatilityEstimator';
import { InventoryManager } from './inventory';

/**
 * MarketMakerRewardsAgent: Maximizes rewards by quoting spreads on high-reward markets.
 */
export class MarketMakerRewardsAgent implements IAgentStrategy {
  public readonly name = 'MarketMakerRewardsAgent';
  public readonly version = '1.0.0';
  private config: MarketMakerAgentConfig;
  private rewardEstimator: RewardYieldEstimator;
  private volEstimator: VolatilityEstimator;
  private inventoryManager: InventoryManager;
  private fairMidProvider?: FairMidProvider;

  constructor(
    config: MarketMakerAgentConfig,
    fairMidProvider?: FairMidProvider
  ) {
    this.config = config;
    this.rewardEstimator = new RewardYieldEstimator();
    this.volEstimator = new VolatilityEstimator();
    this.inventoryManager = new InventoryManager();
    this.fairMidProvider = fairMidProvider;
  }

  /**
   * Main decision loop for the Market Maker Rewards Agent
   */
  async decide(input: AgentInput): Promise<DecisionTrace> {
    const startTime = Date.now();
    const { state, markets } = input;
    const timestamp = new Date().toISOString();
    const portfolioExposure = this.inventoryManager.getPortfolioExposure(state, markets);

    const intents: OrderIntent[] = [];
    const reasoningBullets: string[] = [];
    const marketDecisions: Record<string, MarketDecision> = {};
    const rejectedMarkets: Array<{ marketId: string; reason: string }> = [];

    // 1. Filter and Score Markets
    const scoredMarkets = markets
      .map((market) => {
        const rewards = this.getRewardsForMarket(market);
        const decision = this.evaluateMarket(market, rewards, portfolioExposure, state.bankroll);
        
        if (typeof decision === 'string') {
          rejectedMarkets.push({ marketId: market.id, reason: decision });
          return null;
        }

        return { market, decision, score: decision.estimatedRewardYield };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => b.score - a.score);

    // 2. Quote top K markets (e.g., top 5)
    const topMarkets = scoredMarkets.slice(0, 5);

    for (const { market, decision } of topMarkets) {
      marketDecisions[market.id] = decision;
      
      const marketIntentsCount = intents.length;

      // Create BUY YES intent
      if (decision.bidSize > 0) {
        intents.push({
          marketId: market.id,
          side: 'BUY',
          outcome: 'YES',
          shares: decision.bidSize,
          limitPrice: parseFloat(decision.bid.toFixed(3)),
          reason: decision.rationale,
        });
      }

      // Create BUY NO intent
      if (decision.askSize > 0) {
        intents.push({
          marketId: market.id,
          side: 'BUY',
          outcome: 'NO',
          shares: decision.askSize,
          limitPrice: parseFloat((1 - decision.ask).toFixed(3)),
          reason: decision.rationale,
        });
      }

      if (intents.length > marketIntentsCount) {
        reasoningBullets.push(
          `Market ${market.id}: Quoting spread ${decision.spread.toFixed(3)} with yield $${decision.estimatedRewardYield.toFixed(2)}/hr`
        );
      }
    }

    const action = intents.length > 0 ? 'ORDER' : 'SKIP';
    const reason = intents.length > 0 
      ? `Quoting ${topMarkets.length} markets for rewards`
      : `No suitable reward markets found (considered ${markets.length})`;

    return {
      agentId: state.agentId,
      timestamp,
      input: {
        state,
        marketCount: markets.length,
        eligibleMarketIds: scoredMarkets.map(m => m.market.id),
      },
      strategy: {
        name: this.name,
        version: this.version,
        parameters: this.config as unknown as Record<string, unknown>,
      },
      decision: {
        action,
        reason,
        reasoningBullets,
        isPaperMode: state.isPaperMode,
        metadata: {
          tickSummary: {
            totalMarketsConsidered: markets.length,
            marketsQuoted: topMarkets.length,
            rejectedMarkets,
          },
          marketDecisions,
        },
      },
      intents,
      performance: {
        latencyMs: Date.now() - startTime,
      },
    };
  }

  private evaluateMarket(
    market: MarketSnapshot,
    rewards: RewardsSnapshot | undefined,
    exposure: any,
    bankroll: number
  ): MarketDecision | string {
    // Basic filters
    if (market.status !== 'open') return 'Market not open';
    if (!rewards) return 'No rewards for this market';

    // 1. Reward threshold check
    const estimatedYield = this.rewardEstimator.estimateYield(rewards.minShares, rewards);
    if (estimatedYield < this.config.rewardThreshold) {
      return `Yield ${estimatedYield.toFixed(4)} < threshold ${this.config.rewardThreshold}`;
    }

    // 2. Volatility check
    const bestBid = market.yes.bestBid ?? market.yes.price;
    const bestAsk = market.yes.bestAsk ?? market.yes.price;
    const mid = (bestBid + bestAsk) / 2;
    const volatility = this.volEstimator.updateAndGetVolatility(market.id, mid);
    if (volatility > this.config.maxVolatility) {
      return `Volatility ${volatility.toFixed(4)} > limit ${this.config.maxVolatility}`;
    }

    // 3. Time to resolution taper
    const now = new Date();
    const resolvesAt = market.resolvesAt ? new Date(market.resolvesAt) : null;
    let hoursToResolve = 24 * 30; // Default to 30 days if unknown
    if (resolvesAt) {
      hoursToResolve = (resolvesAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    }

    if (hoursToResolve < this.config.taperEndHours) {
      return 'Too close to resolution';
    }

    const taperFactor = this.inventoryManager.calculateTaperFactor(
      hoursToResolve,
      this.config.taperStartHours,
      this.config.taperEndHours
    );

    // 4. Fair Mid adjustment
    let adjustedMid = mid;
    let fairMidAdjustment = 0;
    if (this.fairMidProvider) {
      const fairMid = this.fairMidProvider.getFairMid(market.id);
      if (fairMid !== null) {
        fairMidAdjustment = fairMid - mid;
        adjustedMid = mid + fairMidAdjustment * 0.5; 
      }
    }

    // 5. Quote calculation
    const targetSpread = Math.min(rewards.maxSpread, 0.05); 
    
    let bid = adjustedMid - targetSpread / 2;
    let ask = adjustedMid + targetSpread / 2;

    // 6. Inventory skew adjustment
    const currentMarketExposure = exposure.marketExposure[market.id] || { yes: 0, no: 0 };
    const inventorySkew = currentMarketExposure.yes - currentMarketExposure.no; 
    
    const skewAdjustment = (inventorySkew / (bankroll * this.config.maxInventoryPerMarketPct / 100)) * 0.01;
    bid += skewAdjustment;
    ask += skewAdjustment;

    // 7. Size calculation
    const maxSharesYes = this.inventoryManager.calculateMaxShares(market, 'YES', bid, bankroll, exposure, {
      ...this.config,
      taperFactor,
    });
    const maxSharesNo = this.inventoryManager.calculateMaxShares(market, 'NO', 1 - ask, bankroll, exposure, {
      ...this.config,
      taperFactor,
    });

    const bidSize = Math.min(maxSharesYes, rewards.minShares * 2); 
    const askSize = Math.min(maxSharesNo, rewards.minShares * 2);

    if (bidSize < rewards.minShares && askSize < rewards.minShares) {
      return 'Inventory limits prevent meeting MinShares';
    }

    return {
      marketId: market.id,
      mid: adjustedMid,
      bid,
      ask,
      bidSize,
      askSize,
      spread: ask - bid,
      rewardConstraints: {
        minShares: rewards.minShares,
        maxSpread: rewards.maxSpread,
      },
      estimatedRewardYield: estimatedYield,
      expectedSpreadPnlProxy: (ask - bid) * ((bidSize + askSize) / 2),
      inventoryBefore: { ...currentMarketExposure },
      inventoryAfter: { 
        yes: currentMarketExposure.yes + bidSize * bid, 
        no: currentMarketExposure.no + askSize * (1 - ask) 
      },
      categoryExposureBefore: exposure.categoryExposure[market.category || 'Unknown'] || { yes: 0, no: 0 },
      categoryExposureAfter: { yes: 0, no: 0 }, 
      timeToResolve: hoursToResolve,
      taperFactor,
      fairMidAdjustment: fairMidAdjustment !== 0 ? fairMidAdjustment : undefined,
      rationale: `Quoting with ${targetSpread.toFixed(4)} spread, ${taperFactor.toFixed(2)} taper, skew ${skewAdjustment.toFixed(4)}`,
    };
  }

  private getRewardsForMarket(market: MarketSnapshot): RewardsSnapshot | undefined {
    if (market.category === 'Crypto' || market.category === 'Politics') {
      return {
        marketId: market.id,
        dailyRewardPool: 1000,
        minShares: 100,
        maxSpread: 0.02,
        competitionProxy: 5000,
      };
    }
    return undefined;
  }
}
