import {
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  Timestamp,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { ROOM_TTL_MS } from '../config';
import { applyMove, createGame, defaultRng, isLegal, type GameState, type Move } from '../game';
import { ensureUser, getDb } from './firebase';

export interface Seat {
  uid: string;
  name: string;
  joinedAt: number;
}

export type RoomStatus = 'lobby' | 'playing' | 'finished';

/** Firestore 문서 형태. GameState는 중첩 배열이 있어 JSON 문자열로 저장한다. */
interface RoomDoc {
  code: string;
  hostUid: string;
  status: RoomStatus;
  seats: Seat[];
  stateJson: string | null;
  /** 지금 수를 둘 사람의 uid(보안 규칙에서 검사) */
  turnUid: string | null;
  version: number;
  updatedAt: Timestamp;
  /** TTL 정책용 만료 시각 */
  expireAt: Timestamp;
}

export interface Room {
  code: string;
  hostUid: string;
  status: RoomStatus;
  seats: Seat[];
  state: GameState | null;
  version: number;
  updatedAt: number;
  expired: boolean;
}

export class RoomError extends Error {
  constructor(
    public code: 'NOT_FOUND' | 'EXPIRED' | 'FULL' | 'STARTED' | 'NOT_HOST' | 'NOT_YOUR_TURN' | 'ILLEGAL' | 'STALE' | 'BAD_COUNT',
    message: string,
  ) {
    super(message);
  }
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // I, O 제외
export const MAX_SEATS = 4;

export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
}

export function isValidCode(code: string): boolean {
  return code.length === 4 && [...code].every((c) => CODE_CHARS.includes(c));
}

function randomCode(): string {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

const roomRef = (code: string) => doc(getDb(), 'rooms', code);

function stamps() {
  const now = Date.now();
  return { updatedAt: Timestamp.fromMillis(now), expireAt: Timestamp.fromMillis(now + ROOM_TTL_MS) };
}

function isExpired(d: RoomDoc): boolean {
  const t = d.updatedAt?.toMillis?.() ?? 0;
  return Date.now() - t > ROOM_TTL_MS;
}

function toRoom(snap: DocumentSnapshot): Room | null {
  if (!snap.exists()) return null;
  const d = snap.data() as RoomDoc;
  return {
    code: d.code,
    hostUid: d.hostUid,
    status: d.status,
    seats: d.seats ?? [],
    state: d.stateJson ? (JSON.parse(d.stateJson) as GameState) : null,
    version: d.version,
    updatedAt: d.updatedAt?.toMillis?.() ?? 0,
    expired: isExpired(d),
  };
}

const cleanName = (name: string) => name.trim().slice(0, 10) || '이름없음';

export async function createRoom(name: string): Promise<string> {
  const user = await ensureUser();
  const db = getDb();
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode();
    const ref = roomRef(code);
    const created = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists() && !isExpired(snap.data() as RoomDoc)) return false;
      if (snap.exists()) {
        // 만료된 방 코드는 방장이 아니면 덮어쓸 수 없으므로 다른 코드를 시도
        return false;
      }
      const data: RoomDoc = {
        code,
        hostUid: user.uid,
        status: 'lobby',
        seats: [{ uid: user.uid, name: cleanName(name), joinedAt: Date.now() }],
        stateJson: null,
        turnUid: null,
        version: 0,
        ...stamps(),
      };
      tx.set(ref, data);
      return true;
    });
    if (created) return code;
  }
  throw new Error('방 코드를 만들지 못했습니다. 다시 시도해 주세요.');
}

/** 방 입장. 이미 내 좌석이 있으면 그대로 복귀한다. 게임 중이면 관전자로 입장(좌석 없음). */
export async function joinRoom(code: string, name: string): Promise<{ seated: boolean }> {
  const user = await ensureUser();
  const ref = roomRef(code);
  return runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new RoomError('NOT_FOUND', '그런 방이 없습니다. 방 코드를 확인해 주세요.');
    const d = snap.data() as RoomDoc;
    if (isExpired(d)) throw new RoomError('EXPIRED', '24시간 넘게 사용하지 않아 만료된 방입니다. 새 방을 만들어 주세요.');
    if (d.seats.some((s) => s.uid === user.uid)) return { seated: true };
    if (d.status !== 'lobby') return { seated: false };
    if (d.seats.length >= MAX_SEATS) throw new RoomError('FULL', '방이 가득 찼습니다(최대 4명).');
    tx.update(ref, {
      seats: [...d.seats, { uid: user.uid, name: cleanName(name), joinedAt: Date.now() }],
      ...stamps(),
    });
    return { seated: true };
  });
}

