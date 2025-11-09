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
    d="M4 6h16M4 12h16M4 18h16"
  />
</svg>

