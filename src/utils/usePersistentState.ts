import { Dispatch, SetStateAction, useEffect, useState } from 'react';

const PREFIX = 'teumteum.view.';

/**
 * useState that remembers the value on this device, so a menu reopens with the view the user
 * chose last time (e.g. 일별/주간/월별, category filters). `allowed` lists the accepted values;
 * anything else stored (old versions, edits) falls back to `initial`.
 */
export function usePersistentState<T extends string | boolean | null>(
  key: string,
  initial: T,
  allowed: readonly T[]
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      if (raw === null) return initial;
      const parsed = JSON.parse(raw) as T;
      return allowed.includes(parsed) ? parsed : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Storage unavailable: the choice just isn't remembered.
    }
  }, [key, value]);
  return [value, setValue];
}
