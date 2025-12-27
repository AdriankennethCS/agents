import { ArbMarketSnapshot, ArbOpportunity, ArbRiskPolicy, FeeModel } from '../types';
import { ArbModule } from './types';

export class ThreeWayArbModule implements ArbModule {
  name = 'three-way';
  detect(marketGroups: ArbMarketSnapshot[][], policy: ArbRiskPolicy, feeModel: FeeModel): ArbOpportunity[] {
    return []; // Placeholder for v1
  }
}

