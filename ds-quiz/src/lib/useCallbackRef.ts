import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * 常に最新の関数を呼び出す安定した関数参照を返す。
 * キーボードハンドラ等を useEffect 依存に入れても、毎回張り替えずに済む。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useCallbackRef<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(((...args) => ref.current(...args)) as T, []);
}
