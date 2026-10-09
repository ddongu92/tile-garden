import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  COLOR_NAMES,
  previewMove,
  type Color,
  type GameState,
  type Move,
  type MoveSource,
  type MoveTarget,
  type RoundSummary,
} from '../game';
import { ForfeitEndView } from './ForfeitEndView';
import { PlayerBoardView } from './PlayerBoardView';
import { ResultView } from './ResultView';
import { useAnimationsSetting } from './settings';
import { useWidthUnit } from './useWidthUnit';
import { Tile } from './Tile';
import s from './ui.module.css';

interface Props {
  state: GameState;
  /** 이 기기에서 보는 플레이어 좌석(관전자는 null) */
  viewer: number | null;
  /** 지금 조작 가능한가(내 차례 && 전송 중 아님) */
  canAct: boolean;
  onMove: (m: Move) => Promise<void> | void;
  /** 핫시트처럼 매 차례 보는 사람이 바뀌는 경우 */
  hotseat?: boolean;
  topRight?: ReactNode;
  resultActions?: ReactNode;
  banner?: ReactNode;
  /** 포기 처리(없으면 버튼 숨김) */
  onForfeit?: () => Promise<void> | void;
  /** 포기로 게임이 끝났을 때 처음 화면으로 나가기 */
  onExit?: () => void;
}

interface Selection {
  source: MoveSource;
  color: Color;
}

const sameSource = (a: MoveSource, b: MoveSource) =>
  a.kind === b.kind && (a.kind === 'center' || (b.kind === 'factory' && a.index === b.index));

