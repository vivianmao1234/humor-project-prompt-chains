'use client';

import { useEffect, useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark' | 'system';
const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: '☀️ Light' },
  { value: 'dark', label: '🌙 Dark' },
  { value: 'system', label: '💻 System' },
];

function apply(theme: Theme) {
  const dark =
    theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

// The saved choice lives in localStorage; other tabs and this picker are notified on change.
function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener('theme-change', onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener('theme-change', onChange);
  };
}
function readTheme(): Theme {
  try {
    return (localStorage.getItem('theme') as Theme) || 'system';
  } catch {
    return 'system';
  }
}

export default function ThemePicker() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'system' as Theme);

  // In "system" mode, follow the OS when it switches between light and dark.
  useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  function choose(next: Theme) {
    try {
      localStorage.setItem('theme', next);
    } catch {}
    apply(next);
    window.dispatchEvent(new Event('theme-change'));
  }

  return (
    <div role="radiogroup" aria-label="Color theme" className="flex rounded-lg border border-zinc-200 p-0.5 text-xs dark:border-zinc-800">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={theme === o.value}
          onClick={() => choose(o.value)}
          className={`flex-1 rounded-md px-2 py-1 ${
            theme === o.value
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
              : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
