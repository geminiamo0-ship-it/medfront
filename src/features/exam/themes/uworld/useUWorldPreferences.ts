import { useEffect, useState } from 'react';

export type UWorldAppearance = 'blue' | 'sepia' | 'dark';
const STORAGE_KEY = 'medpark:uworld:appearance:v1';

export function useUWorldPreferences() {
  const [appearance, setAppearance] = useState<UWorldAppearance>(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored === 'sepia' || stored === 'dark' ? stored : 'blue';
    } catch { return 'blue'; }
  });
  const [split, setSplit] = useState(true);
  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, appearance); } catch { /* Private browsing */ }
  }, [appearance]);
  return { appearance, setAppearance, split, setSplit };
}
