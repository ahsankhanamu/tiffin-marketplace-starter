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
    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
  />
</svg>

