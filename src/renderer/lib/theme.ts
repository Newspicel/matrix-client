import { useEffect } from 'react';
import { useUiStore, type ThemePreference } from '@/state/ui';

const SYSTEM_QUERY = '(prefers-color-scheme: dark)';

function readSystemScheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia(SYSTEM_QUERY).matches ? 'dark' : 'light';
}

/** Reflect the user's theme preference onto <html>. The CSS in global.css
 *  watches the `data-theme` and `data-system-scheme` attributes to decide
 *  which palette to apply. */
function applyTheme(theme: ThemePreference): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  if (theme === 'system') {
    root.setAttribute('data-system-scheme', readSystemScheme());
  } else {
    root.removeAttribute('data-system-scheme');
  }
}

/** Run once at startup so the theme is applied even before the React tree
 *  mounts. Reads from the persisted UI store so the chosen palette survives
 *  reloads without a flash. */
export function bootstrapTheme(): void {
  // The persist middleware hydrates synchronously from localStorage, so
  // reading getState() here returns the stored preference if any.
  const { theme } = useUiStore.getState();
  applyTheme(theme);
}

/** Subscribe to theme changes (and OS scheme changes when "system" is on)
 *  so the document's data-attributes stay in sync. Mount once near the root. */
export function useApplyTheme(): void {
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mql = window.matchMedia(SYSTEM_QUERY);
    const onChange = () => applyTheme('system');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [theme]);
}
