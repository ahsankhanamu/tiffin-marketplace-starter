<script lang="ts">
  import { goto } from '$app/navigation';
  import { createKitchen } from '$lib/api';
  import { authStore } from '$lib/stores/auth';
  import Button from '$lib/ui/Button.svelte';
  import Input from '$lib/ui/Input.svelte';
  import Label from '$lib/ui/Label.svelte';
  import Card from '$lib/ui/Card.svelte';
  import { cn } from '$lib/cn';
  
  let title = $state('');
  let description = $state('');
  let lng = $state('');
  let lat = $state('');
  let loading = $state(false);
  let error = $state('');
  
  let auth = $derived.by(() => $authStore);
  
  async function handleSubmit(): Promise<void> {
    error = '';
    if (!title || !lng || !lat) {
      error = 'Please fill all required fields';
      return;
    }
    loading = true;
    try {
      await createKitchen({
        title,
        description: description || undefined,
        lng: parseFloat(lng),
        lat: parseFloat(lat)
      });
      goto('/owner');
    } catch (err: unknown) {
      error = (err as { error?: string }).error || 'Failed to create kitchen';
    } finally {
      loading = false;
    }
  }
  
  function getLocation(): void {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        lat = pos.coords.latitude.toString();
        lng = pos.coords.longitude.toString();
      });
    }
  }
</script>

<div class={cn('container mx-auto p-6 max-w-2xl')}>
  <h1 class={cn('text-3xl font-bold mb-6')}>Create New Kitchen</h1>
  
  <Card className={cn('p-6')}>
    {#if error}
      <div class={cn('mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm')}>
        {error}
      </div>
    {/if}
    
    <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class={cn('space-y-4')}>
      <div>
        <Label for="title">Title *</Label>
        <Input
          id="title"
          bind:value={title}
          placeholder="Tiffin Kitchen Name"
          required
          class={cn('mt-1')}
        />
      </div>
      
      <div>
        <Label for="description">Description</Label>
        <textarea
          id="description"
          bind:value={description}
          placeholder="Describe your tiffin kitchen"
          class={cn('flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1')}
        />
      </div>
      
      <div class={cn('grid grid-cols-2 gap-4')}>
        <div>
          <Label for="lat">Latitude *</Label>
          <Input
            id="lat"
            type="number"
            step="any"
            bind:value={lat}
            placeholder="24.4539"
            required
            class={cn('mt-1')}
          />
        </div>
        <div>
          <Label for="lng">Longitude *</Label>
          <Input
            id="lng"
            type="number"
            step="any"
            bind:value={lng}
            placeholder="54.3773"
            required
            class={cn('mt-1')}
          />
        </div>
      </div>
      
      <Button type="button" variant="outline" onclick={getLocation} class={cn('w-full')}>
        Use Current Location
      </Button>
      
      <Button type="submit" disabled={loading} class={cn('w-full')}>
        {loading ? 'Creating...' : 'Create Kitchen'}
      </Button>
    </form>
  </Card>
</div>

