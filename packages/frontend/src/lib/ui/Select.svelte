<script lang="ts">
  import { cn } from '$lib/cn';
  
  interface Props {
    value?: string;
    class?: string;
    disabled?: boolean;
    [key: string]: unknown;
  }
  
  let {
    value = $bindable(''),
    class: className = '',
    disabled = false,
    ...rest
  }: Props = $props();
</script>

<select
  bind:value
  disabled={disabled}
  class={cn(
    'flex h-10 w-full rounded-lg border border-input bg-background',
    'px-3 py-2 text-sm transition-all duration-200',
    'ring-offset-background',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'focus-visible:border-primary focus-visible:ring-offset-background',
    'hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50',
    'disabled:bg-muted/50',
    className
  )}
  {...rest}
>
  <slot />
</select>

