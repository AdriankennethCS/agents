import { ArbMarketSnapshot, ArbOpportunity, ArbRiskPolicy, FeeModel } from '../types';

export interface ArbModule {
  detect(marketGroups: ArbMarketSnapshot[][], policy: ArbRiskPolicy, feeModel: FeeModel): ArbOpportunity[];
}

