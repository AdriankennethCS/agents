import { MarketSnapshot } from '@domain';
import { ModelPrediction, FeatureVector } from '../types';

/**
 * Interface for probability models that predict outcome likelihood
 */
export interface IProbabilityModel {
  /**
   * Predict the probability of a market outcome
   * @param market The market snapshot to predict for
   * @param features Feature vector provided by FeatureProvider
   * @returns Prediction with probability, confidence and version
   */
  predict(market: MarketSnapshot, features: FeatureVector): Promise<ModelPrediction>;
  
  /**
   * Get the version string for the model
   */
  getVersion(): string;
}

