<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getNearby, getMyKitchens, type Kitchen } from '$lib/api';
  import { authStore, initAuth } from '$lib/stores/auth';
  import Button from '$lib/ui/Button.svelte';
  import Card from '$lib/ui/Card.svelte';
  import KitchensMap from '$lib/ui/KitchensMap.svelte';
  import { cn } from '$lib/cn';
  
  let kitchens = $state<Kitchen[]>([]);
  let loading = $state(true);
  let userLocation = $state<{ lat: number; lng: number } | null>(null);
  let auth = $derived.by(() => $authStore);
  
  const isOwner = $derived(auth.isAuthenticated && auth.user?.role === 'owner');
  
  function handleKitchenClick(kitchen: Kitchen): void {
    goto(`/kitchens/${kitchen.id}`);
  }
  
  onMount(async () => {
    initAuth();
    
    // For owners, fetch their kitchens directly
    if (isOwner) {
      try {
        kitchens = await getMyKitchens();
        loading = false;
      } catch (err) {
        console.error('Error fetching owner kitchens:', err);
        kitchens = [];
        loading = false;
      }
      return;
    }
    
    // For regular users, use geolocation and nearby API
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async pos => {
          const { latitude, longitude, accuracy } = pos.coords;
          console.log('Geolocation accuracy:', accuracy, 'meters');
          userLocation = { lat: latitude, lng: longitude };
          const nearbyKitchens = await getNearby(longitude, latitude);
          console.log('Received kitchens from API:', nearbyKitchens.length);
          console.log('Kitchens data:', nearbyKitchens);
          kitchens = nearbyKitchens;
          loading = false;
        },
        async (error) => {
          console.error('Geolocation error:', error);
          userLocation = null;
          kitchens = await getNearby(54.3773, 24.4539);
          loading = false;
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      userLocation = null;
      kitchens = await getNearby(54.3773, 24.4539);
      loading = false;
    }
  });
</script>

<div class={cn('container mx-auto p-6 max-w-6xl')}>
  <h1 class={cn('text-3xl font-bold mb-6')}>
    {#if isOwner}
      My Kitchens
    {:else}
      Nearby Tiffin Kitchens
    {/if}
  </h1>
  
  {#if loading}
    <p class={cn('text-muted-foreground')}>
      {#if isOwner}
        Loading your kitchens...
      {:else}
        Loading nearby kitchens...
      {/if}
    </p>
  {:else if kitchens && kitchens.length}
    <div class={cn('space-y-6')}>
      <!-- Map View - Only for regular users -->
      {#if !isOwner}
        <div>
          <h2 class={cn('text-xl font-semibold mb-3')}>Map View</h2>
          <KitchensMap
            kitchens={kitchens}
            userLocation={userLocation}
            height="500px"
            onKitchenClick={handleKitchenClick}
            isOwner={false}
          />
        </div>
      {/if}
      
      <!-- List View -->
      <div>
        <h2 class={cn('text-xl font-semibold mb-4')}>
          {#if isOwner}
            Your Kitchens
          {:else}
            Kitchens List
          {/if}
        </h2>
        <div class={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-3')}>
          {#each kitchens as k}
            <Card class={cn('p-6')}>
              <div>
                <h3 class={cn('text-xl font-semibold mb-2')}>{k.title}</h3>
                {#if k.description}
                  <p class={cn('text-sm text-muted-foreground mb-3 line-clamp-2')}>{k.description}</p>
                {/if}
                {#if !isOwner && k.distance_m}
                  <p class={cn('text-xs text-muted-foreground mb-3')}>
                    Distance: {Math.round(k.distance_m)} m
                  </p>
                {/if}
                {#if isOwner}
                  <Button
                    onclick={() => goto(`/owner/kitchens/${k.id}`)}
                    class={cn('w-full mt-2')}
                  >
                    Enter Kitchen
                  </Button>
                {:else}
                  <Button
                    onclick={() => goto(`/kitchens/${k.id}`)}
                    class={cn('w-full mt-2')}
                  >
                    View Kitchen
                  </Button>
                {/if}
              </div>
            </Card>
          {/each}
        </div>
      </div>
    </div>
  {:else}
    <Card class={cn('p-6 text-center')}>
      <p class={cn('text-muted-foreground')}>
        {#if isOwner}
          You don't have any kitchens yet. Create one from the owner dashboard.
        {:else}
          No tiffin kitchens found nearby
        {/if}
      </p>
    </Card>
  {/if}
</div>
