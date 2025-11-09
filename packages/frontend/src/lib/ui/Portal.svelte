<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  interface Props {
    target?: HTMLElement | string;
    [key: string]: unknown;
  }

  let { target = 'body', ...rest }: Props = $props();

  let container: HTMLElement | null = null;
  let portalContainer: HTMLElement | null = null;

  onMount(() => {
    if (!browser) return;

    const targetElement =
      typeof target === 'string'
        ? document.querySelector(target) || document.body
        : target || document.body;

    portalContainer = document.createElement('div');
    portalContainer.style.position = 'absolute';
    portalContainer.style.top = '0';
    portalContainer.style.left = '0';
    portalContainer.style.width = '100%';
    portalContainer.style.pointerEvents = 'none';
    portalContainer.style.zIndex = '9999';
    targetElement.appendChild(portalContainer);
  });

  onDestroy(() => {
    if (portalContainer && portalContainer.parentNode) {
      portalContainer.parentNode.removeChild(portalContainer);
    }
  });
</script>

{#if portalContainer}
  {#snippet portal(children)}
    {#if portalContainer}
      {@render children()}
    {/if}
  {/snippet}
{/if}

<div bind:this={container} style="display: contents">
  <slot />
</div>

