import { useEffect, useState } from 'react';
import type { GameState } from '../game';
import s from './ui.module.css';

const SECONDS = 6;

/** 1명 빼고 모두 포기해 끝난 게임: 승자를 알리고 잠시 뒤 첫 화면으로 돌아간다. */
export function ForfeitEndView({
  state,
  viewer,
  onExit,
}: {
  state: GameState;
  viewer: number | null;
  onExit: () => void;
}) {
  const [left, setLeft] = useState(SECONDS);
  const winner = state.result?.winners[0];
  const winnerName = winner !== undefined ? state.players[winner].name : '';
  const iWon = viewer !== null && viewer === winner;

  useEffect(() => {
    if (left <= 0) {
      onExit();
      return;
    }
    const t = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [left, onExit]);

  return (
    <div className={s.page}>
      <div className={s.card} style={{ textAlign: 'center' }}>
        <div className={s.trophy} aria-hidden="true">
          🏆
        </div>
        <h2 className={s.resultTitle} style={{ margin: '4px 0 8px' }}>
          {iWon ? '내가 승리했습니다!' : `${winnerName} 님 승리!`}
        </h2>
        <p className={s.notice}>다른 플레이어가 모두 포기해 게임이 끝났습니다.</p>
        <p className={s.notice}>{left}초 뒤 처음 화면으로 돌아갑니다.</p>
        <button type="button" className={s.btnPrimary} style={{ width: '100%' }} onClick={onExit}>
          지금 처음 화면으로
        </button>
      </div>
    </div>
  );
}
