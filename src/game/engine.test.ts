import { describe, expect, it } from 'vitest';
import {
  applyMove,
  countTiles,
  createGame,
  finalBonus,
  forfeitPlayer,
  isLegal,
  legalMoves,
  rankPlayers,
  scorePlacement,
} from './engine';
import { seededRng } from './rng';
import { standardRules } from './rules/standard';
import { COLORS, type Color, type GameState, type Move, type PlayerInfo } from './types';

const players = (n: number): PlayerInfo[] =>
  Array.from({ length: n }, (_, i) => ({ uid: `u${i}`, name: `P${i + 1}` }));

const sum = (r: Record<Color, number>) => COLORS.reduce((s, c) => s + r[c], 0);
const emptyWall = () => Array.from({ length: 5 }, () => Array<boolean>(5).fill(false));

/** 테스트용: 공장/중앙을 원하는 대로 세팅(타일 보존을 위해 주머니에서 차감/반환) */
function setTable(state: GameState, factories: Color[][], center: Color[] = []) {
  for (const f of state.factories) for (const t of f) state.bag[t]++;
  for (const t of state.center) state.bag[t]++;
  state.factories = factories.map((f) => [...f]);
  state.center = [...center];
  for (const f of factories) for (const t of f) state.bag[t]--;
  for (const t of center) state.bag[t]--;
}

describe('1. 게임 준비', () => {
  it.each([
    [2, 5],
    [3, 7],
    [4, 9],
  ])('%i인 → 공장 %i개, 공장마다 4개, 주머니 감소량 일치', (n, f) => {
    const s = createGame(players(n), seededRng(1));
    expect(s.factories).toHaveLength(f);
    for (const fac of s.factories) expect(fac).toHaveLength(4);
    expect(sum(s.bag)).toBe(100 - f * 4);
    expect(s.firstMarkerInCenter).toBe(true);
    expect(countTiles(s)).toBe(100);
  });
});

describe('2~3. 가져오기', () => {
  it('공장에서 가져오면 나머지가 중앙으로 간다', () => {
    const s = createGame(players(2), seededRng(2));
    setTable(s, [['red', 'red', 'blue', 'yellow'], ['black', 'black', 'black', 'black']]);
    const n = applyMove(s, { source: { kind: 'factory', index: 0 }, color: 'red', target: { kind: 'line', index: 1 } }, seededRng(0));
    expect(n.factories[0]).toEqual([]);
    expect([...n.center].sort()).toEqual(['blue', 'yellow']);
    const me = n.players[s.currentPlayer];
    expect(me.patternLines[1]).toEqual({ color: 'red', count: 2 });
    expect(countTiles(n)).toBe(100);
  });

  it('중앙에서 처음 가져가면 선 마커가 바닥으로, 두 번째부터는 아니다', () => {
    let s = createGame(players(2), seededRng(3));
    setTable(s, [['black', 'black', 'black', 'black']], ['red', 'red', 'blue', 'blue']);
    const first = s.currentPlayer;
    s = applyMove(s, { source: { kind: 'center' }, color: 'red', target: { kind: 'line', index: 1 } }, seededRng(0));
    expect(s.players[first].floor).toEqual(['FIRST']);
    expect(s.firstMarkerInCenter).toBe(false);
    expect(s.nextStartPlayer).toBe(first);
    const second = s.currentPlayer;
    s = applyMove(s, { source: { kind: 'center' }, color: 'blue', target: { kind: 'line', index: 1 } }, seededRng(0));
    expect(s.players[second].floor).toEqual([]);
  });
});

