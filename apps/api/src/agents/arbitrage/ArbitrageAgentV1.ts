import { IAgentStrategy, AgentInput, DecisionTrace } from '../contracts';
import { OrderIntent, MarketSnapshot } from '@domain';
import { 
  ArbMarketSnapshot, 
  ArbRiskPolicy, 
  FeeModel, 
  ArbOpportunity, 
  ArbLeg 
} from './types';
import { ArbModule } from './modules/types';
import { SingleOutcomeArbModule } from './modules/single';
import { CrossPlatformArbModule } from './modules/crossPlatform';
import { MultiOutcomeArbModule } from './modules/multi';
import { ThreeWayArbModule } from './modules/threeWay';
import { CrossConditionalArbModule } from './modules/crossConditional';
import { ArbExecutor } from '../../execution/ArbExecutor';
import { DecisionStore } from '../../stores/DecisionStore';

/**
 * ArbitrageAgentV1: Detects and executes arbitrage opportunities across markets and platforms.
 */
export class ArbitrageAgentV1 implements IAgentStrategy {
  public readonly name = 'ArbitrageAgentV1';
  public readonly version = '1.0.0';
  private modules: ArbModule[];
  private executor: ArbExecutor;
  private riskPolicy: ArbRiskPolicy;
  private feeModel: FeeModel;

  constructor(
    riskPolicy: ArbRiskPolicy,
    feeModel: FeeModel
  ) {
    this.riskPolicy = riskPolicy;
    this.feeModel = feeModel;
    this.executor = new ArbExecutor();
    this.modules = [
      new SingleOutcomeArbModule(),
      new CrossPlatformArbModule(),
      new MultiOutcomeArbModule(),
      new ThreeWayArbModule(),
      new CrossConditionalArbModule()
    ];
  }

  decide(input: AgentInput): DecisionTrace {
    const startTime = Date.now();
    const { state, markets } = input;
    
    // Group markets by event
    const arbMarkets = markets.map(m => this.toArbMarket(m));
    const marketGroups = this.groupMarkets(arbMarkets);

    const allOpportunities: ArbOpportunity[] = [];
    const moduleStats: Record<string, any> = {};

    for (const module of this.modules) {
      const opps = module.detect(marketGroups, this.riskPolicy, this.feeModel);
      
      const rejected = opps.filter(o => (o.rejectReasons?.length || 0) > 0);
      const valid = opps.filter(o => (o.rejectReasons?.length || 0) === 0);
      
      moduleStats[module.name] = {
        found: opps.length,
        rejected: rejected.length,
        executed: 0,
        rejectReasons: this.countReasons(rejected)
      };
      
      allOpportunities.push(...valid);
    }

    // Risk Prioritization
    const rankedOpps = this.rankOpportunities(allOpportunities);
    
    // Capital Allocation & Execution
    const executedOpps: ArbOpportunity[] = [];
    let currentExposure = state.maxExposurePct * state.bankroll / 100; // Simplified
    
    for (const opp of rankedOpps) {
      if (opp.requiredCapitalUsd <= (state.bankroll - currentExposure)) {
        // Execute (simulated)
        executedOpps.push(opp);
        currentExposure += opp.requiredCapitalUsd;
        moduleStats[opp.module].executed++;
      } else {
        opp.rejectReasons = opp.rejectReasons || [];
        opp.rejectReasons.push('insufficient_capital');
      }
    }

    const intents = this.toOrderIntents(executedOpps);
    const action = intents.length > 0 ? 'ORDER' : 'SKIP';
    const tickSummary = `Found ${allOpportunities.length} opportunities, executed ${executedOpps.length}.`;

    const trace: DecisionTrace = {
      agentId: state.agentId,
      timestamp: new Date().toISOString(),
      input: {
        state,
        marketCount: markets.length,
      },
      strategy: {
        name: this.name,
        version: this.version,
        parameters: {
          riskPolicy: this.riskPolicy,
          feeModel: this.feeModel,
        },
      },
      decision: {
        action,
        reason: tickSummary,
        reasoningBullets: executedOpps.map(o => `${o.module}: ${o.edgePct.toFixed(2)}% edge, $${o.edgeDollars.toFixed(2)}`),
        isPaperMode: state.isPaperMode,
        metadata: {
          evaluatedGroupsCount: marketGroups.length,
          opportunitiesFoundCount: allOpportunities.length,
          moduleStats,
          executedOpportunities: executedOpps,
          rejectedOpportunities: allOpportunities.filter(o => (o.rejectReasons?.length || 0) > 0),
        },
      },
      intents,
      performance: {
        latencyMs: Date.now() - startTime,
      },
    };

    // Store DecisionTrace
    this.storeDecisionTrace(trace);

    return trace;
  }

  private toArbMarket(m: MarketSnapshot): ArbMarketSnapshot {
    return {
      ...m,
      platform: (m as any).platform || 'polymarket',
      eventId: (m as any).eventId || m.id,
      yesBook: (m as any).yesBook || { bids: [{ price: m.yes.bestBid || 0.5, size: 1000 }], asks: [{ price: m.yes.bestAsk || 0.51, size: 1000 }] },
      noBook: (m as any).noBook || { bids: [{ price: m.no.bestBid || 0.5, size: 1000 }], asks: [{ price: m.no.bestAsk || 0.51, size: 1000 }] },
    };
  }

  private groupMarkets(markets: ArbMarketSnapshot[]): ArbMarketSnapshot[][] {
    const groups: Record<string, ArbMarketSnapshot[]> = {};
    for (const m of markets) {
      const gid = m.eventId;
      if (!groups[gid]) groups[gid] = [];
      groups[gid].push(m);
    }
    return Object.values(groups);
  }

  private rankOpportunities(opps: ArbOpportunity[]): ArbOpportunity[] {
    return opps.sort((a, b) => {
      const scoreA = this.calculateScore(a);
      const scoreB = this.calculateScore(b);
      return scoreB - scoreA;
    });
  }

  private calculateScore(opp: ArbOpportunity): number {
    const weight = this.riskPolicy.moduleWeights[opp.module] || 1;
    const riskScore = this.riskPolicy.moduleRiskScores[opp.module] || 1;
    return (opp.edgeDollars * weight) / (opp.requiredCapitalUsd * riskScore);
  }

  private countReasons(rejected: ArbOpportunity[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const opp of rejected) {
      for (const reason of (opp.rejectReasons || [])) {
        counts[reason] = (counts[reason] || 0) + 1;
      }
    }
    return counts;
  }

  private toOrderIntents(opps: ArbOpportunity[]): OrderIntent[] {
    const intents: OrderIntent[] = [];
    for (const opp of opps) {
      for (const leg of opp.legs) {
        intents.push({
          marketId: leg.marketId,
          side: leg.action,
          outcome: leg.side,
          shares: leg.shares,
          limitPrice: leg.rawPrice,
          reason: `Arb leg for ${opp.module} (ID: ${opp.id})`
        });
      }
    }
    return intents;
  }

  private storeDecisionTrace(trace: DecisionTrace) {
    // We can still use DecisionStore if we want, but AgentRunner also logs now.
    // DecisionStore.getInstance().addDecision(trace);
  }
}
