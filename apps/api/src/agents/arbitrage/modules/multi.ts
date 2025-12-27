import { ArbMarketSnapshot, ArbOpportunity, ArbRiskPolicy, FeeModel } from '../types';
import { ArbModule } from './types';

export class MultiOutcomeArbModule implements ArbModule {
  name = 'multi-outcome';
  detect(marketGroups: ArbMarketSnapshot[][], policy: ArbRiskPolicy, feeModel: FeeModel): ArbOpportunity[] {
    return []; // Placeholder for v1
  }
}

