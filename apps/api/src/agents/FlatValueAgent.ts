import { OrderIntent } from '@domain';
import { AgentInput, IAgentStrategy, FlatValueAgentConfig, DecisionTrace } from './types';

/**
 * FlatValueAgent: Places orders when model probability exceeds market probability
 * by a threshold, with a configurable bias adjustment.
 */
export class FlatValueAgent implements IAgentStrategy {
  public readonly name = 'FlatValueAgent';
  public readonly version = '1.0.0';
  private config: FlatValueAgentConfig;

  constructor(config: FlatValueAgentConfig) {
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

      // Check if edge meets threshold
      if (edgePct < this.config.edgeThresholdPct) {
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

      // Calculate stake amount
      const stakeAmount = (this.config.stakePct / 100) * input.state.bankroll;

      // Calculate shares
      const shares = Math.max(1, Math.floor(stakeAmount / askPrice));

      // DEV mode: Use market orders for natural fills (DEV_FORCE_TRADES=true)
      const devForceTrades = process.env.DEV_FORCE_TRADES === 'true';
      const useMarketOrder = devForceTrades;

      // Create order intent
      const intent: OrderIntent = {
        marketId: market.id,
        side: 'BUY',
        outcome: 'YES',
        shares,
        limitPrice: useMarketOrder ? undefined : askPrice,
        reason: `Edge detected: ${edgePct.toFixed(2)}% (model: ${(pModel * 100).toFixed(1)}%, market: ${(pMarket * 100).toFixed(1)}%)`,
        modelProb: pModel * 100,
        marketProb: pMarket * 100,
        edgePct,
        stakePct: this.config.stakePct,
      };

      intents.push(intent);
      reasoningBullets.push(
        `Market ${market.id}: Buy YES @ ${askPrice.toFixed(3)} with edge ${edgePct.toFixed(2)}%`
      );
    }

    const action = intents.length > 0 ? 'ORDER' : 'SKIP';
    const reason = intents.length > 0 
      ? `Found ${intents.length} opportunities with edge >= ${this.config.edgeThresholdPct}%`
      : 'No opportunities met the edge threshold';

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
