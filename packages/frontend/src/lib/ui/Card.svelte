<script lang="ts">
  import { cn } from '$lib/cn';
  
  interface Props {
    class?: string;
    variant?: 'default' | 'glass' | 'glass-strong' | 'glass-subtle';
  }
  
  let { class: className = '', variant = 'glass' }: Props = $props();
</script>

<div class={cn(
  variant === 'glass' && 'glass',
  variant === 'glass-strong' && 'glass-strong',
  variant === 'glass-subtle' && 'glass-subtle',
  variant === 'default' && 'rounded-lg border border-border bg-card text-card-foreground shadow-sm',
  'p-6 transition-glass',
  className
)}>
  <slot />
</div>

