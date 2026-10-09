import { useCallback, useRef } from 'react';

/**
 * 요소 폭의 1%를 CSS 변수 --u(px)로 넣어 준다(콜백 ref).
 * 컨테이너 단위(cqw)를 지원하지 않는 구형 태블릿·인앱 브라우저에서도 같은 비율로 그리기 위함.
 */
export function useWidthUnit<T extends HTMLElement>() {
  const cleanup = useRef<(() => void) | null>(null);
  return useCallback((el: T | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!el) return;
    const apply = () => {
      const w = el.clientWidth;
      if (w > 0) el.style.setProperty('--u', `${w / 100}px`);
    };
    apply();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(apply);
      ro.observe(el);
      cleanup.current = () => ro.disconnect();
    } else {
      window.addEventListener('resize', apply);
      cleanup.current = () => window.removeEventListener('resize', apply);
    }
  }, []);
}
