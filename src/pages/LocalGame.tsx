import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { applyMove, createGame, defaultRng, type GameState, type Move } from '../game';
import { GameView } from '../ui/GameView';
import { storage } from '../ui/settings';
import s from '../ui/ui.module.css';

const KEY = 'tg.local';

function load(): GameState | null {
  try {
    const raw = storage.read(KEY, '');
    return raw ? (JSON.parse(raw) as GameState) : null;
  } catch {
    return null;
  }
}

export function LocalGame() {
  const [state, setState] = useState<GameState | null>(load);
  const [names, setNames] = useState(['', '', '', '']);
  const [count, setCount] = useState(2);

  useEffect(() => {
    storage.write(KEY, state ? JSON.stringify(state) : '');
  }, [state]);

  const start = () => {
    const ps = names.slice(0, count).map((n, i) => ({ uid: `local-${i}`, name: n.trim() || `플레이어${i + 1}` }));
    setState(createGame(ps, defaultRng));
  };

  if (!state) {
    return (
      <div className={s.page}>
        <h1 className={s.brandTitle} style={{ textAlign: 'center' }}>
          한 기기에서 하기
        </h1>
        <div className={s.card}>
          <div className={s.field}>
            <span className={s.label}>인원</span>
            <div className={s.row}>
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={n === count ? s.btnPrimary : s.btnGhost}
                  onClick={() => setCount(n)}
                >
                  {n}명
                </button>
              ))}
            </div>
          </div>
          {Array.from({ length: count }, (_, i) => (
            <label key={i} className={s.field}>
              <span className={s.label}>{i + 1}번 자리 이름</span>
              <input
                className={s.input}
                value={names[i]}
                maxLength={10}
                placeholder={`플레이어${i + 1}`}
                onChange={(e) => setNames((arr) => arr.map((v, k) => (k === i ? e.target.value : v)))}
              />
            </label>
          ))}
          <p className={s.notice}>시작 플레이어는 무작위로 정해집니다. 차례마다 기기를 다음 사람에게 넘겨 주세요.</p>
          <div className={s.stack}>
            <button type="button" className={s.btnPrimary} onClick={start}>
              게임 시작
            </button>
            <Link to="/" className={s.btnGhost} style={{ textAlign: 'center', textDecoration: 'none' }}>
              처음으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const onMove = (m: Move) => {
    setState((prev) => (prev ? applyMove(prev, m, defaultRng) : prev));
  };

  const restart = () => {
    setState(
      createGame(
        state.players.map((p) => ({ uid: p.uid, name: p.name })),
        defaultRng,
      ),
    );
  };

  return (
    <GameView
      state={state}
      viewer={state.currentPlayer}
      canAct
      hotseat
      onMove={onMove}
      topRight={
        <button
          type="button"
          className={s.iconBtn}
          onClick={() => {
            if (confirm('게임을 그만두고 처음 화면으로 갈까요?')) setState(null);
          }}
        >
          그만하기
        </button>
      }
      resultActions={
        <>
          <button type="button" className={s.btnPrimary} onClick={restart}>
            같은 멤버로 다시 하기
          </button>
          <button type="button" className={s.btnGhost} onClick={() => setState(null)}>
            새 게임 설정
          </button>
        </>
      }
    />
  );
}
