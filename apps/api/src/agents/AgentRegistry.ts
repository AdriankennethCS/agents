import {
  IAgentStrategy,
  FlatValueAgentConfig,
  FractionalKellyAgentConfig,
  RandomBaselineAgentConfig,
  MarketMakerAgentConfig,
  NicheLLMModelAgentConfig,
} from './types';
import { FlatValueAgent } from './FlatValueAgent';
import { FractionalKellyAgent } from './FractionalKellyAgent';
import { RandomBaselineAgent } from './RandomBaselineAgent';
import { MarketMakerRewardsAgent } from './mm/MarketMakerRewardsAgent';
import { NicheLLMModelAgent } from './model/NicheLLMModelAgent';
import { StubProbabilityModel } from './model/models/StubProbabilityModel';
import { DefaultFeatureProvider } from './model/features/FeatureProvider';

/**
 * Supported strategy types
 */
export type StrategyType = 
  | 'flatValue' 
  | 'fractionalKelly' 
  | 'randomBaseline' 
  | 'marketMakerRewards'
  | 'nicheLLMModel';

/**
 * Union type of all strategy configs
 */
export type StrategyConfig =
  | FlatValueAgentConfig
  | FractionalKellyAgentConfig
  | RandomBaselineAgentConfig
  | MarketMakerAgentConfig
  | NicheLLMModelAgentConfig;

/**
 * Registry for creating agent strategies
 */
export class AgentRegistry {
  private static instances: Map<string, IAgentStrategy> = new Map();

  /**
   * Create or get a strategy instance from type and config
   * @param agentId Unique identifier for the agent
   * @param strategyType Type of strategy to create
   * @param config Strategy configuration
   * @returns Strategy instance
   */
  static getOrCreateStrategy(
    agentId: string,
    strategyType: StrategyType,
    config: StrategyConfig
  ): IAgentStrategy {
    const cacheKey = `${agentId}:${strategyType}`;
    if (this.instances.has(cacheKey)) {
      return this.instances.get(cacheKey)!;
    }

    let strategy: IAgentStrategy;
    switch (strategyType) {
      case 'flatValue':
        strategy = new FlatValueAgent(config as FlatValueAgentConfig);
        break;
      case 'fractionalKelly':
        strategy = new FractionalKellyAgent(config as FractionalKellyAgentConfig);
        break;
      case 'randomBaseline':
        strategy = new RandomBaselineAgent(config as RandomBaselineAgentConfig);
        break;
      case 'marketMakerRewards':
        strategy = new MarketMakerRewardsAgent(config as MarketMakerAgentConfig);
        break;
      case 'nicheLLMModel':
        strategy = new NicheLLMModelAgent(
          config as NicheLLMModelAgentConfig,
          new StubProbabilityModel(), // Default to stub for v1
          new DefaultFeatureProvider()
        );
        break;
      default:
        throw new Error(`Unknown strategy type: ${strategyType}`);
    }

    this.instances.set(cacheKey, strategy);
    return strategy;
  }

  /**
   * For backward compatibility - creates a new instance every time
   */
  static createStrategy(
    strategyType: StrategyType,
    config: StrategyConfig
  ): IAgentStrategy {
    return this.getOrCreateStrategy('temp-' + Math.random(), strategyType, config);
  }

  /**
   * Get an existing strategy instance if it exists
   */
  static getInstance(agentId: string): IAgentStrategy | undefined {
    // Try all strategy types for this agentId
    for (const [key, instance] of this.instances.entries()) {
      if (key.startsWith(`${agentId}:`)) {
        return instance;
      }
    }
    return undefined;
  }
}

