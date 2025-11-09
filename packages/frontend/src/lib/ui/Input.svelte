<script lang="ts">
  import { cn } from '$lib/cn';
  
  interface Props {
    type?: string;
    placeholder?: string;
    value?: string;
    class?: string;
    disabled?: boolean;
    [key: string]: unknown;
  }
  
  let {
    type = 'text',
    placeholder = '',
    value = $bindable(''),
    class: className = '',
    disabled = false,
    ...rest
  }: Props = $props();
</script>

<input
  type={type}
  placeholder={placeholder}
  bind:value
  disabled={disabled}
  class={cn(
    'flex h-10 w-full rounded-lg border border-input bg-background',
    'px-3 py-2 text-sm transition-all duration-200',
    'ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium',
    'placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'focus-visible:border-primary focus-visible:ring-offset-background',
    'hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50',
    'disabled:bg-muted/50',
    className
  )}
  {...rest}
/>

