import { describe, it, expect } from 'vitest';
import { calculateKellyFraction, calculateStakeUsd } from './sizing';

describe('Kelly Sizing Logic', () => {
  describe('calculateKellyFraction', () => {
    it('should calculate correct Kelly fraction for YES buy', () => {
      // p = 0.6, price = 0.5
      // f* = (0.6 - 0.5) / (1 - 0.5) = 0.1 / 0.5 = 0.2
      expect(calculateKellyFraction(0.6, 0.5)).toBeCloseTo(0.2, 5);
      
      // p = 0.7, price = 0.5
      // f* = (0.7 - 0.5) / (1 - 0.5) = 0.2 / 0.5 = 0.4
      expect(calculateKellyFraction(0.7, 0.5)).toBeCloseTo(0.4, 5);
      
      // p = 0.4, price = 0.5 (negative edge)
      // f* = (0.4 - 0.5) / (1 - 0.5) = -0.1 / 0.5 = -0.2
      expect(calculateKellyFraction(0.4, 0.5)).toBeCloseTo(-0.2, 5);
    });

    it('should handle edge cases', () => {
      expect(calculateKellyFraction(0.6, 1.0)).toBe(0);
      expect(calculateKellyFraction(0.6, 0)).toBe(0);
    });
  });

  describe('calculateStakeUsd', () => {
    const bankroll = 1000;
    const kellyFraction = 0.5;
    const maxRiskPerTradePct = 2; // $20 max risk

    it('should calculate correct stake with confidence scaling', () => {
      const fStar = 0.2;
      const confidence = 0.8;
      
      // stake = 1000 * 0.5 * 0.2 * 0.8 = 80
      // capped by maxRisk (20)
      const result = calculateStakeUsd(bankroll, kellyFraction, fStar, confidence, maxRiskPerTradePct);
      expect(result.stakeUsd).toBe(20);
      expect(result.capsApplied).toContain('maxRiskPerTradePct (2%)');
    });

    it('should not exceed max risk', () => {
      const fStar = 1.0;
      const confidence = 1.0;
      
      // stake = 1000 * 0.5 * 1.0 * 1.0 = 500
      // capped by maxRisk (20)
      const result = calculateStakeUsd(bankroll, kellyFraction, fStar, confidence, maxRiskPerTradePct);
      expect(result.stakeUsd).toBe(20);
    });

    it('should return 0 for negative edge', () => {
      const fStar = -0.1;
      const confidence = 1.0;
      
      const result = calculateStakeUsd(bankroll, kellyFraction, fStar, confidence, maxRiskPerTradePct);
      expect(result.stakeUsd).toBe(0);
    });
  });
});

