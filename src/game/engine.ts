import { getRules, standardRules, type RuleSet } from './rules';
import {
  COLORS,
  type Color,
  type FinalResult,
  type GameState,
  type Move,
  type PlayerBoard,
  type PlayerInfo,
  type PlayerResult,
  type Rng,
  type RoundSummary,
} from './types';

export const COLOR_NAMES: Record<Color, string> = {
  blue: '파랑',
  red: '빨강',
  yellow: '노랑',
  black: '검정',
  white: '하늘',
};

const LOG_LIMIT = 50;
const FLOOR_SIZE = 7;

function emptyCounts(): Record<Color, number> {
  return { blue: 0, red: 0, yellow: 0, black: 0, white: 0 };
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function rulesOf(state: GameState): RuleSet {
  return getRules(state.rulesId);
}

function newBoard(p: PlayerInfo, size: number): PlayerBoard {
  return {
    uid: p.uid,
    name: p.name,
    patternLines: Array.from({ length: size }, () => ({ color: null, count: 0 })),
    wall: Array.from({ length: size }, () => Array<boolean>(size).fill(false)),
    floor: [],
    score: 0,
    placementPoints: 0,
    floorPenalty: 0,
  };
}

function pushLog(state: GameState, text: string) {
  state.log.push({ round: state.round, text });
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
}

/** 주머니에서 가중 무작위로 1개 뽑기. 비면 버림통을 주머니로 옮김. 둘 다 비면 null */
function drawTile(state: GameState, rng: Rng): Color | null {
  let total = COLORS.reduce((s, c) => s + state.bag[c], 0);
  if (total === 0) {
    for (const c of COLORS) {
      state.bag[c] += state.lid[c];
      state.lid[c] = 0;
    }
    total = COLORS.reduce((s, c) => s + state.bag[c], 0);
    if (total === 0) return null;
  }
  let r = Math.floor(rng() * total);
  for (const c of COLORS) {
    if (r < state.bag[c]) {
      state.bag[c]--;
      return c;
    }
    r -= state.bag[c];
  }
  // 부동소수 오차 대비
  const c = COLORS.find((x) => state.bag[x] > 0)!;
  state.bag[c]--;
  return c;
}

function setupRound(state: GameState, rng: Rng) {
  const rules = rulesOf(state);
  const n = rules.factoryCount(state.players.length);
  state.factories = [];
  for (let f = 0; f < n; f++) {
    const tiles: Color[] = [];
    for (let i = 0; i < rules.tilesPerFactory; i++) {
      const t = drawTile(state, rng);
      if (t === null) break;
      tiles.push(t);
    }
    state.factories.push(tiles);
  }
  state.center = [];
  state.firstMarkerInCenter = true;
  if (state.nextStartPlayer !== null) state.currentPlayer = activeFrom(state, state.nextStartPlayer);
  state.nextStartPlayer = null;
}

export function createGame(players: PlayerInfo[], rng: Rng, rules: RuleSet = standardRules): GameState {
  if (players.length < 2 || players.length > 4) throw new Error('플레이어는 2~4명이어야 합니다.');
  const bag = emptyCounts();
  for (const c of COLORS) bag[c] = rules.tilesPerColor;
  const state: GameState = {
    rulesId: rules.id,
    phase: 'offer',
    round: 1,
    bag,
    lid: emptyCounts(),
    factories: [],
    center: [],
    firstMarkerInCenter: true,
    players: players.map((p) => newBoard(p, rules.wallSize)),
    currentPlayer: Math.floor(rng() * players.length),
    nextStartPlayer: null,
    log: [],
  };
  setupRound(state, rng);
  pushLog(state, `게임 시작 — ${state.players[state.currentPlayer].name} 님이 먼저 합니다.`);
  return state;
}

/** 패턴 줄 index에 color를 놓을 수 있는가 */
export function canPlaceOnLine(state: GameState, playerIndex: number, line: number, color: Color): boolean {
  const rules = rulesOf(state);
  const board = state.players[playerIndex];
  const pl = board.patternLines[line];
  if (!pl) return false;
  if (pl.count >= line + 1) return false;
  if (pl.color !== null && pl.color !== color) return false;
  if (board.wall[line][rules.wallColumn(line, color)]) return false;
  return true;
}

function sourceTiles(state: GameState, move: Move): Color[] | null {
  if (move.source.kind === 'center') return state.center;
  return state.factories[move.source.index] ?? null;
}

export function isLegal(state: GameState, move: Move): boolean {
  if (state.phase !== 'offer') return false;
  if (state.players[state.currentPlayer].forfeited) return false;
  const tiles = sourceTiles(state, move);
  if (!tiles || !tiles.includes(move.color)) return false;
  if (move.target.kind === 'floor') return true;
  return canPlaceOnLine(state, state.currentPlayer, move.target.index, move.color);
}

export function legalMoves(state: GameState, playerIndex: number = state.currentPlayer): Move[] {
  if (state.phase !== 'offer' || playerIndex !== state.currentPlayer) return [];
  const moves: Move[] = [];
  const sources: { src: Move['source']; tiles: Color[] }[] = [
    ...state.factories.map((tiles, index) => ({ src: { kind: 'factory' as const, index }, tiles })),
    { src: { kind: 'center' }, tiles: state.center },
  ];
  for (const { src, tiles } of sources) {
    for (const color of COLORS) {
      if (!tiles.includes(color)) continue;
      for (let line = 0; line < state.players[playerIndex].patternLines.length; line++) {
        if (canPlaceOnLine(state, playerIndex, line, color)) {
          moves.push({ source: src, color, target: { kind: 'line', index: line } });
        }
      }
      moves.push({ source: src, color, target: { kind: 'floor' } });
    }
  }
  return moves;
}

/** 가져갈 타일 수와 줄/바닥/버림통 분배 미리보기 */
export function previewMove(state: GameState, move: Move) {
  const rules = rulesOf(state);
  const tiles = sourceTiles(state, move) ?? [];
  const taken = tiles.filter((t) => t === move.color).length;
  const board = state.players[state.currentPlayer];
  const takesMarker = move.source.kind === 'center' && state.firstMarkerInCenter;
  let toLine = 0;
  if (move.target.kind === 'line') {
    const pl = board.patternLines[move.target.index];
    toLine = Math.min(taken, move.target.index + 1 - pl.count);
  }
  const floorFree = FLOOR_SIZE - board.floor.length;
  const floorIncoming = (takesMarker ? 1 : 0) + (taken - toLine);
  const toFloor = Math.min(floorFree, floorIncoming);
  const toLid = floorIncoming - toFloor;
  const before = floorPenaltyFor(board.floor.length, rules);
  const after = floorPenaltyFor(board.floor.length + toFloor, rules);
  return { taken, toLine, toFloor, toLid, takesMarker, extraPenalty: after - before };
}

export function floorPenaltyFor(count: number, rules: RuleSet = standardRules): number {
  let sum = 0;
  for (let i = 0; i < Math.min(count, rules.floorPenalties.length); i++) sum += rules.floorPenalties[i];
  return sum;
}

/** 벽의 (row, col)에 새 타일이 놓였다고 보고 점수 계산(wall에 이미 true로 표시되어 있어야 함) */
export function scorePlacement(wall: boolean[][], row: number, col: number): number {
  const size = wall.length;
  let h = 1;
  for (let c = col - 1; c >= 0 && wall[row][c]; c--) h++;
  for (let c = col + 1; c < size && wall[row][c]; c++) h++;
  let v = 1;
  for (let r = row - 1; r >= 0 && wall[r][col]; r--) v++;
  for (let r = row + 1; r < size && wall[r][col]; r++) v++;
  if (h === 1 && v === 1) return 1;
  return (h > 1 ? h : 0) + (v > 1 ? v : 0);
}

export function finalBonus(board: PlayerBoard, rules: RuleSet = standardRules) {
  const size = board.wall.length;
  let rows = 0;
  let cols = 0;
  let colors = 0;
  for (let r = 0; r < size; r++) if (board.wall[r].every(Boolean)) rows++;
  for (let c = 0; c < size; c++) if (board.wall.every((row) => row[c])) cols++;
  for (const color of COLORS) {
    let all = true;
    for (let r = 0; r < size; r++) if (!board.wall[r][rules.wallColumn(r, color)]) all = false;
    if (all) colors++;
  }
  return {
    rows,
    cols,
    colors,
    total: rows * rules.rowBonus + cols * rules.colBonus + colors * rules.colorBonus,
  };
}

function describeMove(state: GameState, move: Move, taken: number): string {
  const name = state.players[state.currentPlayer].name;
  const src = move.source.kind === 'center' ? '중앙' : `공장${move.source.index + 1}`;
  const dst = move.target.kind === 'floor' ? '바닥 줄' : `${move.target.index + 1}번 줄`;
  return `${name}: ${src}에서 ${COLOR_NAMES[move.color]} ${taken}개 → ${dst}`;
}

export function applyMove(prev: GameState, move: Move, rng: Rng): GameState {
  if (!isLegal(prev, move)) throw new Error('규칙에 맞지 않는 수입니다.');
  const state = clone(prev);
  const board = state.players[state.currentPlayer];

  // 1) 타일 가져오기
  let taken = 0;
  if (move.source.kind === 'factory') {
    const tiles = state.factories[move.source.index];
    for (const t of tiles) {
      if (t === move.color) taken++;
      else state.center.push(t);
    }
    state.factories[move.source.index] = [];
  } else {
    taken = state.center.filter((t) => t === move.color).length;
    state.center = state.center.filter((t) => t !== move.color);
    if (state.firstMarkerInCenter) {
      state.firstMarkerInCenter = false;
      state.nextStartPlayer = state.currentPlayer;
      if (board.floor.length < FLOOR_SIZE) board.floor.push('FIRST');
    }
  }

  // 2) 놓기
  let overflow = taken;
  if (move.target.kind === 'line') {
    const pl = board.patternLines[move.target.index];
    const room = move.target.index + 1 - pl.count;
    const put = Math.min(room, taken);
    pl.color = move.color;
    pl.count += put;
    overflow = taken - put;
  }
  for (let i = 0; i < overflow; i++) {
    if (board.floor.length < FLOOR_SIZE) board.floor.push(move.color);
    else state.lid[move.color]++;
  }

  pushLog(state, describeMove(state, move, taken));

  // 3) 라운드 종료 판정
  const offerDone = state.factories.every((f) => f.length === 0) && state.center.length === 0;
  if (!offerDone) {
    state.currentPlayer = activeFrom(state, state.currentPlayer + 1);
    return state;
  }

  wallTiling(state);

  const ended = state.players.some((p) => p.wall.some((row) => row.every(Boolean)));
  if (ended) {
    finishGame(state, 'wall');
    return state;
  }

  state.round++;
  setupRound(state, rng);
  if (state.factories.every((f) => f.length === 0)) {
    // 모든 타일이 벽/패턴 줄에 있어 더 진행할 수 없는 극단적인 경우
    pushLog(state, '남은 타일이 없어 게임을 종료합니다.');
    finishGame(state, 'noTiles');
    return state;
  }
  pushLog(state, `라운드 ${state.round} 시작 — ${state.players[state.currentPlayer].name} 님 차례`);
  return state;
}

function wallTiling(state: GameState) {
  const rules = rulesOf(state);
  const summary: RoundSummary = { round: state.round, placements: [], penalties: [] };
  state.players.forEach((board, pi) => {
    board.patternLines.forEach((pl, row) => {
      if (pl.color === null || pl.count < row + 1) return;
      const color = pl.color;
      const col = rules.wallColumn(row, color);
      board.wall[row][col] = true;
      const pts = scorePlacement(board.wall, row, col);
      board.score += pts;
      board.placementPoints += pts;
      state.lid[color] += pl.count - 1;
      pl.color = null;
      pl.count = 0;
      summary.placements.push({ player: pi, row, col, color, points: pts });
    });
    const raw = floorPenaltyFor(board.floor.length, rules);
    const applied = Math.min(raw, board.score);
    board.score -= applied;
    board.floorPenalty += applied;
    if (board.floor.length > 0) summary.penalties.push({ player: pi, amount: applied });
    for (const item of board.floor) if (item !== 'FIRST') state.lid[item]++;
    board.floor = [];
  });
  state.lastRound = summary;
  // 선 마커를 바닥이 꽉 차 못 놓은 경우에도 nextStartPlayer는 이미 기록됨
  if (state.nextStartPlayer === null) state.nextStartPlayer = state.currentPlayer;
}

/** 순위: 포기하지 않은 사람 우선 → 점수 → 완성한 가로 줄 수. 모두 같으면 같은 순위 */
export function rankPlayers(
  entries: { player: number; score: number; rowsCompleted: number; forfeited?: boolean }[],
): { player: number; rank: number }[] {
  const f = (e: { forfeited?: boolean }) => (e.forfeited ? 1 : 0);
  const sorted = [...entries].sort(
    (a, b) => f(a) - f(b) || b.score - a.score || b.rowsCompleted - a.rowsCompleted,
  );
  const out: { player: number; rank: number }[] = [];
  sorted.forEach((e, i) => {
    const prev = sorted[i - 1];
    const same =
      prev && f(prev) === f(e) && prev.score === e.score && prev.rowsCompleted === e.rowsCompleted;
    out.push({ player: e.player, rank: same ? out[i - 1].rank : i + 1 });
  });
  return out;
}

/** i부터 시계 방향으로 포기하지 않은 첫 플레이어 */
function activeFrom(state: GameState, i: number): number {
  const n = state.players.length;
  for (let k = 0; k < n; k++) {
    const idx = (((i + k) % n) + n) % n;
    if (!state.players[idx].forfeited) return idx;
  }
  return ((i % n) + n) % n;
}

/**
 * 플레이어 포기. 포기한 사람은 이후 차례를 건너뛰고 최종 순위에서 맨 뒤가 된다.
 * 남은 사람이 1명 이하가 되면 즉시 게임이 끝난다.
 */
export function forfeitPlayer(prev: GameState, playerIndex: number): GameState {
  if (prev.phase !== 'offer') throw new Error('진행 중인 게임이 아닙니다.');
  const target = prev.players[playerIndex];
  if (!target || target.forfeited) throw new Error('이미 포기했거나 없는 플레이어입니다.');
  const state = clone(prev);
  state.players[playerIndex].forfeited = true;
  pushLog(state, `${target.name} 님이 포기했습니다.`);
  const active = state.players.filter((p) => !p.forfeited).length;
  if (active <= 1) {
    finishGame(state, 'forfeit');
    return state;
  }
  if (state.currentPlayer === playerIndex) state.currentPlayer = activeFrom(state, playerIndex + 1);
  return state;
}

function finishGame(state: GameState, endedBy: FinalResult['endedBy']) {
  const rules = rulesOf(state);
  const partial = state.players.map((board, player) => {
    const b = finalBonus(board, rules);
    board.score += b.total;
    return {
      player,
      score: board.score,
      placementPoints: board.placementPoints,
      floorPenalty: board.floorPenalty,
      rowsBonus: b.rows * rules.rowBonus,
      colsBonus: b.cols * rules.colBonus,
      colorsBonus: b.colors * rules.colorBonus,
      rowsCompleted: b.rows,
      forfeited: !!board.forfeited,
    };
  });
  const ranks = rankPlayers(partial);
  const ranking: PlayerResult[] = ranks.map(({ player, rank }) => ({ ...partial[player], rank }));
  const result: FinalResult = {
    ranking,
    winners: ranking.filter((r) => r.rank === 1).map((r) => r.player),
    endedBy,
  };
  state.result = result;
  state.phase = 'finished';
  const names = result.winners.map((w) => state.players[w].name).join(', ');
  pushLog(state, `게임 종료 — ${result.winners.length > 1 ? '공동 승리' : '승리'}: ${names}`);
}

/** 보존 검사용: 상태 안의 전체 타일 수(선 마커 제외) */
export function countTiles(state: GameState): number {
  let n = 0;
  for (const c of COLORS) n += state.bag[c] + state.lid[c];
  for (const f of state.factories) n += f.length;
  n += state.center.length;
  for (const p of state.players) {
    for (const pl of p.patternLines) n += pl.count;
    for (const row of p.wall) for (const x of row) if (x) n++;
    n += p.floor.filter((x) => x !== 'FIRST').length;
  }
  return n;
}
