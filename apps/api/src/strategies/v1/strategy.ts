import { AgentState, MarketSnapshot, OrderIntent } from '@domain';
import { StrategySpec, StrategyDecision, MarketFilterResult } from './types';
import { filterMarkets } from './marketFilter';

/**
 * Deterministic v1 strategy
 */
export function decideV1(
  state: AgentState,
  markets: MarketSnapshot[],
  spec: StrategySpec
): StrategyDecision {
  const reasoningBullets: string[] = [];
  
  // Step 1: Filter markets
  const filterResult: MarketFilterResult = filterMarkets(markets, spec.riskPolicy);
  reasoningBullets.push(`Filtered ${filterResult.filtered.length} markets, ${filterResult.eligible.length} eligible`);

  if (filterResult.eligible.length === 0) {
    return {
      skip: true,
      skipReason: 'No eligible markets after filtering',
      intents: [],
      reasoningBullets,
    };
  }

  // Step 2: Find best opportunity (deterministic: first market with sufficient edge)
  let bestMarket: MarketSnapshot | null = null;
  let bestEdge = -Infinity;

  for (const market of filterResult.eligible) {
    const pMarket = market.yes.impliedProb / 100;
    const pModel = Math.max(0, Math.min(1, pMarket + spec.biasPct / 100));
    const edge = pModel - pMarket;
    const edgePct = edge * 100;

    if (edgePct >= spec.minEdgePct && edgePct > bestEdge) {
      bestEdge = edgePct;
      bestMarket = market;
    }
  }

  if (!bestMarket || bestEdge < spec.minEdgePct) {
    return {
      skip: true,
      skipReason: `No market with edge >= ${spec.minEdgePct}%`,
      intents: [],
      reasoningBullets: [...reasoningBullets, `Best edge found: ${bestEdge.toFixed(2)}%`],
    };
  }

  reasoningBullets.push(
    `Selected market: ${bestMarket.title}`,
    `Edge: ${bestEdge.toFixed(2)}% (model: ${((bestMarket.yes.impliedProb / 100 + spec.biasPct / 100) * 100).toFixed(1)}%, market: ${bestMarket.yes.impliedProb.toFixed(1)}%)`
  );

  // Step 3: Calculate position size
  const stakeAmount = (spec.stakePct / 100) * state.bankroll;
  const yesPrice = bestMarket.yes.bestAsk ?? bestMarket.yes.lastTradedPrice ?? bestMarket.yes.price;
  
  if (yesPrice === undefined || yesPrice <= 0 || yesPrice >= 1) {
    return {
      skip: true,
      skipReason: 'Invalid price for selected market',
      intents: [],
      reasoningBullets,
    };
  }

  const shares = Math.max(1, Math.floor(stakeAmount / yesPrice));
  reasoningBullets.push(`Position size: ${shares} shares @ $${yesPrice.toFixed(3)} (stake: $${stakeAmount.toFixed(2)})`);

  // Step 4: Create intent
  const intent: OrderIntent = {
    marketId: bestMarket.id,
    side: 'BUY',
    outcome: 'YES',
    shares,
    limitPrice: yesPrice,
    reason: `V1 strategy: Edge ${bestEdge.toFixed(2)}% >= ${spec.minEdgePct}%`,
    modelProb: (bestMarket.yes.impliedProb / 100 + spec.biasPct / 100) * 100,
    marketProb: bestMarket.yes.impliedProb,
    edgePct: bestEdge,
    stakePct: spec.stakePct,
  };

  return {
    skip: false,
    intents: [intent],
    reasoningBullets,
  };
}

