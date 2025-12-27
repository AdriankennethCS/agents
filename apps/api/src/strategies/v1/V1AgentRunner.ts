import { AgentState, MarketSnapshot } from '@domain';
import { MarketDataService } from '../../marketData/MarketDataService';
import { IStateStore } from '../../stores/StateStore';
import { ILogStore } from '../../logging/LogStore';
import { DecisionLog } from '../../logging/types';
import { StrategySpec, RiskPolicy } from './types';
import { decideV1 } from './strategy';
import { performRiskChecks } from './riskChecks';

/**
 * V1 Agent Runner - Paper mode (generates DecisionLogs, does NOT place orders)
 */
export class V1AgentRunner {
  private marketDataService: MarketDataService;
  private stateStore: IStateStore;
  private logStore: ILogStore;

  constructor(
    marketDataService: MarketDataService,
    stateStore: IStateStore,
    logStore: ILogStore
  ) {
    this.marketDataService = marketDataService;
    this.stateStore = stateStore;
    this.logStore = logStore;
  }

  /**
   * Execute one tick: fetch market data and process agent in paper mode
   */
  async tick(agentId: string, spec: StrategySpec): Promise<void> {
    // Get agent state
    const state = this.stateStore.getAgentState(agentId);
    if (!state) {
      console.warn(`[V1AgentRunner] Agent ${agentId} not found`);
      return;
    }

    // Skip if paused
    if (state.status === 'paused') {
      return;
    }

    // Fetch market snapshots
    let snapshots: MarketSnapshot[];
    try {
      snapshots = await this.marketDataService.getAllMarketSnapshots();
    } catch (error) {
      console.error(`[V1AgentRunner] Failed to fetch market snapshots for ${agentId}:`, error);
      return;
    }

    if (snapshots.length === 0) {
      console.warn(`[V1AgentRunner] No market snapshots available for ${agentId}`);
      return;
    }

    // Run strategy decision
    const decision = decideV1(state, snapshots, spec);

    // Perform risk checks if not skipping
    let riskAssessment;
    if (!decision.skip && decision.intents.length > 0) {
      riskAssessment = performRiskChecks(state, snapshots, decision.intents, spec.riskPolicy);
    } else {
      riskAssessment = {
        checksPassed: [],
        checksFailed: [],
        blocked: false,
      };
    }

    // Build summary
    const summary = decision.skip
      ? `SKIP: ${decision.skipReason}`
      : riskAssessment.blocked
      ? `BLOCKED: ${riskAssessment.checksFailed.length} risk check(s) failed`
      : `READY: ${decision.intents.length} intent(s) generated`;

    // Create decision log
    const timestamp = new Date().toISOString();
    const decisionLog: DecisionLog = {
      agentId,
      timestamp,
      summary,
      reasoningBullets: decision.reasoningBullets,
      risk: riskAssessment,
      intents: riskAssessment.blocked ? [] : decision.intents, // Clear intents if blocked
      filledCount: 0, // Paper mode: no fills
      rejectedCount: riskAssessment.blocked ? decision.intents.length : 0,
      metadata: {
        strategyVersion: 'v1',
        paperMode: true,
        marketsConsidered: snapshots.length,
      },
    };

    // Store decision log
    this.logStore.addDecision(decisionLog);

    // Log to console (dev only)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[V1AgentRunner] ${agentId}: ${summary}`);
      if (riskAssessment.checksFailed.length > 0) {
        console.log(`  Failed checks: ${riskAssessment.checksFailed.map((c) => c.check).join(', ')}`);
      }
    }
  }
}

