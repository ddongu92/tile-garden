import { standardRules } from './standard';
import type { RuleSet } from './types';

export const RULE_SETS: Record<string, RuleSet> = {
  [standardRules.id]: standardRules,
};

export function getRules(id: string): RuleSet {
  return RULE_SETS[id] ?? standardRules;
}

export type { RuleSet };
export { standardRules };
