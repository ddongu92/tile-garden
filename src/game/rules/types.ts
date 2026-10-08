import type { Color } from '../types';

/** 규칙 세트 — 변형 규칙은 이 인터페이스를 구현해 추가한다. */
export interface RuleSet {
  id: string;
  name: string;
  tilesPerColor: number;
  tilesPerFactory: number;
  wallSize: number;
  floorPenalties: number[];
  factoryCount(playerCount: number): number;
  wallColor(row: number, col: number): Color;
  /** 해당 행에서 color가 놓일 열 */
  wallColumn(row: number, color: Color): number;
  rowBonus: number;
  colBonus: number;
  colorBonus: number;
}
