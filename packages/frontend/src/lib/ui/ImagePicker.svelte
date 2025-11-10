<script lang="ts">
  import { onMount } from 'svelte';
  import * as Dialog from '$lib/components/ui/dialog';
  import Button from '$lib/ui/Button.svelte';
  import { cn } from '$lib/cn';
  import { Upload, X, Trash2 } from '$lib/icons';
  import { getImages, uploadImage, deleteImage, type Image } from '$lib/api';
  import { apiBase } from '$lib/api/api';

  interface Props {
    open?: boolean;
    onSelect?: (image: Image) => void;
    class?: string;
  }

  let {
    open = $bindable(false),
    onSelect,
    class: className = ''
  }: Props = $props();

  let activeTab = $state<'upload' | 'gallery'>('upload');
  let images = $state<Image[]>([]);
  let loading = $state(false);
  let uploading = $state(false);
  let error = $state('');
  let fileInput: HTMLInputElement | null = null;
  let selectedImage: Image | null = $state(null);

  async function loadImages(): Promise<void> {
    loading = true;
    error = '';
    try {
      const result = await getImages(1, 100);
      images = result.images;
    } catch (err: unknown) {
      error = (err as { error?: string }).error || 'Failed to load images';
    } finally {
      loading = false;
    }
  }

  async function handleFileSelect(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

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
      const uploadedImage = await uploadImage(file);
      images = [uploadedImage, ...images];
      selectedImage = uploadedImage;
      if (onSelect) {
        onSelect(uploadedImage);
      }
      if (fileInput) {
        fileInput.value = '';
      }
      // Switch to gallery tab to show the uploaded image
      activeTab = 'gallery';
    } catch (err: unknown) {
      error = (err as { error?: string }).error || 'Failed to upload image';
    } finally {
      uploading = false;
    }
  }

  async function handleDelete(image: Image, event: Event): Promise<void> {
    event.stopPropagation();
    if (!confirm('Are you sure you want to delete this image?')) return;

    try {
      await deleteImage(image.id);
      images = images.filter(img => img.id !== image.id);
      if (selectedImage?.id === image.id) {
        selectedImage = null;
      }
    } catch (err: unknown) {
      error = (err as { error?: string }).error || 'Failed to delete image';
    }
  }

  function handleImageClick(image: Image): void {
    selectedImage = image;
    if (onSelect) {
      onSelect(image);
    }
  }

  function triggerFileInput(): void {
    fileInput?.click();
  }

  function handleConfirm(): void {
    if (selectedImage && onSelect) {
      onSelect(selectedImage);
    }
    open = false;
  }

  $effect(() => {
    if (open && activeTab === 'gallery') {
      loadImages();
    }
  });
</script>

<Dialog.Root bind:open={open}>
  <Dialog.Content class={cn('max-w-4xl max-h-[90vh]', className)}>
    <Dialog.Header>
      <Dialog.Title>Select Image</Dialog.Title>
      <Dialog.Description>Upload a new image or select from your gallery</Dialog.Description>
    </Dialog.Header>

    <!-- Tabs -->
    <div class={cn('flex border-b border-border mb-4')}>
      <button
        type="button"
        onclick={() => activeTab = 'upload'}
        class={cn(
          'px-4 py-2 text-sm font-medium transition-colors',
          'border-b-2',
          activeTab === 'upload'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        )}
      >
        Upload
      </button>
      <button
        type="button"
        onclick={() => { activeTab = 'gallery'; loadImages(); }}
        class={cn(
          'px-4 py-2 text-sm font-medium transition-colors',
          'border-b-2',
          activeTab === 'gallery'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        )}
      >
        Gallery
      </button>
    </div>

    <!-- Tab Content -->
    {#if activeTab === 'upload'}
      <div class={cn('space-y-4')}>
        <div
          class={cn(
            'border-2 border-dashed border-border rounded-lg p-8',
            'flex flex-col items-center justify-center',
            'hover:border-primary/50 transition-colors cursor-pointer',
            uploading && 'opacity-50 pointer-events-none'
          )}
          onclick={triggerFileInput}
        >
          <Upload class={cn('w-12 h-12 text-muted-foreground mb-4')} />
          <p class={cn('text-sm font-medium mb-2')}>
            {uploading ? 'Uploading...' : 'Click to upload or drag and drop'}
          </p>
          <p class={cn('text-xs text-muted-foreground')}>
            PNG, JPG, WEBP up to 5MB
          </p>
          <input
            bind:this={fileInput}
            type="file"
            accept="image/*"
            onchange={handleFileSelect}
            class={cn('hidden')}
          />
        </div>
        {#if error}
          <p class={cn('text-sm text-destructive')}>{error}</p>
        {/if}
      </div>
    {:else}
      <div class={cn('space-y-4 max-h-[60vh] overflow-y-auto')}>
        {#if loading}
          <div class={cn('flex items-center justify-center py-8')}>
            <p class={cn('text-sm text-muted-foreground')}>Loading images...</p>
          </div>
        {:else if images.length === 0}
          <div class={cn('flex flex-col items-center justify-center py-8')}>
            <p class={cn('text-sm text-muted-foreground mb-2')}>No images found</p>
            <p class={cn('text-xs text-muted-foreground')}>Upload images in the Upload tab</p>
          </div>
        {:else}
          <div class={cn('grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4')}>
            {#each images as image}
              <div
                class={cn(
                  'relative group cursor-pointer rounded-lg overflow-hidden',
                  'border-2 transition-all',
                  selectedImage?.id === image.id
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/50'
                )}
                onclick={() => handleImageClick(image)}
              >
                <img
                  src={`${apiBase}${image.url}`}
                  alt={image.filename}
                  class={cn('w-full h-32 object-cover')}
                />
                <div
                  class={cn(
                    'absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors',
                    'flex items-center justify-center opacity-0 group-hover:opacity-100'
                  )}
                >
                  <button
                    type="button"
                    onclick={(e) => handleDelete(image, e)}
                    class={cn(
                      'p-2 rounded-full bg-destructive text-destructive-foreground',
                      'hover:bg-destructive/90 transition-colors'
                    )}
                  >
                    <Trash2 class={cn('w-4 h-4')} />
                  </button>
                </div>
                {#if selectedImage?.id === image.id}
                  <div class={cn('absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center')}>
                    <div class={cn('w-3 h-3 rounded-full bg-primary-foreground')}></div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
        {#if error}
          <p class={cn('text-sm text-destructive')}>{error}</p>
        {/if}
      </div>
    {/if}

    <Dialog.Footer>
      <Button variant="outline" onclick={() => open = false}>Cancel</Button>
      <Button onclick={handleConfirm} disabled={!selectedImage}>
        Select
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

