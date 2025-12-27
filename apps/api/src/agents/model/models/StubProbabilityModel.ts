import { MarketSnapshot } from '@domain';
import { IProbabilityModel } from './IProbabilityModel';
import { ModelPrediction, FeatureVector } from '../types';

/**
 * A stub probability model for testing and baseline purposes
 */
export class StubProbabilityModel implements IProbabilityModel {
  private p: number;
  private confidence: number;
  private version: string;

  constructor(p: number = 50, confidence: number = 0.8, version: string = 'stub-1.0.0') {
    this.p = p;
    this.confidence = confidence;
    this.version = version;
  }

  async predict(market: MarketSnapshot, features: FeatureVector): Promise<ModelPrediction> {
    return {
      p: this.p,
      confidence: this.confidence,
      modelVersion: this.version,
      featuresUsed: Object.keys(features),
    };
  }

  getVersion(): string {
    return this.version;
  }
}