describe('4. 불법 수', () => {
  it('패턴 줄에 다른 색이 있으면 불법', () => {
    const s = createGame(players(2), seededRng(4));
    setTable(s, [['red', 'red', 'red', 'red']]);
    s.players[s.currentPlayer].patternLines[2] = { color: 'blue', count: 1 };
    s.bag.blue--;
    const m: Move = { source: { kind: 'factory', index: 0 }, color: 'red', target: { kind: 'line', index: 2 } };
    expect(isLegal(s, m)).toBe(false);
    expect(() => applyMove(s, m, seededRng(0))).toThrow();
  });

  it('벽 행에 같은 색이 이미 있으면 불법', () => {
    const s = createGame(players(2), seededRng(5));
    setTable(s, [['red', 'red', 'red', 'red']]);
    const col = standardRules.wallColumn(3, 'red');
    s.players[s.currentPlayer].wall[3][col] = true;
    s.bag.red--;
    expect(isLegal(s, { source: { kind: 'factory', index: 0 }, color: 'red', target: { kind: 'line', index: 3 } })).toBe(false);
    expect(isLegal(s, { source: { kind: 'factory', index: 0 }, color: 'red', target: { kind: 'line', index: 2 } })).toBe(true);
    expect(isLegal(s, { source: { kind: 'factory', index: 0 }, color: 'red', target: { kind: 'floor' } })).toBe(true);
  });

  it('없는 색이나 다른 사람 차례에는 합법 수가 없다', () => {
    const s = createGame(players(2), seededRng(6));
    setTable(s, [['red', 'red', 'red', 'red']]);
    expect(isLegal(s, { source: { kind: 'factory', index: 0 }, color: 'blue', target: { kind: 'floor' } })).toBe(false);
    expect(legalMoves(s, (s.currentPlayer + 1) % 2)).toEqual([]);
  });
});

describe('5. 넘침', () => {
  it('넘치는 타일은 바닥으로, 바닥 7칸 초과분은 버림통으로', () => {
    const s = createGame(players(2), seededRng(7));
    setTable(s, [['red', 'red', 'red', 'red'], ['blue']]);
    const me = s.players[s.currentPlayer];
    me.floor = ['black', 'black', 'black', 'black', 'black'];
    s.bag.black -= 5;
    const n = applyMove(s, { source: { kind: 'factory', index: 0 }, color: 'red', target: { kind: 'line', index: 0 } }, seededRng(0));
    const nb = n.players[s.currentPlayer];
    expect(nb.patternLines[0]).toEqual({ color: 'red', count: 1 });
    expect(nb.floor).toHaveLength(7);
    expect(nb.floor.filter((x) => x === 'red')).toHaveLength(2);
    expect(n.lid.red).toBe(1);
    expect(countTiles(n)).toBe(100);
  });
});

describe('6. 점수 계산', () => {
  it('이웃 없음 → 1점', () => {
    const w = emptyWall();
    w[2][2] = true;
    expect(scorePlacement(w, 2, 2)).toBe(1);
  });
  it('가로 3칸 연결 → 3점', () => {
    const w = emptyWall();
    w[0][0] = w[0][1] = w[0][2] = true;
    expect(scorePlacement(w, 0, 2)).toBe(3);
    expect(scorePlacement(w, 0, 1)).toBe(3);
  });
  it('가로 3칸 + 세로 2칸 → 5점', () => {
    const w = emptyWall();
    w[1][0] = w[1][1] = w[1][2] = true;
    w[0][1] = true;
    expect(scorePlacement(w, 1, 1)).toBe(5);
  });
  it('위에서 아래 순서로 처리되어 1번 줄 타일이 2번 줄 점수에 포함된다', () => {
    let s = createGame(players(2), seededRng(8));
    const p = s.currentPlayer;
    // 1번 줄: 파랑(벽 0,0), 2번 줄: 하늘(벽 1,0) 완성 직전
    s.players[p].patternLines[1] = { color: 'white', count: 2 };
    s.bag.white -= 2;
    setTable(s, [['blue']]);
    s = applyMove(s, { source: { kind: 'factory', index: 0 }, color: 'blue', target: { kind: 'line', index: 0 } }, seededRng(0));
    const b = s.players[p];
    expect(b.wall[0][0]).toBe(true);
    expect(b.wall[1][0]).toBe(true);
    expect(s.lastRound!.placements.filter((x) => x.player === p).map((x) => x.points)).toEqual([1, 2]);
    expect(b.score).toBe(3);
    expect(countTiles(s)).toBe(100);
  });
});