export async function leaveRoom(code: string): Promise<void> {
  const user = await ensureUser();
  const ref = roomRef(code);
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const d = snap.data() as RoomDoc;
    if (d.status !== 'lobby') return;
    tx.update(ref, { seats: d.seats.filter((s) => s.uid !== user.uid), ...stamps() });
  });
}

export async function kickSeat(code: string, uid: string): Promise<void> {
  const user = await ensureUser();
  const ref = roomRef(code);
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const d = snap.data() as RoomDoc;
    if (d.hostUid !== user.uid) throw new RoomError('NOT_HOST', '방장만 내보낼 수 있습니다.');
    if (d.status !== 'lobby') throw new RoomError('STARTED', '대기실에서만 내보낼 수 있습니다.');
    tx.update(ref, { seats: d.seats.filter((s) => s.uid !== uid), ...stamps() });
  });
}

/** 게임 시작 또는 같은 멤버로 다시 하기 */
export async function startGame(code: string): Promise<void> {
  const user = await ensureUser();
  const ref = roomRef(code);
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new RoomError('NOT_FOUND', '방이 없습니다.');
    const d = snap.data() as RoomDoc;
    if (d.hostUid !== user.uid) throw new RoomError('NOT_HOST', '방장만 시작할 수 있습니다.');
    if (d.status === 'playing') return;
    if (d.seats.length < 2 || d.seats.length > MAX_SEATS)
      throw new RoomError('BAD_COUNT', '2~4명이 모여야 시작할 수 있습니다.');
    const state = createGame(
      d.seats.map((s) => ({ uid: s.uid, name: s.name })),
      defaultRng,
    );
    tx.update(ref, {
      status: 'playing',
      stateJson: JSON.stringify(state),
      turnUid: state.players[state.currentPlayer].uid,
      version: d.version + 1,
      ...stamps(),
    });
  });
}

export async function submitMove(code: string, move: Move): Promise<void> {
  const user = await ensureUser();
  const ref = roomRef(code);
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new RoomError('NOT_FOUND', '방이 없습니다.');
    const d = snap.data() as RoomDoc;
    if (d.status !== 'playing' || !d.stateJson) throw new RoomError('STALE', '게임이 진행 중이 아닙니다.');
    const state = JSON.parse(d.stateJson) as GameState;
    if (state.players[state.currentPlayer].uid !== user.uid)
      throw new RoomError('NOT_YOUR_TURN', '지금은 내 차례가 아닙니다.');
    if (!isLegal(state, move)) throw new RoomError('ILLEGAL', '그 수는 둘 수 없습니다. 화면을 최신 상태로 맞췄어요.');
    const next = applyMove(state, move, defaultRng);
    const finished = next.phase === 'finished';
    tx.update(ref, {
      stateJson: JSON.stringify(next),
      turnUid: finished ? null : next.players[next.currentPlayer].uid,
      status: finished ? 'finished' : 'playing',
      version: d.version + 1,
      ...stamps(),
    });
  });
}

export async function deleteRoom(code: string): Promise<void> {
  await ensureUser();
  await deleteDoc(roomRef(code));
}

export async function fetchRoom(code: string): Promise<Room | null> {
  await ensureUser();
  return toRoom(await getDoc(roomRef(code)));
}

export function subscribeRoom(
  code: string,
  onRoom: (room: Room | null, fromCache: boolean) => void,
  onError: (e: Error) => void,
): () => void {
  return onSnapshot(
    roomRef(code),
    { includeMetadataChanges: true },
    (snap) => onRoom(toRoom(snap), snap.metadata.fromCache),
    onError,
  );
}

/** 사용자에게 보여 줄 오류 문구 */
export function errorMessage(e: unknown): string {
  if (e instanceof RoomError) return e.message;
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'unavailable' || code === 'deadline-exceeded' || !navigator.onLine)
    return '인터넷 연결이 불안정합니다. 연결되면 다시 시도해 주세요.';
  if (code === 'permission-denied') return '권한이 없습니다. 화면을 최신 상태로 맞췄어요.';
  if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation')
    return 'Firebase 익명 로그인이 꺼져 있습니다. README의 설정 단계를 확인해 주세요.';
  if (code === 'aborted' || code === 'failed-precondition')
    return '다른 사람이 먼저 두었어요. 최신 상태로 맞췄습니다.';
  return (e as Error)?.message || '알 수 없는 오류가 발생했습니다.';
}
