import type { ReactNode } from 'react';
import type { GameState } from '../game';
import { PlayerBoardView } from './PlayerBoardView';
import s from './ui.module.css';

export function ResultView({ state, actions }: { state: GameState; actions?: ReactNode }) {
  const result = state.result;
  if (!result) return null;
  const winners = result.winners.map((w) => state.players[w].name).join(', ');
  return (
    <div className={s.result}>
      <h2 className={s.resultTitle}>
        {result.winners.length > 1 ? '공동 승리' : '승리'} · {winners}
      </h2>
      <div className={s.tableWrap}>
        <table className={s.scoreTable}>
          <thead>
            <tr>
              <th>순위</th>
              <th>이름</th>
              <th>타일</th>
              <th>바닥</th>
              <th>가로</th>
              <th>세로</th>
              <th>색</th>
              <th>합계</th>
            </tr>
          </thead>
          <tbody>
            {result.ranking.map((r) => (
              <tr key={r.player} className={r.rank === 1 ? s.winnerRow : ''}>
                <td>{r.rank}</td>
                <td>
                  {state.players[r.player].name}
                  {r.forfeited && <span className={s.tag}>포기</span>}
                </td>
                <td>{r.placementPoints}</td>
                <td>{r.floorPenalty ? `-${r.floorPenalty}` : 0}</td>
                <td>+{r.rowsBonus}</td>
                <td>+{r.colsBonus}</td>
                <td>+{r.colorsBonus}</td>
                <td>
                  <strong>{r.score}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={s.hintSmall}>가로 보너스 +2/줄 · 세로 보너스 +7/줄 · 색 보너스 +10/색 · 동점이면 완성한 가로 줄이 많은 사람이 이깁니다.</p>
      {actions && <div className={s.resultActions}>{actions}</div>}
      <div className={s.resultWalls}>
        {result.ranking.map((r) => (
          <div key={r.player} className={s.resultWall}>
            <div className={s.miniHead}>
              <span className={s.miniName}>
                {r.rank}위 {state.players[r.player].name}
              </span>
              <span className={s.miniScore}>{r.score}점</span>
            </div>
            <PlayerBoardView state={state} playerIndex={r.player} wallOnly />
          </div>
        ))}
      </div>
    </div>
  );
}
