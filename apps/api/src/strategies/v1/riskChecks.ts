import { AgentState, MarketSnapshot, OrderIntent } from '@domain';
import { RiskPolicy, RiskAssessment, RiskCheckResult } from './types';

/**
 * Calculate total exposure from positions
 */
function calculateTotalExposure(
  positions: AgentState['openPositions'],
  markets: MarketSnapshot[]
): number {
  const marketMap = new Map<string, MarketSnapshot>();
  for (const market of markets) {
    marketMap.set(market.id, market);
  }

  let totalExposure = 0;
  for (const position of positions) {
    const market = marketMap.get(position.marketId);
    if (!market) continue;

    const quote = position.outcome === 'YES' ? market.yes : market.no;
    const currentPrice = quote.bestAsk ?? quote.lastTradedPrice ?? quote.price;
    if (currentPrice === undefined) continue;

    totalExposure += position.shares * currentPrice;
  }

  return totalExposure;
}

/**
 * Perform risk checks on intents
 */
export function performRiskChecks(
  state: AgentState,
  markets: MarketSnapshot[],
  intents: OrderIntent[],
  riskPolicy: RiskPolicy
): RiskAssessment {
  const checksPassed: RiskCheckResult[] = [];
  const checksFailed: RiskCheckResult[] = [];

  // Check 1: Max risk per trade
  for (const intent of intents) {
    const market = markets.find((m) => m.id === intent.marketId);
    if (!market) {
      checksFailed.push({
        check: 'market_exists',
        passed: false,
        reason: `Market ${intent.marketId} not found`,
      });
      continue;
    }

    const quote = intent.outcome === 'YES' ? market.yes : market.no;
    const fillPrice = quote.bestAsk ?? quote.lastTradedPrice ?? quote.price;
    if (fillPrice === undefined) {
      checksFailed.push({
        check: 'price_available',
        passed: false,
        reason: `No price available for ${intent.marketId} ${intent.outcome}`,
      });
      continue;
    }

    const notional = intent.shares * fillPrice;
    const maxRisk = (riskPolicy.maxRiskPerTradePct / 100) * state.bankroll;

    if (notional <= maxRisk) {
      checksPassed.push({
        check: 'max_risk_per_trade',
        passed: true,
        reason: `Trade risk $${notional.toFixed(2)} <= max $${maxRisk.toFixed(2)}`,
      });
    } else {
      checksFailed.push({
        check: 'max_risk_per_trade',
        passed: false,
        reason: `Trade risk $${notional.toFixed(2)} > max $${maxRisk.toFixed(2)}`,
      });
    }
  }

  // Check 2: Max total exposure
  const currentExposure = calculateTotalExposure(state.openPositions, markets);
  const newExposure = intents.reduce((sum, intent) => {
    const market = markets.find((m) => m.id === intent.marketId);
    if (!market) return sum;
    const quote = intent.outcome === 'YES' ? market.yes : market.no;
    const fillPrice = quote.bestAsk ?? quote.lastTradedPrice ?? quote.price;
    if (fillPrice === undefined) return sum;
    return sum + intent.shares * fillPrice;
  }, 0);

  const totalExposure = currentExposure + newExposure;
  const maxExposure = (riskPolicy.maxExposurePct / 100) * state.bankroll;

  if (totalExposure <= maxExposure) {
    checksPassed.push({
      check: 'max_total_exposure',
      passed: true,
      reason: `Total exposure $${totalExposure.toFixed(2)} <= max $${maxExposure.toFixed(2)}`,
    });
  } else {
    checksFailed.push({
      check: 'max_total_exposure',
      passed: false,
      reason: `Total exposure $${totalExposure.toFixed(2)} > max $${maxExposure.toFixed(2)}`,
    });
  }

  // Check 3: Bankroll sufficient
  const totalCost = intents.reduce((sum, intent) => {
    const market = markets.find((m) => m.id === intent.marketId);
    if (!market) return sum;
    const quote = intent.outcome === 'YES' ? market.yes : market.no;
    const fillPrice = quote.bestAsk ?? quote.lastTradedPrice ?? quote.price;
    if (fillPrice === undefined) return sum;
    return sum + intent.shares * fillPrice;
  }, 0);

  if (totalCost <= state.bankroll) {
    checksPassed.push({
      check: 'bankroll_sufficient',
      passed: true,
      reason: `Total cost $${totalCost.toFixed(2)} <= bankroll $${state.bankroll.toFixed(2)}`,
    });
  } else {
    checksFailed.push({
      check: 'bankroll_sufficient',
      passed: false,
      reason: `Total cost $${totalCost.toFixed(2)} > bankroll $${state.bankroll.toFixed(2)}`,
    });
  }

  return {
    checksPassed,
    checksFailed,
    blocked: checksFailed.length > 0,
  };
}

