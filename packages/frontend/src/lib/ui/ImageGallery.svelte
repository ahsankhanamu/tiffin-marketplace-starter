<script lang="ts">
  import { cn } from '$lib/cn';
  import Button from './Button.svelte';
  import { X } from '$lib/icons';

  interface Props {
    images: string[];
    coverImage?: string;
    onDelete?: (index: number) => Promise<void>;
    onSetCover?: (imageUrl: string) => Promise<void>;
    class?: string;
    readonly?: boolean;
  }

  let {
    images = [],
    coverImage,
    onDelete,
    onSetCover,
    class: className = '',
    readonly = false
  }: Props = $props();

  let deleting = $state<number | null>(null);
  let settingCover = $state<string | null>(null);

  async function handleDelete(index: number): Promise<void> {
    if (!onDelete) return;
    deleting = index;
    try {
      await onDelete(index);
    } catch (err) {
      console.error('Failed to delete image:', err);
    } finally {
      deleting = null;
    }
  }

  async function handleSetCover(imageUrl: string): Promise<void> {
    if (!onSetCover) return;
    settingCover = imageUrl;
    try {
      await onSetCover(imageUrl);
    } catch (err) {
      console.error('Failed to set cover image:', err);
    } finally {
      settingCover = null;
    }
  }

  function getImageUrl(image: string): string {
    if (image.startsWith('http://') || image.startsWith('https://')) {
      return image;
    }
    const apiBase = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:4000';
    return `${apiBase}${image}`;
  }
</script>

<div class={cn('grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4', className)}>
  {#each images as image, index}
    <div
      class={cn(
        'relative group rounded-lg overflow-hidden border-2 transition-all',
        coverImage === image ? 'border-primary ring-2 ring-primary/20' : 'border-border'
      )}
    >
      <img
        src={getImageUrl(image)}
        alt={`Image ${index + 1}`}
        class={cn('w-full h-32 object-cover')}
        loading="lazy"
      />

      {coverImage === image && (
        <div
          class={cn(
            'absolute top-2 left-2 px-2 py-1 rounded-md',
            'bg-primary text-primary-foreground text-xs font-medium'
          )}
        >
          Cover
        </div>
      )}

      {#if !readonly}
        <div
          class={cn(
            'absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100',
            'transition-opacity flex items-center justify-center gap-2'
          )}
        >
          {coverImage !== image && onSetCover && (
            <Button
              size="sm"
              variant="secondary"
              onclick={() => handleSetCover(image)}
              disabled={settingCover === image}
              class={cn('text-xs')}
            >
              {settingCover === image ? 'Setting...' : 'Set Cover'}
            </Button>
          )}

          {onDelete && (
            <Button
              size="sm"
              variant="destructive"
              onclick={() => handleDelete(index)}
              disabled={deleting === index}
              class={cn('text-xs')}
            >
              {deleting === index ? (
                'Deleting...'
              ) : (
                <X class="size-4" />
              )}
            </Button>
          )}
        </div>
      {/if}
    </div>
  {:else}
    <div
      class={cn(
        'col-span-full text-center text-muted-foreground py-8',
        'border-2 border-dashed border-border rounded-lg'
      )}
    >
      No images uploaded
    </div>
  {/each}
</div>

