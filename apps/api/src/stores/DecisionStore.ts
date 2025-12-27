import { DecisionTrace } from '../agents/arbitrage/types';

export interface PaginationOptions {
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export class DecisionStore {
  private static instance: DecisionStore;
  private decisions: Map<string, DecisionTrace[]> = new Map();

  private constructor() {}

  static getInstance(): DecisionStore {
    if (!DecisionStore.instance) {
      DecisionStore.instance = new DecisionStore();
    }
    return DecisionStore.instance;
  }

  addDecision(trace: DecisionTrace): void {
    const agentDecisions = this.decisions.get(trace.agentId) || [];
    agentDecisions.push(trace);
    // Keep sorted by timestamp desc
    agentDecisions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    this.decisions.set(trace.agentId, agentDecisions);
  }

  queryDecisions(
    agentId: string,
    from?: string,
    to?: string,
    pagination: PaginationOptions = { limit: 50, offset: 0 }
  ): PaginatedResult<DecisionTrace> {
    let agentDecisions = this.decisions.get(agentId) || [];

    if (from || to) {
      agentDecisions = agentDecisions.filter((trace) => {
        const time = new Date(trace.timestamp).getTime();
        const fromTime = from ? new Date(from).getTime() : -Infinity;
        const toTime = to ? new Date(to).getTime() : Infinity;
        return time >= fromTime && time <= toTime;
      });
    }

    const total = agentDecisions.length;
    const items = agentDecisions.slice(pagination.offset, pagination.offset + pagination.limit);

    return {
      items,
      total,
      offset: pagination.offset,
      limit: pagination.limit,
      hasMore: pagination.offset + pagination.limit < total,
    };
  }

  getDecision(agentId: string, timestamp: string): DecisionTrace | undefined {
    const agentDecisions = this.decisions.get(agentId) || [];
    return agentDecisions.find(d => d.timestamp === timestamp);
  }
}

