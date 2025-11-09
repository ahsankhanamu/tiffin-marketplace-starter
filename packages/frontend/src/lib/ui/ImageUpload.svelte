<script lang="ts">
  import { cn } from '$lib/cn';
  import Button from './Button.svelte';

  interface Props {
    onUpload: (file: File) => Promise<void>;
    maxImages?: number;
    currentCount?: number;
    class?: string;
    disabled?: boolean;
  }

  let {
    onUpload,
    maxImages = 10,
    currentCount = 0,
    class: className = '',
    disabled = false
  }: Props = $props();

  let uploading = $state(false);
  let error = $state('');
  let fileInput: HTMLInputElement | null = null;

  async function handleFileSelect(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    if (currentCount >= maxImages) {
      error = `Maximum ${maxImages} images allowed`;
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      error = 'Invalid file type. Only JPEG, PNG, and WebP are allowed';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      error = 'File size must be less than 5MB';
      return;
    }

    error = '';
    uploading = true;

    try {
      await onUpload(file);
      if (fileInput) {
        fileInput.value = '';
      }
    } catch (err: unknown) {
      error = (err as { error?: string }).error || 'Failed to upload image';
    } finally {
      uploading = false;
    }
  }

  function triggerFileInput(): void {
    fileInput?.click();
  }
</script>

<div class={cn('space-y-2', className)}>
  <input
    bind:this={fileInput}
    type="file"
    accept="image/jpeg,image/jpg,image/png,image/webp"
    onchange={handleFileSelect}
    class="hidden"
    disabled={disabled || uploading || currentCount >= maxImages}
  />

  <Button
    type="button"
    variant="outline"
    onclick={triggerFileInput}
    disabled={disabled || uploading || currentCount >= maxImages}
    class={cn('w-full')}
  >
    {uploading ? 'Uploading...' : currentCount >= maxImages ? `Maximum ${maxImages} images` : 'Upload Image'}
  </Button>

  {#if error}
    <p class={cn('text-sm text-destructive')}>{error}</p>
  {/if}

  {#if currentCount < maxImages}
    <p class={cn('text-xs text-muted-foreground')}>
      {currentCount} / {maxImages} images
    </p>
  {/if}
</div>

