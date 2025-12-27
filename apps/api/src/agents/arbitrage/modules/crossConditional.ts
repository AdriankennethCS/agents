import { ArbMarketSnapshot, ArbOpportunity, ArbRiskPolicy, FeeModel } from '../types';
import { ArbModule } from './types';

export class CrossConditionalArbModule implements ArbModule {
  name = 'cross-conditional';
  detect(marketGroups: ArbMarketSnapshot[][], policy: ArbRiskPolicy, feeModel: FeeModel): ArbOpportunity[] {
    return []; // Placeholder for v1
  }
}

