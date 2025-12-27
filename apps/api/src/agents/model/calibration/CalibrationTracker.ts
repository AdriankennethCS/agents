import { CalibrationSummary } from '../types';

interface PredictionRecord {
  marketId: string;
  p: number;
  confidence: number;
  timestamp: string;
  modelVersion: string;
  outcome?: boolean;
  resolvedAt?: string;
}

/**
 * Tracks and computes calibration metrics for probability models
 */
export class CalibrationTracker {
  private predictions: Map<string, PredictionRecord[]> = new Map();

  /**
   * Record a model prediction for a market
   */
  recordPrediction(
    marketId: string,
    p: number,
    confidence: number,
    timestamp: string,
    modelVersion: string
  ): void {
    const marketPredictions = this.predictions.get(marketId) || [];
    marketPredictions.push({
      marketId,
      p,
      confidence,
      timestamp,
      modelVersion,
    });
    this.predictions.set(marketId, marketPredictions);
  }

  /**
   * Record the outcome for a market to update metrics
   */
  recordOutcome(marketId: string, outcomeBoolean: boolean, resolvedAt: string): void {
    const marketPredictions = this.predictions.get(marketId);
    if (marketPredictions) {
      marketPredictions.forEach((pred) => {
        pred.outcome = outcomeBoolean;
        pred.resolvedAt = resolvedAt;
      });
    }
  }

  /**
   * Compute calibration scores (Brier, LogLoss, etc.) for a given window
   */
  computeScores(windowDays: number = 30): CalibrationSummary {
    const now = Date.now();
    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    
    const relevantPredictions: PredictionRecord[] = [];
    for (const preds of this.predictions.values()) {
      for (const pred of preds) {
        if (pred.outcome !== undefined) {
          const resolvedTime = new Date(pred.resolvedAt!).getTime();
          if (now - resolvedTime <= windowMs) {
            relevantPredictions.push(pred);
          }
        }
      }
    }

    if (relevantPredictions.length === 0) {
      return {
        periodDays: windowDays,
        totalPredictions: 0,
        brierScore: 0,
        logLoss: 0,
        reliabilityBuckets: [],
      };
    }

    // Brier Score: 1/N * sum((p - y)^2)
    const brierSum = relevantPredictions.reduce((sum, pred) => {
      const y = pred.outcome ? 1 : 0;
      return sum + Math.pow(pred.p / 100 - y, 2);
    }, 0);
    const brierScore = brierSum / relevantPredictions.length;

    // Log Loss: -1/N * sum(y*log(p) + (1-y)*log(1-p))
    const logLossSum = relevantPredictions.reduce((sum, pred) => {
      const y = pred.outcome ? 1 : 0;
      const p = Math.max(0.001, Math.min(0.999, pred.p / 100));
      return sum + (y * Math.log(p) + (1 - y) * Math.log(1 - p));
    }, 0);
    const logLoss = -logLossSum / relevantPredictions.length;

    // Reliability Buckets (10 buckets: 0-10, 10-20, ..., 90-100)
    const buckets = Array.from({ length: 10 }, (_, i) => ({
      bucket: `${i * 10}-${(i + 1) * 10}`,
      sumP: 0,
      sumY: 0,
      count: 0,
    }));

    relevantPredictions.forEach((pred) => {
      const bucketIdx = Math.min(9, Math.floor(pred.p / 10.0001));
      buckets[bucketIdx].sumP += pred.p / 100;
      buckets[bucketIdx].sumY += pred.outcome ? 1 : 0;
      buckets[bucketIdx].count++;
    });

    const reliabilityBuckets = buckets
      .filter((b) => b.count > 0)
      .map((b) => ({
        bucket: b.bucket,
        avgPredicted: b.sumP / b.count,
        actualFreq: b.sumY / b.count,
        count: b.count,
      }));

    return {
      periodDays: windowDays,
      totalPredictions: relevantPredictions.length,
      brierScore,
      logLoss,
      reliabilityBuckets,
    };
  }
}

