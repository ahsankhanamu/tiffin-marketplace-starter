<script lang="ts">
  import { cn } from '$lib/cn';
  
  interface Props {
    variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
    className?: string;
  }
  
  let {
    variant = 'default',
    className = ''
  }: Props = $props();
  
  const variants = {
    default: 'border-transparent bg-primary text-primary-foreground',
    secondary: 'border-transparent bg-secondary text-secondary-foreground',
    destructive: 'border-transparent bg-destructive text-destructive-foreground',
    outline: 'text-foreground border-border',
    success: 'border-transparent bg-success text-success-foreground',
    warning: 'border-transparent bg-warning text-warning-foreground',
    info: 'border-transparent bg-info text-info-foreground'
  };
</script>

<span
  class={cn(
    'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-all',
    'backdrop-blur-sm shadow-sm hover:shadow-md',
    variants[variant] || variants.default,
    className
  )}
>
  <slot />
</span>

