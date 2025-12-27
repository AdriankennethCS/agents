import { OrderIntent } from '@domain';
import { AgentInput, IAgentStrategy, RandomBaselineAgentConfig, DecisionTrace } from './types';

/**
 * RandomBaselineAgent: Random baseline strategy for comparison.
 */
export class RandomBaselineAgent implements IAgentStrategy {
  public readonly name = 'RandomBaselineAgent';
  public readonly version = '1.0.0';
  private config: RandomBaselineAgentConfig;

  constructor(config: RandomBaselineAgentConfig) {
    this.config = config;
  }

  async decide(input: AgentInput): Promise<DecisionTrace> {
    const startTime = Date.now();
    const intents: OrderIntent[] = [];
    const reasoningBullets: string[] = [];
    const eligibleMarketIds: string[] = [];

    for (const market of input.markets) {
      if (market.status !== 'open') {
        continue;
      }

      eligibleMarketIds.push(market.id);

      if (Math.random() >= this.config.chancePerTick) {
        continue;
      }

      const outcome = Math.random() < 0.5 ? 'YES' : 'NO';
      const quote = outcome === 'YES' ? market.yes : market.no;
      const askPrice = quote.bestAsk ?? quote.lastTradedPrice ?? quote.price;

      if (askPrice === undefined || askPrice <= 0) {
        continue;
      }

      const stakeAmount = (this.config.stakePct / 100) * input.state.bankroll;
      const shares = Math.max(1, Math.floor(stakeAmount / askPrice));

      const intent: OrderIntent = {
        marketId: market.id,
        side: 'BUY',
        outcome,
        shares,
        limitPrice: askPrice,
        reason: `Random baseline: ${(this.config.chancePerTick * 100).toFixed(1)}% chance per tick`,
        marketProb: quote.impliedProb,
        stakePct: this.config.stakePct,
      };

      intents.push(intent);
      reasoningBullets.push(`Market ${market.id}: Randomly chose ${outcome} @ ${askPrice.toFixed(3)}`);
    }

    const action = intents.length > 0 ? 'ORDER' : 'SKIP';

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
        reason: intents.length > 0 ? `Randomly selected ${intents.length} markets` : 'No markets selected this tick',
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
