<script lang="ts">
  import { goto } from '$app/navigation';
  import { createKitchen } from '$lib/api';
  import { authStore } from '$lib/stores/auth';
  import Button from '$lib/ui/Button.svelte';
  import Input from '$lib/ui/Input.svelte';
  import Label from '$lib/ui/Label.svelte';
  import Card from '$lib/ui/Card.svelte';
  import MapPicker from '$lib/ui/MapPicker.svelte';
  import { cn } from '$lib/cn';
  
  let title = $state('');
  let description = $state('');
  let lng = $state<number | null>(null);
  let lat = $state<number | null>(null);
  let loading = $state(false);
  let error = $state('');
  
  let auth = $derived.by(() => $authStore);
  
  function handleLocationSelect(selectedLat: number, selectedLng: number): void {
    lat = selectedLat;
    lng = selectedLng;
  }
  
  function getCurrentLocation(): void {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        },
        (err) => {
          error = 'Failed to get your location. Please select it on the map.';
          console.error('Geolocation error:', err);
        }
      );
    } else {
      error = 'Geolocation is not supported by your browser. Please select your location on the map.';
    }
  }
  
  async function handleSubmit(): Promise<void> {
    error = '';
    if (!title || lng === null || lat === null) {
      error = 'Please fill all required fields and select a location on the map';
      return;
    }
    loading = true;
    try {
      await createKitchen({
        title,
        description: description || undefined,
        lng: lng,
        lat: lat
      });
      goto('/owner');
    } catch (err: unknown) {
      error = (err as { error?: string }).error || 'Failed to create kitchen';
    } finally {
      loading = false;
    }
  }
</script>

<div class={cn('container mx-auto p-6 max-w-2xl')}>
  <h1 class={cn('text-3xl font-bold mb-6')}>Create New Kitchen</h1>
  
  <Card class={cn('p-6')}>
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
      
      <div>
        <div class={cn('flex items-center justify-between mb-2')}>
          <Label>Kitchen Location *</Label>
          <Button type="button" variant="outline" size="sm" onclick={getCurrentLocation}>
            Use Current Location
          </Button>
        </div>
        <MapPicker
          lat={lat}
          lng={lng}
          onLocationSelect={handleLocationSelect}
          height="400px"
        />
        {#if lat !== null && lng !== null}
          <div class={cn('mt-2 text-xs text-muted-foreground')}>
            Selected: {lat.toFixed(6)}, {lng.toFixed(6)}
          </div>
        {/if}
      </div>
      
      <Button type="submit" disabled={loading} class={cn('w-full')}>
        {loading ? 'Creating...' : 'Create Kitchen'}
      </Button>
    </form>
  </Card>
</div>

