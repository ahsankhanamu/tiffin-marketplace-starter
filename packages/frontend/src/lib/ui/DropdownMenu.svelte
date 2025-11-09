<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { cn } from '$lib/cn';
  import { browser } from '$app/environment';

  function portal(node: HTMLElement, target: HTMLElement) {
    if (!target) return;
    target.appendChild(node);
    return {
      update(newTarget: HTMLElement) {
        if (newTarget && newTarget !== target) {
          target.removeChild(node);
          newTarget.appendChild(node);
          target = newTarget;
        }
      },
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }
    };
  }

  interface Props {
    open?: boolean;
    class?: string;
    align?: 'start' | 'end' | 'center';
    side?: 'top' | 'bottom' | 'left' | 'right';
    sideOffset?: number;
    [key: string]: unknown;
  }

  let {
    open = $bindable(false),
    class: className = '',
    align = 'end',
    side = 'bottom',
    sideOffset = 4,
    ...rest
  }: Props = $props();

  let triggerElement: HTMLElement | null = null;
  let contentElement: HTMLElement | null = null;
  let portalContainer: HTMLElement | null = null;
  let position = $state({ top: 0, left: 0 });

  function calculatePosition(): void {
    if (!triggerElement || !contentElement || !browser) return;

    const triggerRect = triggerElement.getBoundingClientRect();
    const contentRect = contentElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = 0;
    let left = 0;

    // Calculate position based on side
    switch (side) {
      case 'bottom':
        top = triggerRect.bottom + sideOffset;
        left = triggerRect.left;
        // Adjust for alignment
        if (align === 'end') {
          left = triggerRect.right - contentRect.width;
        } else if (align === 'center') {
          left = triggerRect.left + (triggerRect.width - contentRect.width) / 2;
        }
        break;
      case 'top':
        top = triggerRect.top - contentRect.height - sideOffset;
        left = triggerRect.left;
        if (align === 'end') {
          left = triggerRect.right - contentRect.width;
        } else if (align === 'center') {
          left = triggerRect.left + (triggerRect.width - contentRect.width) / 2;
        }
        break;
      case 'right':
        left = triggerRect.right + sideOffset;
        top = triggerRect.top;
        if (align === 'end') {
          top = triggerRect.bottom - contentRect.height;
        } else if (align === 'center') {
          top = triggerRect.top + (triggerRect.height - contentRect.height) / 2;
        }
        break;
      case 'left':
        left = triggerRect.left - contentRect.width - sideOffset;
        top = triggerRect.top;
        if (align === 'end') {
          top = triggerRect.bottom - contentRect.height;
        } else if (align === 'center') {
          top = triggerRect.top + (triggerRect.height - contentRect.height) / 2;
        }
        break;
    }

    // Ensure dropdown stays within viewport
    if (left + contentRect.width > viewportWidth) {
      left = viewportWidth - contentRect.width - 8;
    }
    if (left < 8) {
      left = 8;
    }
    if (top + contentRect.height > viewportHeight) {
      top = viewportHeight - contentRect.height - 8;
    }
    if (top < 8) {
      top = 8;
    }

    position = { top, left };
  }

  function handleClickOutside(event: MouseEvent): void {
    if (
      open &&
      triggerElement &&
      contentElement &&
      !triggerElement.contains(event.target as Node) &&
      !contentElement.contains(event.target as Node)
    ) {
      open = false;
    }
  }

  function handleEscape(event: KeyboardEvent): void {
    if (event.key === 'Escape' && open) {
      open = false;
      triggerElement?.focus();
    }
  }

  function handleResize(): void {
    if (open) {
      calculatePosition();
    }
  }

  function handleScroll(): void {
    if (open) {
      calculatePosition();
    }
  }

  $effect(() => {
    if (open && browser) {
      tick().then(() => {
        calculatePosition();
      });
    }
  });

  onMount(() => {
    if (!browser) return;

    // Create portal container
    portalContainer = document.createElement('div');
    portalContainer.style.position = 'fixed';
    portalContainer.style.top = '0';
    portalContainer.style.left = '0';
    portalContainer.style.width = '100%';
    portalContainer.style.height = '100%';
    portalContainer.style.pointerEvents = 'none';
    portalContainer.style.zIndex = '9999';
    document.body.appendChild(portalContainer);

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);
  });

  onDestroy(() => {
    if (browser) {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
      if (portalContainer && portalContainer.parentNode) {
        portalContainer.parentNode.removeChild(portalContainer);
      }
    }
  });

  function toggle(): void {
    open = !open;
  }
</script>

<div class={cn('relative', className)} {...rest}>
  <div bind:this={triggerElement} onclick={toggle}>
    <slot name="trigger" />
  </div>
</div>

{#if open && portalContainer}
  <div
    bind:this={contentElement}
    class={cn(
      'fixed z-[9999] min-w-[200px] max-w-[280px] rounded-lg border border-border',
      'bg-card shadow-lg backdrop-blur-md',
      'py-1 animate-in fade-in-0 zoom-in-95',
      'pointer-events-auto'
    )}
    style="top: {position.top}px; left: {position.left}px;"
    role="menu"
    aria-orientation="vertical"
    use:portal={portalContainer}
  >
    <slot />
  </div>
{/if}

<style>
  @keyframes fade-in-0 {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes zoom-in-95 {
    from {
      transform: scale(0.95);
    }
    to {
      transform: scale(1);
    }
  }

  .animate-in {
    animation-duration: 150ms;
    animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
    animation-fill-mode: forwards;
  }

  .fade-in-0 {
    animation-name: fade-in-0;
  }

  .zoom-in-95 {
    animation-name: zoom-in-95;
  }
</style>

