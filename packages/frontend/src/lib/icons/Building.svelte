<script lang="ts">
  import { cn } from '$lib/cn';

  interface Props {
    class?: string;
    size?: number | string;
  }

  let { class: className = '', size = 16 }: Props = $props();
</script>

<svg
  class={cn('shrink-0', className)}
  fill="none"
  stroke="currentColor"
  viewBox="0 0 24 24"
  width={size}
  height={size}
>
  <path
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="2"
    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
  />
</svg>