export function GameView({ state, viewer, canAct, onMove, hotseat, topRight, resultActions, banner, onForfeit, onExit }: Props) {
  const [sel, setSel] = useState<Selection | null>(null);
  const [target, setTarget] = useState<MoveTarget | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);
  const [anim, setAnim] = useState<RoundSummary | null>(null);
  const [animOn, setAnimOn] = useAnimationsSetting();
  const [showLog, setShowLog] = useState(false);
  const [sending, setSending] = useState(false);
  const seenRound = useRef<number | undefined>(state.lastRound?.round);
  const wasMyTurn = useRef(false);
  const tableRef = useWidthUnit<HTMLElement>();

  const me = viewer ?? 0;
  const myTurn = canAct && viewer === state.currentPlayer && state.phase === 'offer';

  // 상태가 바뀌어 선택이 무효가 되면 취소
  useEffect(() => {
    if (!sel) return;
    const tiles = sel.source.kind === 'center' ? state.center : state.factories[sel.source.index];
    if (!myTurn || !tiles?.includes(sel.color)) {
      setSel(null);
      setTarget(null);
    }
  }, [state, myTurn, sel]);

  // 벽 채우기 연출
  useEffect(() => {
    const lr = state.lastRound;
    if (!lr || lr.round === seenRound.current) return;
    seenRound.current = lr.round;
    if (!animOn) return;
    setAnim(lr);
    const t = setTimeout(() => setAnim(null), 2800);
    return () => clearTimeout(t);
  }, [state.lastRound, animOn]);

  // 내 차례 알림(진동)
  useEffect(() => {
    if (myTurn && !wasMyTurn.current && !hotseat) {
      try {
        navigator.vibrate?.([120, 60, 120]);
      } catch {
        /* 미지원 */
      }
    }
    wasMyTurn.current = myTurn;
  }, [myTurn, hotseat]);

  const preview = useMemo(() => {
    if (!sel || !target) return null;
    return previewMove(state, { ...sel, target });
  }, [state, sel, target]);

  const clear = () => {
    setSel(null);
    setTarget(null);
  };

  const pick = (source: MoveSource, color: Color) => {
    if (!myTurn) return;
    if (sel && sameSource(sel.source, source) && sel.color === color) {
      clear();
      return;
    }
    setSel({ source, color });
    setTarget(null);
  };

  const confirm = async () => {
    if (!sel || !target || sending) return;
    const move: Move = { ...sel, target };
    setSending(true);
    try {
      await onMove(move);
      clear();
    } finally {
      setSending(false);
    }
  };

  if (state.phase === 'finished' && state.result?.endedBy === 'forfeit' && onExit) {
    return <ForfeitEndView state={state} viewer={viewer} onExit={onExit} />;
  }

  if (state.phase === 'finished') {
    return (
      <div className={s.game}>
        <ResultView state={state} actions={resultActions} />
      </div>
    );
  }

  const current = state.players[state.currentPlayer];
  const others = state.players.map((_, i) => i).filter((i) => i !== me);
  const isSel = (source: MoveSource, color: Color) =>
    !!sel && sameSource(sel.source, source) && sel.color === color;

  const factoryCount = state.factories.length;
  const myAnim = anim?.placements.filter((p) => p.player === me) ?? [];
  const myPenalty = anim?.penalties.find((p) => p.player === me)?.amount ?? null;

  return (
    <div className={`${s.game} ${myTurn && !hotseat ? s.myTurnGlow : ''}`} onClick={clear}>
      <header className={`${s.turnBar} ${myTurn ? s.turnBarMine : ''}`}>
        <div className={s.turnInfo}>
          <div className={s.turnRound}>라운드 {state.round}</div>
          <div className={s.turnWho}>
            {myTurn && !hotseat ? '내 차례입니다!' : `${current.name} 님 차례`}
          </div>
        </div>
        <div className={s.turnTools} onClick={(e) => e.stopPropagation()}>
          <button type="button" className={s.iconBtn} onClick={() => setShowLog((v) => !v)}>
            기록·설정
          </button>
          {onForfeit && viewer !== null && !state.players[viewer].forfeited && (
            <button
              type="button"
              className={s.iconBtn}
              onClick={() => {
                const who = hotseat ? `${state.players[viewer].name} 님이 ` : '';
                if (window.confirm(`${who}포기할까요?
포기하면 이후 차례를 건너뛰고 최종 순위는 맨 뒤가 됩니다.`)) onForfeit();
              }}
            >
              포기
            </button>
          )}
          {topRight}
        </div>
      </header>

      {banner}
      {viewer !== null && state.players[viewer].forfeited && (
        <div className={s.banner}>
          포기했습니다. 남은 사람들의 게임을 관전 중이에요.
          {onExit && (
            <button type="button" className={s.linkBtn} onClick={onExit}>
              처음 화면으로
            </button>
          )}
        </div>
      )}

      <div className={s.minis} onClick={(e) => e.stopPropagation()}>
        {others.map((i) => (
          <button type="button" key={i} className={`${s.miniBtn} ${state.currentPlayer === i ? s.miniTurn : ''}`} onClick={() => setZoom(i)} aria-label={`${state.players[i].name} 보드 크게 보기`}>
            <PlayerBoardView
              state={state}
              playerIndex={i}
              variant="mini"
              highlights={anim?.placements.filter((p) => p.player === i)}
            />
          </button>
        ))}
      </div>

      <section ref={tableRef} className={s.table} data-n={factoryCount}>
        {state.factories.map((tiles, fi) => {
          const angle = (fi / factoryCount) * Math.PI * 2 - Math.PI / 2;
          const R = 38;
          return (
            <div
              key={fi}
              className={`${s.factory} ${tiles.length === 0 ? s.factoryEmpty : ''}`}
              style={{ left: `${50 + R * Math.cos(angle)}%`, top: `${50 + R * Math.sin(angle)}%` }}
              aria-label={`공장 ${fi + 1}`}
            >
              {tiles.map((c, ti) => (
                <Tile
                  key={ti}
                  item={c}
                  selected={isSel({ kind: 'factory', index: fi }, c)}
                  onClick={
                    myTurn
                      ? (e) => {
                          e.stopPropagation();
                          pick({ kind: 'factory', index: fi }, c);
                        }
                      : undefined
                  }
                />
              ))}
              <span className={s.factoryNo}>{fi + 1}</span>
            </div>
          );
        })}
        <div className={s.center} aria-label="중앙">
          {state.firstMarkerInCenter && <Tile item="FIRST" />}
          {[...state.center]
            .sort((a, b) => a.localeCompare(b))
            .map((c, ti) => (
              <Tile
                key={ti}
                item={c}
                selected={isSel({ kind: 'center' }, c)}
                onClick={
                  myTurn
                    ? (e) => {
                        e.stopPropagation();
                        pick({ kind: 'center' }, c);
                      }
                    : undefined
                }
              />
            ))}
          {state.center.length === 0 && !state.firstMarkerInCenter && <span className={s.centerLabel}>중앙</span>}
        </div>
      </section>

      <section className={s.myArea} onClick={(e) => e.stopPropagation()}>
        <div className={s.myHead}>
          <span className={s.myName}>
            {viewer === null ? `${state.players[me].name} 님 보드` : hotseat ? `${state.players[me].name} 님 보드` : '내 보드'}
          </span>
          <span className={s.myScore}>{state.players[me].score}점</span>
        </div>
        <PlayerBoardView
          state={state}
          playerIndex={me}
          selectedColor={myTurn ? sel?.color ?? null : null}
          pendingTarget={target}
          onPickLine={myTurn ? (i) => setTarget({ kind: 'line', index: i }) : undefined}
          onPickFloor={myTurn ? () => setTarget({ kind: 'floor' }) : undefined}
          highlights={myAnim}
          penalty={myPenalty}
        />
        {myTurn && !sel && <p className={s.hint}>공장이나 중앙에서 가져올 타일을 누르세요.</p>}
        {myTurn && sel && !target && (
          <p className={s.hint}>
            {COLOR_NAMES[sel.color]} 타일을 놓을 줄을 고르세요. 바닥 줄은 언제나 고를 수 있어요.
          </p>
        )}
      </section>

      {sel && target && preview && (
        <div className={s.previewBar} onClick={(e) => e.stopPropagation()}>
          <div className={s.previewText}>
            <strong>
              {COLOR_NAMES[sel.color]} {preview.taken}개
            </strong>
            {target.kind === 'line' ? ` → ${target.index + 1}번 줄 ${preview.toLine}개` : ' → 바닥 줄'}
            {preview.toFloor > 0 && `, 바닥 ${preview.toFloor}칸${preview.takesMarker ? '(선 마커 포함)' : ''}`}
            {preview.toLid > 0 && `, 버림통 ${preview.toLid}개`}
            <div className={preview.extraPenalty > 0 ? s.previewPen : s.previewOk}>
              예상 감점 {preview.extraPenalty > 0 ? `-${preview.extraPenalty}` : '없음'}
            </div>
          </div>
          <div className={s.previewBtns}>
            <button type="button" className={s.btnGhost} onClick={clear}>
              취소
            </button>
            <button type="button" className={s.btnPrimary} onClick={confirm} disabled={sending}>
              {sending ? '보내는 중…' : '확정'}
            </button>
          </div>
        </div>
      )}

      {showLog && (
        <div className={s.modal} onClick={() => setShowLog(false)}>
          <div className={s.modalBody} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHead}>
              <strong>게임 기록</strong>
              <div className={s.row} style={{ flex: 'none' }}>
                <button
                  type="button"
                  className={s.iconBtn}
                  onClick={() => setAnimOn(!animOn)}
                  title="벽 채우기 연출 켜기/끄기"
                >
                  연출 {animOn ? '켬' : '끔'}
                </button>
                <button type="button" className={s.iconBtn} onClick={() => setShowLog(false)}>
                  닫기
                </button>
              </div>
            </div>
            <ol className={s.log}>
              {[...state.log].reverse().map((l, i) => (
                <li key={i}>
                  <span className={s.logRound}>R{l.round}</span> {l.text}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {zoom !== null && (
        <div className={s.modal} onClick={() => setZoom(null)}>
          <div className={s.modalBody} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHead}>
              <strong>
                {state.players[zoom].name} 님 · {state.players[zoom].score}점
              </strong>
              <button type="button" className={s.iconBtn} onClick={() => setZoom(null)}>
                닫기
              </button>
            </div>
            <PlayerBoardView state={state} playerIndex={zoom} />
          </div>
        </div>
      )}
    </div>
  );
}
