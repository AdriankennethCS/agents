import { CalibrationSummary } from '../agents/model/types';

/**
 * Store for calibration data
 */
export interface ICalibrationStore {
  recordPrediction(agentId: string, marketId: string, p: number, confidence: number, timestamp: string, modelVersion: string): void;
  recordOutcome(agentId: string, marketId: string, outcome: boolean, resolvedAt: string): void;
  getSummary(agentId: string, periodDays: number): CalibrationSummary;
}

interface PredictionEntry {
  agentId: string;
  marketId: string;
  p: number;
  confidence: number;
  timestamp: string;
  modelVersion: string;
  outcome?: boolean;
  resolvedAt?: string;
}

export class InMemoryCalibrationStore implements ICalibrationStore {
  private predictions: PredictionEntry[] = [];

  recordPrediction(agentId: string, marketId: string, p: number, confidence: number, timestamp: string, modelVersion: string): void {
    this.predictions.push({
      agentId,
      marketId,
      p,
      confidence,
      timestamp,
      modelVersion,
    });
  }

  recordOutcome(agentId: string, marketId: string, outcome: boolean, resolvedAt: string): void {
    this.predictions
      .filter(p => p.marketId === marketId)
      .forEach(p => {
        p.outcome = outcome;
        p.resolvedAt = resolvedAt;
      });
  }

  getSummary(agentId: string, periodDays: number): CalibrationSummary {
    const now = Date.now();
    const windowMs = periodDays * 24 * 60 * 60 * 1000;
    
    const relevant = this.predictions.filter(p => 
      p.agentId === agentId && 
      p.outcome !== undefined &&
      (now - new Date(p.resolvedAt!).getTime()) <= windowMs
    );

    if (relevant.length === 0) {
      return {
        periodDays,
        totalPredictions: 0,
        brierScore: 0,
        logLoss: 0,
        reliabilityBuckets: [],
      };
    }

    const brierSum = relevant.reduce((sum, p) => sum + Math.pow(p.p / 100 - (p.outcome ? 1 : 0), 2), 0);
    const brierScore = brierSum / relevant.length;

    const logLossSum = relevant.reduce((sum, p) => {
      const prob = Math.max(0.001, Math.min(0.999, p.p / 100));
      return sum + (p.outcome ? Math.log(prob) : Math.log(1 - prob));
    }, 0);
    const logLoss = -logLossSum / relevant.length;

    // Reliability buckets
    const buckets = Array.from({ length: 10 }, (_, i) => ({
      bucket: `${i * 10}-${(i + 1) * 10}`,
      sumP: 0,
      sumY: 0,
      count: 0,
    }));

    relevant.forEach(p => {
      const bucketIdx = Math.min(9, Math.floor(p.p / 10.0001));
      buckets[bucketIdx].sumP += p.p / 100;
      buckets[bucketIdx].sumY += p.outcome ? 1 : 0;
      buckets[bucketIdx].count++;
    });

    const reliabilityBuckets = buckets
      .filter(b => b.count > 0)
      .map(b => ({
        bucket: b.bucket,
        avgPredicted: b.sumP / b.count,
        actualFreq: b.sumY / b.count,
        count: b.count,
      }));

    return {
      periodDays,
      totalPredictions: relevant.length,
      brierScore,
      logLoss,
      reliabilityBuckets,
    };
  }
}

