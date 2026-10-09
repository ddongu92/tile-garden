import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Move } from '../game';
import { ensureUser, firebaseReady } from '../online/firebase';
import {
  MAX_SEATS,
  deleteRoom,
  errorMessage,
  forfeitGame,
  isValidCode,
  joinRoom,
  kickSeat,
  leaveRoom,
  normalizeCode,
  RoomError,
  startGame,
  submitMove,
  subscribeRoom,
  type Room as RoomData,
} from '../online/rooms';
import { GameView } from '../ui/GameView';
import { useStoredState } from '../ui/settings';
import s from '../ui/ui.module.css';

type Phase =
  | { kind: 'name' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready' };

export function Room() {
  const params = useParams();
  const code = normalizeCode(params.code ?? '');
  const nav = useNavigate();
  const [name, setName] = useStoredState('tg.name', '');
  const [draftName, setDraftName] = useState(name);
  const [phase, setPhase] = useState<Phase>(name.trim() ? { kind: 'loading' } : { kind: 'name' });
  /** 닉네임이 정해지면 true — 입장·구독 effect의 시작 신호 */
  const [entering, setEntering] = useState(!!name.trim());
  const [uid, setUid] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [offline, setOffline] = useState(false);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const wasSeated = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3500);
  }, []);

  // 입장 + 실시간 구독
  useEffect(() => {
    if (!entering) return;
    if (!firebaseReady) {
      setPhase({ kind: 'error', message: '온라인 기능이 설정되지 않았습니다(.env 필요).' });
      return;
    }
    if (!isValidCode(code)) {
      setPhase({ kind: 'error', message: '올바르지 않은 방 코드입니다.' });
      return;
    }
    let unsub: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      try {
        const user = await ensureUser();
        if (cancelled) return;
        setUid(user.uid);
        await joinRoom(code, name);
        if (cancelled) return;
        unsub = subscribeRoom(
          code,
          (r, fromCache) => {
            setOffline(fromCache);
            if (!r) {
              setPhase({ kind: 'error', message: '방이 사라졌습니다. 방장이 방을 없앴을 수 있어요.' });
              return;
            }
            setRoom(r);
            setPhase({ kind: 'ready' });
          },
          (e) => showToast(errorMessage(e)),
        );
      } catch (e) {
        if (!cancelled) setPhase({ kind: 'error', message: errorMessage(e) });
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
    // name은 입장 시점 값만 쓰면 되므로 의존성에서 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entering, code, showToast]);

  // 브라우저 온라인/오프라인 감지
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const mySeat = room && uid ? room.seats.findIndex((x) => x.uid === uid) : -1;
  const isHost = !!room && room.hostUid === uid;
  if (mySeat >= 0) wasSeated.current = true;
  const kicked = !!room && room.status === 'lobby' && wasSeated.current && mySeat < 0;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      showToast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onMove = async (m: Move) => {
    try {
      await submitMove(code, m);
    } catch (e) {
      showToast(errorMessage(e));
      if (!(e instanceof RoomError)) throw e;
    }
  };

  const goHome = useCallback(() => nav('/'), [nav]);

  const shareUrl = `${location.origin}/r/${code}`;
  const copyLink = async () => {
    try {
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        await navigator.share({ title: '타일 정원 초대', text: `방 코드 ${code}`, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      showToast('초대 링크를 복사했어요.');
    } catch {
      showToast(`링크: ${shareUrl}`);
    }
  };

  const toastEl = toast ? (
    <div className={s.toast} role="status">
      {toast}
    </div>
  ) : null;

  if (phase.kind === 'name') {
    return (
      <div className={s.page}>
        <div className={s.card}>
          <h2 className={s.cardTitle}>방 {code}에 입장</h2>
          <label className={s.field}>
            <span className={s.label}>닉네임</span>
            <input
              className={s.input}
              value={draftName}
              maxLength={10}
              autoFocus
              placeholder="예: 지영"
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && draftName.trim()) {
                  setName(draftName.trim());
                  setPhase({ kind: 'loading' });
                  setEntering(true);
                }
              }}
            />
          </label>
          <button
            type="button"
            className={s.btnPrimary}
            style={{ width: '100%' }}
            disabled={!draftName.trim()}
            onClick={() => {
              setName(draftName.trim());
              setPhase({ kind: 'loading' });
              setEntering(true);
            }}
          >
            입장하기
          </button>
        </div>
      </div>
    );
  }

  if (phase.kind === 'loading' || (phase.kind === 'ready' && !room)) {
    return (
      <div className={s.page}>
        <p className={s.notice} style={{ textAlign: 'center' }}>
          방에 들어가는 중…
        </p>
      </div>
    );
  }

  if (phase.kind === 'error') {
    return (
      <div className={s.page}>
        <div className={s.card}>
          <h2 className={s.cardTitle}>입장할 수 없어요</h2>
          <p className={s.notice}>{phase.message}</p>
          <Link to="/" className={s.btnPrimary} style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            처음 화면으로
          </Link>
        </div>
      </div>
    );
  }

  const r = room!;

  if (kicked) {
    return (
      <div className={s.page}>
        <div className={s.card}>
          <h2 className={s.cardTitle}>대기실에서 나왔어요</h2>
          <p className={s.notice}>방장이 내보냈거나 직접 나갔습니다.</p>
          <Link to="/" className={s.btnPrimary} style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            처음 화면으로
          </Link>
        </div>
      </div>
    );
  }

  const offlineBanner = offline ? (
    <div className={s.banner}>연결이 끊겼어요. 다시 연결되면 자동으로 최신 상태가 됩니다.</div>
  ) : null;

  if (r.expired && r.status !== 'playing') {
    return (
      <div className={s.page}>
        <div className={s.card}>
          <h2 className={s.cardTitle}>만료된 방</h2>
          <p className={s.notice}>24시간 넘게 사용하지 않은 방입니다. 새 방을 만들어 주세요.</p>
          <Link to="/" className={s.btnPrimary} style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            처음 화면으로
          </Link>
        </div>
      </div>
    );
  }

  // ───── 대기실 ─────
  if (r.status === 'lobby' || !r.state) {
    const canStart = isHost && r.seats.length >= 2 && r.seats.length <= MAX_SEATS;
    return (
      <div className={s.page}>
        {toastEl}
        {offlineBanner}
        <div className={s.card}>
          <div className={s.label} style={{ textAlign: 'center' }}>
            방 코드
          </div>
          <div className={s.bigCode}>{code}</div>
          <button type="button" className={s.btnGhost} style={{ width: '100%' }} onClick={copyLink}>
            초대 링크 복사
          </button>
          <p className={s.notice} style={{ textAlign: 'center', wordBreak: 'break-all' }}>
            {shareUrl}
          </p>
        </div>
        <div className={s.card}>
          <h2 className={s.cardTitle}>
            참가자 {r.seats.length}/{MAX_SEATS}
          </h2>
          <ul className={s.seatList}>
            {r.seats.map((seat) => (
              <li key={seat.uid} className={s.seat}>
                <span>
                  {seat.name}
                  {seat.uid === r.hostUid && <span className={s.tag}>방장</span>}
                  {seat.uid === uid && <span className={s.tag}>나</span>}
                </span>
                {isHost && seat.uid !== uid && (
                  <button
                    type="button"
                    className={s.btnDanger}
                    onClick={() => confirm(`${seat.name} 님을 내보낼까요?`) && run(() => kickSeat(code, seat.uid))}
                  >
                    내보내기
                  </button>
                )}
              </li>
            ))}
            {Array.from({ length: MAX_SEATS - r.seats.length }, (_, i) => (
              <li key={`e${i}`} className={`${s.seat} ${s.seatEmpty}`}>
                빈 자리
              </li>
            ))}
          </ul>
        </div>
        <div className={s.stack}>
          {isHost ? (
            <>
              <button
                type="button"
                className={s.btnPrimary}
                disabled={!canStart || busy}
                onClick={() => run(() => startGame(code))}
              >
                {r.seats.length < 2 ? '2명 이상 모이면 시작할 수 있어요' : '게임 시작'}
              </button>
              <button
                type="button"
                className={s.btnGhost}
                onClick={() =>
                  confirm('방을 없앨까요? 모든 참가자가 나가게 됩니다.') &&
                  run(async () => {
                    await deleteRoom(code);
                    nav('/');
                  })
                }
              >
                방 없애기
              </button>
            </>
          ) : (
            <>
              <p className={s.notice} style={{ textAlign: 'center' }}>
                방장이 게임을 시작하기를 기다리는 중…
              </p>
              <button
                type="button"
                className={s.btnGhost}
                onClick={() =>
                  run(async () => {
                    await leaveRoom(code);
                    nav('/');
                  })
                }
              >
                나가기
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ───── 게임 / 결과 ─────
  const state = r.state;
  const viewer = uid ? state.players.findIndex((p) => p.uid === uid) : -1;
  const spectator = viewer < 0;

  return (
    <>
      {toastEl}
      <GameView
        state={state}
        viewer={spectator ? null : viewer}
        canAct={!spectator && !busy}
        onMove={onMove}
        onForfeit={spectator ? undefined : () => run(() => forfeitGame(code))}
        onExit={goHome}
        banner={
          <>
            {offlineBanner}
            {spectator && <div className={s.banner}>관전 중입니다. 게임이 끝나면 다음 판에 참가할 수 있어요.</div>}
          </>
        }
        topRight={<span className={s.iconBtn}>{code}</span>}
        resultActions={
          <>
            {isHost ? (
              <button type="button" className={s.btnPrimary} disabled={busy} onClick={() => run(() => startGame(code))}>
                같은 멤버로 다시 하기
              </button>
            ) : (
              <p className={s.notice}>방장이 다시 하기를 누르면 새 게임이 시작됩니다.</p>
            )}
            <Link to="/" className={s.btnGhost} style={{ textDecoration: 'none' }}>
              처음으로
            </Link>
          </>
        }
      />
    </>
  );
}
