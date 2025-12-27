import { describe, it, expect } from 'vitest';
import { CalibrationTracker } from './CalibrationTracker';

describe('CalibrationTracker', () => {
  it('should record predictions and compute brier score', () => {
    const tracker = new CalibrationTracker();
    const marketId = 'm1';
    const now = new Date().toISOString();

    tracker.recordPrediction(marketId, 70, 1.0, now, 'v1');
    tracker.recordOutcome(marketId, true, now);

    const scores = tracker.computeScores(30);
    
    // Brier = (0.7 - 1.0)^2 = 0.09
    expect(scores.totalPredictions).toBe(1);
    expect(scores.brierScore).toBeCloseTo(0.09, 5);
  });

  it('should compute log loss correctly', () => {
    const tracker = new CalibrationTracker();
    const now = new Date().toISOString();

    // Prediction 1: p=0.8, y=1 -> log(0.8) = -0.223
    tracker.recordPrediction('m1', 80, 1.0, now, 'v1');
    tracker.recordOutcome('m1', true, now);

    // Prediction 2: p=0.2, y=0 -> log(1-0.2) = log(0.8) = -0.223
    tracker.recordPrediction('m2', 20, 1.0, now, 'v1');
    tracker.recordOutcome('m2', false, now);

    const scores = tracker.computeScores(30);
    
    // LogLoss = -1/2 * (-0.223 - 0.223) = 0.223
    expect(scores.logLoss).toBeCloseTo(0.223, 3);
  });

  it('should bucket reliability correctly', () => {
    const tracker = new CalibrationTracker();
    const now = new Date().toISOString();

    // Bucket 70-80
    tracker.recordPrediction('m1', 75, 1.0, now, 'v1');
    tracker.recordOutcome('m1', true, now);
    
    // Bucket 20-30
    tracker.recordPrediction('m2', 25, 1.0, now, 'v1');
    tracker.recordOutcome('m2', false, now);

    const scores = tracker.computeScores(30);
    
    expect(scores.reliabilityBuckets).toHaveLength(2);
    
    const b25 = scores.reliabilityBuckets.find(b => b.bucket === '20-30');
    expect(b25?.avgPredicted).toBe(0.25);
    expect(b25?.actualFreq).toBe(0);

    const b75 = scores.reliabilityBuckets.find(b => b.bucket === '70-80');
    expect(b75?.avgPredicted).toBe(0.75);
    expect(b75?.actualFreq).toBe(1);
  });
});

