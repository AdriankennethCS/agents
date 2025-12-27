import { V1AgentRunner } from './V1AgentRunner';
import { StrategySpec } from './types';

/**
 * Scheduler for V1 agent in paper mode
 */
export class V1Scheduler {
  private runner: V1AgentRunner;
  private agentId: string;
  private spec: StrategySpec;
  private intervalMs: number;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(
    runner: V1AgentRunner,
    agentId: string,
    spec: StrategySpec,
    intervalSeconds: number = 60
  ) {
    this.runner = runner;
    this.agentId = agentId;
    this.spec = spec;
    this.intervalMs = intervalSeconds * 1000;
  }

  start(): void {
    if (this.intervalId !== null) {
      console.warn('[V1Scheduler] Already running, ignoring start()');
      return;
    }

    console.log(`[V1Scheduler] Starting for ${this.agentId} with interval ${this.intervalMs / 1000}s`);
    
    // Run first tick immediately
    this.runTick();

    // Schedule subsequent ticks
    this.intervalId = setInterval(() => {
      this.runTick();
    }, this.intervalMs);
  }

  stop(): void {
    if (this.intervalId === null) {
      return;
    }

    clearInterval(this.intervalId);
    this.intervalId = null;
    console.log('[V1Scheduler] Stopped');
  }

  private async runTick(): Promise<void> {
    if (this.isRunning) {
      console.warn('[V1Scheduler] Previous tick still running, skipping this tick');
      return;
    }

    this.isRunning = true;

    try {
      await this.runner.tick(this.agentId, this.spec);
    } catch (error) {
      console.error('[V1Scheduler] Error in tick:', error);
    } finally {
      this.isRunning = false;
    }
  }

  isActive(): boolean {
    return this.intervalId !== null;
  }
}

