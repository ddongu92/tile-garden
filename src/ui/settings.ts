import { useEffect, useState } from 'react';

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 저장 불가 환경은 무시 */
  }
}

export function useStoredState(key: string, fallback: string) {
  const [v, setV] = useState(() => read(key, fallback));
  useEffect(() => write(key, v), [key, v]);
  return [v, setV] as const;
}

export function useAnimationsSetting() {
  const [v, setV] = useStoredState('tg.anim', '1');
  return [v === '1', (on: boolean) => setV(on ? '1' : '0')] as const;
}

export const storage = { read, write };
