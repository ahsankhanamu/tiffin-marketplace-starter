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
    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
  />
</svg>

