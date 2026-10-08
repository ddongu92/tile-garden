export type Color = 'blue' | 'red' | 'yellow' | 'black' | 'white';
export type FloorItem = Color | 'FIRST';

export const COLORS: Color[] = ['blue', 'red', 'yellow', 'black', 'white'];

export interface PatternLine {
  color: Color | null;
  count: number; // capacity = index + 1
}

export interface PlayerBoard {
  uid: string;
  name: string;
  patternLines: PatternLine[]; // length 5
  wall: boolean[][]; // 5x5, 색은 규칙 세트의 wallColor로 계산
  floor: FloorItem[]; // 최대 7
  score: number;
  /** 누적 통계(결과 화면용) */
  placementPoints: number;
  floorPenalty: number;
}

export interface LogEntry {
  round: number;
  text: string;
}

export interface WallPlacementEvent {
  player: number;
  row: number;
  col: number;
  color: Color;
  points: number;
}

/** 직전 벽 채우기 단계에서 일어난 일(연출용) */
export interface RoundSummary {
  round: number;
  placements: WallPlacementEvent[];
  penalties: { player: number; amount: number }[];
}

export interface PlayerResult {
  player: number;
  rank: number;
  score: number;
  placementPoints: number;
  floorPenalty: number;
  rowsBonus: number;
  colsBonus: number;
  colorsBonus: number;
  rowsCompleted: number;
}

export interface FinalResult {
  ranking: PlayerResult[]; // 순위 순
  winners: number[]; // 플레이어 인덱스(공동 승리 가능)
}

export interface GameState {
  rulesId: string;
  phase: 'offer' | 'finished';
  round: number;
  bag: Record<Color, number>;
  lid: Record<Color, number>;
  factories: Color[][];
  center: Color[];
  firstMarkerInCenter: boolean;
  players: PlayerBoard[]; // 좌석 순서 = 진행 순서
  currentPlayer: number;
  nextStartPlayer: number | null;
  log: LogEntry[]; // 최근 50개
  lastRound?: RoundSummary;
  result?: FinalResult;
}

export type MoveSource = { kind: 'factory'; index: number } | { kind: 'center' };
export type MoveTarget = { kind: 'line'; index: number } | { kind: 'floor' };

export interface Move {
  source: MoveSource;
  color: Color;
  target: MoveTarget;
}

export type Rng = () => number; // [0, 1)

export interface PlayerInfo {
  uid: string;
  name: string;
}
