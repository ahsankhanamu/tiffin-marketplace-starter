<script lang="ts">
  import { theme } from '$lib/stores/theme';
  import { cn } from '$lib/cn';
  import { Sun, Moon } from '$lib/icons';

  let currentTheme = $state<'light' | 'dark'>('light');
  
  theme.subscribe((t) => {
    currentTheme = t;
  });
  
  const isDark = $derived(currentTheme === 'dark');
</script>

<button
  type="button"
  onclick={() => theme.toggle()}
  class={cn(
    'glass-strong relative inline-flex h-10 w-10 items-center justify-center rounded-lg',
    'transition-all duration-200 hover:scale-110 active:scale-95',
    'text-foreground hover:text-primary'
  )}
  aria-label="Toggle theme"
>
  <Moon
    class={cn('h-5 w-5 transition-all duration-300', isDark ? 'rotate-0 scale-100' : 'rotate-90 scale-0')}
  />
  <Sun
    class={cn('absolute h-5 w-5 transition-all duration-300', isDark ? 'rotate-90 scale-0' : 'rotate-0 scale-100')}
  />
</button>

