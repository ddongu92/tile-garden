import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { APP_NAME } from '../config';
import { COLORS } from '../game';
import { firebaseReady } from '../online/firebase';
import { createRoom, errorMessage, isValidCode, normalizeCode } from '../online/rooms';
import { useStoredState } from '../ui/settings';
import { Tile } from '../ui/Tile';
import s from '../ui/ui.module.css';

export function Home() {
  const nav = useNavigate();
  const [name, setName] = useStoredState('tg.name', '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const needName = () => {
    if (!name.trim()) {
      setErr('닉네임을 먼저 입력해 주세요.');
      return true;
    }
    return false;
  };

  const onCreate = async () => {
    if (needName()) return;
    setBusy(true);
    setErr('');
    try {
      const c = await createRoom(name);
      nav(`/r/${c}`);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onJoin = () => {
    if (needName()) return;
    const c = normalizeCode(code);
    if (!isValidCode(c)) {
      setErr('방 코드는 영문 4자리입니다(I, O는 쓰지 않아요).');
      return;
    }
    nav(`/r/${c}`);
  };

  return (
    <div className={s.page}>
      <div className={s.brand}>
        <div className={s.brandTiles}>
          {COLORS.map((c) => (
            <Tile key={c} item={c} />
          ))}
        </div>
        <h1 className={s.brandTitle}>{APP_NAME}</h1>
        <p className={s.notice}>친구 2~4명이 링크 하나로 함께하는 타일 놓기 게임</p>
      </div>

      <div className={s.card}>
        <label className={s.field}>
          <span className={s.label}>닉네임</span>
          <input
            className={s.input}
            value={name}
            maxLength={10}
            placeholder="예: 민수"
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        {firebaseReady ? (
          <div className={s.stack}>
            <button type="button" className={s.btnPrimary} onClick={onCreate} disabled={busy}>
              {busy ? '방 만드는 중…' : '방 만들기'}
            </button>
            <div className={s.row}>
              <input
                className={`${s.input} ${s.codeInput}`}
                value={code}
                placeholder="ABCD"
                maxLength={4}
                inputMode="text"
                autoCapitalize="characters"
                onChange={(e) => setCode(normalizeCode(e.target.value))}
                onKeyDown={(e) => e.key === 'Enter' && onJoin()}
                aria-label="방 코드"
              />
              <button type="button" className={s.btnGhost} onClick={onJoin}>
                방 코드로 입장
              </button>
            </div>
          </div>
        ) : (
          <p className={s.notice}>
            온라인 기능이 아직 설정되지 않았습니다(.env의 Firebase 설정 필요). 지금은 한 기기에서 하기만 쓸 수 있어요.
          </p>
        )}
        {err && <p className={s.error}>{err}</p>}
      </div>

      <div className={s.card}>
        <h2 className={s.cardTitle}>한 기기에서 하기</h2>
        <p className={s.notice}>휴대폰 하나를 돌려 가며 2~4명이 번갈아 플레이합니다.</p>
        <Link to="/local" className={s.btnGhost} style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
          시작하기
        </Link>
      </div>
    </div>
  );
}
