import { OrderIntent, MarketSnapshot } from '@domain';
import { 
  AgentInput, 
  IAgentStrategy, 
  DecisionTrace 
} from '../contracts';
import { 
  NicheLLMModelAgentConfig, 
  FeatureVector,
  ModelPrediction
} from './types';
import { IProbabilityModel } from './models/IProbabilityModel';
import { IFeatureProvider, DefaultFeatureProvider } from './features/FeatureProvider';
import { CalibrationTracker } from './calibration/CalibrationTracker';
import { calculateKellyFraction, calculateStakeUsd } from './policy/sizing';

/**
 * NicheLLMModelAgent: A model-driven agent that filters for niche markets,
 * uses an LLM-based probability model, and sizes trades using fractional Kelly.
 */
export class NicheLLMModelAgent implements IAgentStrategy {
  public readonly name = 'NicheLLMModelAgent';
  public readonly version = '1.0.0';
  
  private config: NicheLLMModelAgentConfig;
  private model: IProbabilityModel;
  private featureProvider: IFeatureProvider;
  private calibrationTracker: CalibrationTracker;
  private cooldowns: Map<string, number> = new Map(); // marketId -> timestamp

  constructor(
    config: NicheLLMModelAgentConfig,
    model: IProbabilityModel,
    featureProvider: IFeatureProvider = new DefaultFeatureProvider(),
    calibrationTracker: CalibrationTracker = new CalibrationTracker()
  ) {
    this.config = config;
    this.model = model;
    this.featureProvider = featureProvider;
    this.calibrationTracker = calibrationTracker;
  }

  async decide(input: AgentInput): Promise<DecisionTrace> {
    const startTime = Date.now();
    const intents: OrderIntent[] = [];
    const reasoningBullets: string[] = [];
    const eligibleMarketIds: string[] = [];
    const now = Date.now();

    // 1. Filter and sort markets
    const filteredMarkets = input.markets
      .filter(m => m.status === 'open')
      .filter(m => this.isNicheMarket(m))
      .filter(m => (m.yes.volume24h || 0) >= this.config.minLiquidityUsd)
      .sort((a, b) => {
        // Sort by liquidity (desc) and then proximity to resolution (asc)
        const volA = a.yes.volume24h || 0;
        const volB = b.yes.volume24h || 0;
        if (volB !== volA) return volB - volA;
        
        const resA = a.resolvesAt ? new Date(a.resolvesAt).getTime() : Infinity;
        const resB = b.resolvesAt ? new Date(b.resolvesAt).getTime() : Infinity;
        return resA - resB;
      });

    // 2. Process top markets
    const marketsToEvaluate = filteredMarkets.slice(0, this.config.maxMarketsPerTick);
    
    for (const market of marketsToEvaluate) {
      eligibleMarketIds.push(market.id);
      
      // Cooldown check
      const lastTradeTime = this.cooldowns.get(market.id) || 0;
      if (now - lastTradeTime < this.config.cooldownMinutes * 60 * 1000) {
        reasoningBullets.push(`Market ${market.id}: Skipping due to cooldown.`);
        continue;
      }

      // Get features
      const features = await this.featureProvider.getFeatures(market);
      
      // Get prediction
      const prediction: ModelPrediction = await this.model.predict(market, features);
      const pModel = prediction.p / 100;
      const pMarket = market.yes.impliedProb / 100;
      const edge = pModel - pMarket;
      const edgePct = edge * 100;

      // Log prediction for calibration
      this.calibrationTracker.recordPrediction(
        market.id,
        prediction.p,
        prediction.confidence,
        new Date().toISOString(),
        prediction.modelVersion
      );

      // Edge threshold check
      if (edgePct < this.config.edgeThresholdPct) {
        reasoningBullets.push(`Market ${market.id}: Edge ${edgePct.toFixed(2)}% < threshold ${this.config.edgeThresholdPct}%`);
        continue;
      }

      // Sizing
      const askPrice = market.yes.bestAsk ?? market.yes.lastTradedPrice ?? market.yes.price;
      if (askPrice === undefined || askPrice <= 0 || askPrice >= 1) {
        reasoningBullets.push(`Market ${market.id}: No valid ask price.`);
        continue;
      }

      const fStar = calculateKellyFraction(pModel, askPrice);
      const { stakeUsd, capsApplied } = calculateStakeUsd(
        input.state.bankroll,
        this.config.kellyFraction,
        fStar,
        prediction.confidence,
        this.config.maxRiskPerTradePct
      );

      const shares = Math.floor(stakeUsd / askPrice);
      if (shares <= 0) {
        reasoningBullets.push(`Market ${market.id}: Stake too small for 1 share.`);
        continue;
      }

      // Create intent
      const intent: OrderIntent = {
        marketId: market.id,
        side: 'BUY',
        outcome: 'YES',
        shares,
        limitPrice: askPrice,
        reason: `Model: ${(pModel * 100).toFixed(1)}%, Market: ${(pMarket * 100).toFixed(1)}%, Edge: ${edgePct.toFixed(2)}%, KellyF: ${fStar.toFixed(3)}, Conf: ${prediction.confidence.toFixed(2)}`,
        modelProb: prediction.p,
        marketProb: market.yes.impliedProb,
        edgePct,
        stakePct: (stakeUsd / input.state.bankroll) * 100,
      };

      intents.push(intent);
      this.cooldowns.set(market.id, now);
      
      reasoningBullets.push(
        `Market ${market.id}: BUY ${shares} YES @ ${askPrice.toFixed(3)} (Stake: $${stakeUsd.toFixed(2)}${capsApplied.length ? ', caps: ' + capsApplied.join(', ') : ''})`
      );
    }

    const action = intents.length > 0 ? 'ORDER' : 'SKIP';
    const reason = intents.length > 0 
      ? `Found ${intents.length} niche opportunities with significant edge.`
      : 'No niche opportunities met the requirements this tick.';

    return {
      agentId: input.state.agentId,
      timestamp: new Date().toISOString(),
      input: {
        state: input.state,
        marketCount: input.markets.length,
        eligibleMarketIds,
      },
      strategy: {
        name: this.name,
        version: this.version,
        parameters: this.config as any,
      },
      decision: {
        action,
        reason,
        reasoningBullets,
        isPaperMode: input.state.isPaperMode,
        metadata: {
          modelVersion: this.model.getVersion(),
          maxMarketsEvaluated: this.config.maxMarketsPerTick,
          filteredCount: filteredMarkets.length,
        }
      },
      intents,
      performance: {
        latencyMs: Date.now() - startTime,
      },
    };
  }

  private isNicheMarket(market: MarketSnapshot): boolean {
    const text = (market.title + ' ' + (market.category || '')).toLowerCase();
    return this.config.nicheKeywords.some(keyword => {
      const lowerKeyword = keyword.toLowerCase();
      // Simple word boundary check
      const regex = new RegExp(`\\b${lowerKeyword}\\b`, 'i');
      return regex.test(text);
    });
  }

  /**
   * Get the calibration tracker for the agent
   */
  getCalibrationTracker(): CalibrationTracker {
    return this.calibrationTracker;
  }
}