describe('7. 바닥 감점', () => {
  function endRoundWithFloor(n: number, startScore: number) {
    let s = createGame(players(2), seededRng(9));
    const p = s.currentPlayer;
    const floor = Array<Color>(n - 1).fill('black');
    s.players[p].floor = floor;
    s.players[p].score = startScore;
    s.bag.black -= n - 1;
    setTable(s, [['red']]);
    s = applyMove(s, { source: { kind: 'factory', index: 0 }, color: 'red', target: { kind: 'floor' } }, seededRng(0));
    return s.players[p].score;
  }
  it('3칸 → -4', () => expect(endRoundWithFloor(3, 10)).toBe(6));
  it('7칸 → -14', () => expect(endRoundWithFloor(7, 20)).toBe(6));
  it('0 미만이 되지 않는다', () => expect(endRoundWithFloor(7, 3)).toBe(0));
});

describe('8. 주머니 보충과 보존', () => {
  it('주머니가 비면 버림통에서 보충한다', () => {
    let s = createGame(players(2), seededRng(10));
    setTable(s, [['blue']]);
    // 주머니를 빨강 3개만 남기고 나머지는 버림통으로
    for (const c of COLORS) {
      s.lid[c] += s.bag[c];
      s.bag[c] = 0;
    }
    s.bag.red = 3;
    s.lid.red -= 3;
    expect(countTiles(s)).toBe(100);
    s = applyMove(s, { source: { kind: 'factory', index: 0 }, color: 'blue', target: { kind: 'line', index: 0 } }, seededRng(11));
    expect(s.round).toBe(2);
    expect(s.factories.flat()).toHaveLength(20);
    expect(countTiles(s)).toBe(100);
  });
});

describe('9. 종료와 보너스', () => {
  it('가로 줄 완성 시 그 라운드 후 종료, 보너스 정확', () => {
    let s = createGame(players(2), seededRng(12));
    const p = s.currentPlayer;
    const b = s.players[p];
    // 0행: 4칸 채움(마지막 하늘 칸 비움), 4열 전부 + 하늘색 5개 완성되도록 구성
    // 하늘(white)의 열: 행 r → (4 + r) % 5
    b.wall = emptyWall();
    for (let c = 0; c < 4; c++) b.wall[0][c] = true; // 0행 0~3
    for (let r = 1; r < 5; r++) b.wall[r][(4 + r) % 5] = true; // 하늘 1~4행
    for (let r = 1; r < 5; r++) b.wall[r][4] = true; // 4열 1~4행 (일부 중복)
    let onWall = 0;
    for (const row of b.wall) for (const x of row) if (x) onWall++;
    // 보존: 벽에 올린 만큼 주머니에서 차감
    let remove = onWall;
    for (const c of COLORS) {
      const k = Math.min(remove, s.bag[c]);
      s.bag[c] -= k;
      remove -= k;
    }
    b.patternLines[0] = { color: null, count: 0 };
    setTable(s, [['white']]);
    s = applyMove(s, { source: { kind: 'factory', index: 0 }, color: 'white', target: { kind: 'line', index: 0 } }, seededRng(0));
    expect(s.phase).toBe('finished');
    expect(s.result!.endedBy).toBe('wall');
    const bonus = finalBonus(s.players[p]);
    expect(bonus.rows).toBe(1);
    expect(bonus.cols).toBe(1);
    expect(bonus.colors).toBe(1);
    expect(bonus.total).toBe(2 + 7 + 10);
    const r = s.result!.ranking.find((x) => x.player === p)!;
    expect(r.rowsBonus).toBe(2);
    expect(r.colsBonus).toBe(7);
    expect(r.colorsBonus).toBe(10);
    expect(r.score).toBe(r.placementPoints - r.floorPenalty + 19);
    expect(s.result!.winners).toEqual([p]);
    expect(countTiles(s)).toBe(100);
  });
});

