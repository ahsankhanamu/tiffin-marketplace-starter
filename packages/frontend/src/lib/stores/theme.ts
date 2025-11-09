import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { saveTheme, retrieveTheme, exists, StorageKeys } from '$lib/utils/persistence';

type Theme = 'light' | 'dark';

const getInitialTheme = (): Theme => {
  if (!browser) return 'light';
  
  // Check localStorage via persistence utility
  const stored = retrieveTheme('') as Theme;
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  
  // Check system preference
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  
  return 'light';
};

function createThemeStore() {
  const { subscribe, set, update } = writable<Theme>(getInitialTheme());

  return {
    subscribe,
    set: (theme: Theme) => {
      if (browser) {
        saveTheme(theme);
        document.documentElement.classList.toggle('dark', theme === 'dark');
      }
      set(theme);
    },
    toggle: () => {
      update((current) => {
        const newTheme = current === 'light' ? 'dark' : 'light';
        if (browser) {
          saveTheme(newTheme);
          document.documentElement.classList.toggle('dark', newTheme === 'dark');
        }
        return newTheme;
      });
    },
    init: () => {
      if (browser) {
        const theme = getInitialTheme();
        document.documentElement.classList.toggle('dark', theme === 'dark');
        set(theme);
        
        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e: MediaQueryListEvent) => {
          // Only use system preference if user hasn't explicitly set a theme
          if (!exists(StorageKeys.THEME)) {
            const newTheme = e.matches ? 'dark' : 'light';
            document.documentElement.classList.toggle('dark', newTheme === 'dark');
            set(newTheme);
          }
        };
        
        if (mediaQuery.addEventListener) {
          mediaQuery.addEventListener('change', handleChange);
        } else {
          // Fallback for older browsers
          mediaQuery.addListener(handleChange);
        }
      }
    }
  };
}

export const theme = createThemeStore();

