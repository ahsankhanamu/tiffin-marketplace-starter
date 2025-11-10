<script lang="ts">
  import { cn } from '$lib/cn';
  
  interface Props {
    class?: string;
    variant?: 'default' | 'glass' | 'glass-strong' | 'glass-subtle';
  }
  
  let { class: className = '', variant = 'default' }: Props = $props();
</script>

<div class={cn(
  // Default variant - solid card with proper styling
  variant === 'default' && 'rounded-lg border border-border bg-card text-card-foreground shadow-md',
  // Glass variants - apply glass theme classes
  variant === 'glass' && 'glass transition-glass',
  variant === 'glass-strong' && 'glass-strong transition-glass',
  variant === 'glass-subtle' && 'glass-subtle transition-glass',
  // Default padding - applied unless overridden by className
  'p-6',
  className
)}>
  <slot />
</div>

