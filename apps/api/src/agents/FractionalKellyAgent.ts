import { OrderIntent } from '@domain';
import { AgentInput, IAgentStrategy, FractionalKellyAgentConfig, DecisionTrace } from './types';

/**
 * FractionalKellyAgent: Uses fractional Kelly criterion for position sizing.
 */
export class FractionalKellyAgent implements IAgentStrategy {
  public readonly name = 'FractionalKellyAgent';
  public readonly version = '1.0.0';
  private config: FractionalKellyAgentConfig;

  constructor(config: FractionalKellyAgentConfig) {
    this.config = config;
  }

  async decide(input: AgentInput): Promise<DecisionTrace> {
    const startTime = Date.now();
    const intents: OrderIntent[] = [];
    const reasoningBullets: string[] = [];
    const eligibleMarketIds: string[] = [];

    for (const market of input.markets) {
      // Only consider open markets
      if (market.status !== 'open') {
        continue;
      }

      eligibleMarketIds.push(market.id);

      // Calculate market probability from YES outcome
      const pMarket = market.yes.impliedProb / 100;

      // Apply bias to get model probability
      const pModel = Math.max(0, Math.min(1, pMarket + this.config.biasPct / 100));

      // Calculate edge
      const edge = pModel - pMarket;
      const edgePct = edge * 100;

      // Check if edge meets floor threshold
      if (edgePct < this.config.edgeFloorPct) {
        continue; // Edge too small
      }

      // Determine price to use (bestAsk preferred, fallback to lastTradedPrice, then price)
      const bestAsk = market.yes.bestAsk;
      const lastTraded = market.yes.lastTradedPrice;
      const fallbackPrice = market.yes.price;

      const askPrice = bestAsk ?? lastTraded ?? fallbackPrice;

      // Skip if no valid price available or price is 1.0 (no upside)
      if (askPrice === undefined || askPrice <= 0 || askPrice >= 1) {
        continue;
      }

      // Calculate Kelly percentage
      const kellyPct = Math.max(0, Math.min(1, (pModel - askPrice) / (1 - askPrice)));

      // Apply fractional Kelly
      const stakePct = this.config.kellyFraction * kellyPct * 100;

      // Skip if stake percentage is too small (less than 0.1%)
      if (stakePct < 0.1) {
        continue;
      }

      // Calculate stake amount
      const stakeAmount = (stakePct / 100) * input.state.bankroll;

      // Calculate shares
      const shares = Math.max(1, Math.floor(stakeAmount / askPrice));

      // Create order intent
      const intent: OrderIntent = {
        marketId: market.id,
        side: 'BUY',
        outcome: 'YES',
        shares,
        limitPrice: askPrice,
        reason: `Fractional Kelly: ${(this.config.kellyFraction * 100).toFixed(0)}% of ${(kellyPct * 100).toFixed(2)}% Kelly (edge: ${edgePct.toFixed(2)}%)`,
        modelProb: pModel * 100,
        marketProb: pMarket * 100,
        edgePct,
        stakePct,
      };

      intents.push(intent);
      reasoningBullets.push(
        `Market ${market.id}: Kelly stake ${stakePct.toFixed(2)}% (edge ${edgePct.toFixed(2)}%)`
      );
    }

    const action = intents.length > 0 ? 'ORDER' : 'SKIP';
    const reason = intents.length > 0
      ? `Found ${intents.length} opportunities with edge >= ${this.config.edgeFloorPct}%`
      : 'No opportunities met the edge floor threshold';

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
        parameters: this.config as unknown as Record<string, unknown>,
      },
      decision: {
        action,
        reason,
        reasoningBullets,
        isPaperMode: input.state.isPaperMode,
      },
      intents,
      performance: {
        latencyMs: Date.now() - startTime,
      },
    };
  }
}
