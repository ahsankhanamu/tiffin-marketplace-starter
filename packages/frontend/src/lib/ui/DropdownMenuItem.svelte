<script lang="ts">
  import { cn } from '$lib/cn';

  interface Props {
    class?: string;
    disabled?: boolean;
    variant?: 'default' | 'destructive';
    onclick?: () => void;
    [key: string]: unknown;
  }

  let {
    class: className = '',
    disabled = false,
    variant = 'default',
    onclick,
    ...rest
  }: Props = $props();

  function handleClick(): void {
    if (!disabled && onclick) {
      onclick();
    }
  }
</script>

<button
  class={cn(
    'w-full flex items-center justify-start gap-3 px-3 py-2.5 text-sm text-left',
    'rounded-md transition-colors',
    'focus:outline-none focus:bg-accent/50',
    variant === 'default' && 'text-foreground hover:bg-accent/50',
    variant === 'destructive' && 'text-destructive hover:bg-destructive/10',
    disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
    className
  )}
  role="menuitem"
  disabled={disabled}
  onclick={handleClick}
  {...rest}
>
  <slot />
</button>

