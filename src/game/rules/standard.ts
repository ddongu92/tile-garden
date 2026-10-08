import type { Color } from '../types';
import type { RuleSet } from './types';

/** 벽 색 순서: 행 r, 열 c의 색 = WALL_ORDER[(c - r + 5) % 5] */
export const WALL_ORDER: Color[] = ['blue', 'red', 'yellow', 'black', 'white'];

export const FLOOR_PENALTIES = [1, 1, 2, 2, 2, 3, 3];

export const standardRules: RuleSet = {
  id: 'standard',
  name: '기본 규칙',
  tilesPerColor: 20,
  tilesPerFactory: 4,
  wallSize: 5,
  floorPenalties: FLOOR_PENALTIES,
  factoryCount: (n) => ({ 2: 5, 3: 7, 4: 9 } as Record<number, number>)[n] ?? 2 * n + 1,
  wallColor: (row, col) => WALL_ORDER[(((col - row) % 5) + 5) % 5],
  wallColumn: (row, color) => (WALL_ORDER.indexOf(color) + row) % 5,
  rowBonus: 2,
  colBonus: 7,
  colorBonus: 10,
};
