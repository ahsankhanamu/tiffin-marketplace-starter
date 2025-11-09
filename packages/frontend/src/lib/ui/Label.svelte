<script lang="ts">
  import { cn } from '$lib/cn';
  
  interface Props {
    className?: string;
    for?: string;
  }
  
  let { className = '', ...restProps }: Props = $props();
  const htmlFor = restProps.for;
</script>

<label
  for={htmlFor}
  class={cn(
    'text-sm font-medium leading-none text-foreground',
    'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
    className
  )}
>
  <slot />
</label>