describe('10. 동점 처리', () => {
  it('점수 같으면 가로 줄 많은 쪽이 이김', () => {
    const r = rankPlayers([
      { player: 0, score: 50, rowsCompleted: 1 },
      { player: 1, score: 50, rowsCompleted: 2 },
      { player: 2, score: 40, rowsCompleted: 3 },
    ]);
    expect(r[0]).toEqual({ player: 1, rank: 1 });
    expect(r[1]).toEqual({ player: 0, rank: 2 });
    expect(r[2]).toEqual({ player: 2, rank: 3 });
  });
  it('그래도 같으면 공동 순위', () => {
    const r = rankPlayers([
      { player: 0, score: 50, rowsCompleted: 1 },
      { player: 1, score: 50, rowsCompleted: 1 },
      { player: 2, score: 30, rowsCompleted: 1 },
    ]);
    expect(r.map((x) => x.rank)).toEqual([1, 1, 3]);
  });
});

describe('11. 무작위 시뮬레이션', () => {
  it('무작위 AI 4명 1,000판: 예외 없음, 타일 총수 보존', () => {
    for (let g = 0; g < 1000; g++) {
      const rng = seededRng(1000 + g);
      let s = createGame(players(4), rng);
      let guard = 0;
      while (s.phase === 'offer') {
        const moves = legalMoves(s);
        expect(moves.length).toBeGreaterThan(0);
        const m = moves[Math.floor(rng() * moves.length)];
        s = applyMove(s, m, rng);
        if (countTiles(s) !== 100) throw new Error(`게임 ${g}: 타일 수 ${countTiles(s)}`);
        if (++guard > 5000) throw new Error('무한 루프');
      }
      expect(s.result).toBeDefined();
      for (const p of s.players) expect(p.score).toBeGreaterThanOrEqual(0);
    }
  }, 60000);
});

describe('12. 포기', () => {
  it('차례인 사람이 포기하면 다음 사람 차례, 이후 그 사람은 건너뛴다', () => {
    let s = createGame(players(3), seededRng(20));
    const quitter = s.currentPlayer;
    s = forfeitPlayer(s, quitter);
    expect(s.phase).toBe('offer');
    expect(s.currentPlayer).toBe((quitter + 1) % 3);
    for (let i = 0; i < 6 && s.phase === 'offer'; i++) {
      s = applyMove(s, legalMoves(s)[0], seededRng(i));
      expect(s.currentPlayer).not.toBe(quitter);
    }
  });

  it('2인 게임에서 한 명이 포기하면 즉시 종료, 남은 사람이 승리', () => {
    let s = createGame(players(2), seededRng(21));
    s.players[0].score = 30; // 점수가 높아도 포기하면 꼴찌
    s = forfeitPlayer(s, 0);
    expect(s.phase).toBe('finished');
    expect(s.result!.winners).toEqual([1]);
    expect(s.result!.endedBy).toBe('forfeit');
    expect(s.result!.ranking[1]).toMatchObject({ player: 0, rank: 2, forfeited: true });
  });

  it('포기한 사람은 이미 포기했으면 다시 포기할 수 없다', () => {
    const s = forfeitPlayer(createGame(players(3), seededRng(22)), 1);
    expect(() => forfeitPlayer(s, 1)).toThrow();
  });

  it('무작위 포기가 섞인 4인 300판: 예외 없음, 타일 보존, 포기자는 승자가 아님', () => {
    for (let g = 0; g < 300; g++) {
      const rng = seededRng(5000 + g);
      let s = createGame(players(4), rng);
      let guard = 0;
      while (s.phase === 'offer') {
        if (rng() < 0.01) {
          const cand = s.players.map((p, i) => (p.forfeited ? -1 : i)).filter((i) => i >= 0);
          s = forfeitPlayer(s, cand[Math.floor(rng() * cand.length)]);
          continue;
        }
        const moves = legalMoves(s);
        expect(s.players[s.currentPlayer].forfeited).toBeFalsy();
        s = applyMove(s, moves[Math.floor(rng() * moves.length)], rng);
        if (countTiles(s) !== 100) throw new Error(`게임 ${g}: 타일 수 ${countTiles(s)}`);
        if (++guard > 5000) throw new Error('무한 루프');
      }
      for (const w of s.result!.winners) expect(s.players[w].forfeited).toBeFalsy();
    }
  }, 60000);
});
