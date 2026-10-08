import type { GameState, WallPlacementEvent } from '../game';
import { canPlaceOnLine, getRules } from '../game';
import { Tile } from './Tile';
import s from './ui.module.css';

interface Props {
  state: GameState;
  playerIndex: number;
  variant?: 'full' | 'mini';
  /** 선택된 색이 있을 때 줄 강조/흐림 처리 */
  selectedColor?: import('../game').Color | null;
  pendingTarget?: { kind: 'line'; index: number } | { kind: 'floor' } | null;
  onPickLine?: (index: number) => void;
  onPickFloor?: () => void;
  /** 벽 채우기 연출 */
  highlights?: WallPlacementEvent[];
  penalty?: number | null;
  wallOnly?: boolean;
}

export function PlayerBoardView({
  state,
  playerIndex,
  variant = 'full',
  selectedColor = null,
  pendingTarget = null,
  onPickLine,
  onPickFloor,
  highlights = [],
  penalty = null,
  wallOnly = false,
}: Props) {
  const rules = getRules(state.rulesId);
  const board = state.players[playerIndex];
  const picking = selectedColor !== null && !!onPickLine;
  const isTurn = state.phase === 'offer' && state.currentPlayer === playerIndex;

  return (
    <div className={`${s.board} ${variant === 'mini' ? s.mini : ''} ${isTurn ? s.boardTurn : ''}`}>
      {variant === 'mini' && (
        <div className={s.miniHead}>
          <span className={s.miniName}>{board.name}</span>
          <span className={s.miniScore}>{board.score}점</span>
        </div>
      )}
      <div className={s.boardMain}>
        {!wallOnly && (
          <div className={s.lines}>
            {board.patternLines.map((pl, i) => {
              const legal = picking && canPlaceOnLine(state, playerIndex, i, selectedColor!);
              const chosen = pendingTarget?.kind === 'line' && pendingTarget.index === i;
              const cls = [
                s.line,
                picking && (legal ? s.lineLegal : s.lineDim),
                chosen && s.lineChosen,
              ]
                .filter(Boolean)
                .join(' ');
              const cells = Array.from({ length: i + 1 }, (_, k) => {
                // 오른쪽부터 채운다
                const filled = k >= i + 1 - pl.count;
                return filled && pl.color ? (
                  <Tile key={k} item={pl.color} />
                ) : (
                  <span key={k} className={s.slot} />
                );
              });
              return legal ? (
                <button
                  type="button"
                  key={i}
                  className={cls}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPickLine!(i);
                  }}
                  aria-label={`${i + 1}번 줄에 놓기`}
                >
                  {cells}
                </button>
              ) : (
                <div key={i} className={cls}>
                  {cells}
                </div>
              );
            })}
          </div>
        )}
        <div className={s.wall}>
          {board.wall.map((row, r) => (
            <div key={r} className={s.wallRow}>
              {row.map((filled, c) => {
                const color = rules.wallColor(r, c);
                const hl = highlights.find((h) => h.row === r && h.col === c);
                return (
                  <span key={c} className={s.wallCell}>
                    <Tile item={color} ghost={!filled} className={hl ? s.pop : undefined} />
                    {hl && <span className={s.plus}>+{hl.points}</span>}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {!wallOnly && (
        <FloorLine
          state={state}
          playerIndex={playerIndex}
          picking={picking}
          chosen={pendingTarget?.kind === 'floor'}
          onPick={onPickFloor}
          penalty={penalty}
          floorPenalties={rules.floorPenalties}
        />
      )}
    </div>
  );
}

function FloorLine({
  state,
  playerIndex,
  picking,
  chosen,
  onPick,
  penalty,
  floorPenalties,
}: {
  state: GameState;
  playerIndex: number;
  picking: boolean;
  chosen: boolean;
  onPick?: () => void;
  penalty: number | null;
  floorPenalties: number[];
}) {
  const floor = state.players[playerIndex].floor;
  const content = (
    <>
      {floorPenalties.map((p, i) => (
        <span key={i} className={s.floorCell}>
          {floor[i] ? <Tile item={floor[i]} /> : <span className={s.slot} />}
          <span className={s.floorPen}>-{p}</span>
        </span>
      ))}
      {penalty !== null && penalty > 0 && <span className={s.minus}>-{penalty}</span>}
    </>
  );
  const cls = [s.floor, picking && s.lineLegal, chosen && s.lineChosen].filter(Boolean).join(' ');
  if (picking && onPick) {
    return (
      <button
        type="button"
        className={cls}
        onClick={(e) => {
          e.stopPropagation();
          onPick();
        }}
        aria-label="바닥 줄에 놓기"
      >
        {content}
      </button>
    );
  }
  return <div className={cls}>{content}</div>;
}
