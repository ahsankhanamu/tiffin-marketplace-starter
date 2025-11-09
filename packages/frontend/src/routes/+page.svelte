<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getNearby } from '$lib/api';
  import { authStore, initAuth } from '$lib/stores/auth';
  import Button from '$lib/ui/Button.svelte';
  import Card from '$lib/ui/Card.svelte';
  import { cn } from '$lib/cn';
  
  interface Kitchen {
    id: string;
    title: string;
    description?: string;
    distance_m: number;
  }
  
  let kitchens = $state<Kitchen[]>([]);
  let loading = $state(true);
  let auth = $derived.by(() => $authStore);
  
  onMount(async () => {
    initAuth();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async pos => {
        const { latitude, longitude } = pos.coords;
        kitchens = await getNearby(longitude, latitude);
        loading = false;
      }, async () => {
        kitchens = await getNearby(54.3773, 24.4539);
        loading = false;
      });
    } else {
      kitchens = await getNearby(54.3773, 24.4539);
      loading = false;
    }
  });
</script>

<div class={cn('container mx-auto p-6 max-w-6xl')}>
  <div class={cn('mb-6')}>
    <h1 class={cn('text-3xl font-bold')}>Nearby Tiffin Kitchens</h1>
  </div>
  
  {#if loading}
    <p class={cn('text-muted-foreground')}>Loading nearby kitchens...</p>
  {:else if kitchens && kitchens.length}
    <div class={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-3')}>
      {#each kitchens as k}
        <Card className={cn('p-6 cursor-pointer hover:shadow-md transition-shadow')}>
          <div onclick={() => goto(`/kitchens/${k.id}`)}>
            <h3 class={cn('text-xl font-semibold mb-2')}>{k.title}</h3>
            {#if k.description}
              <p class={cn('text-sm text-muted-foreground mb-3 line-clamp-2')}>{k.description}</p>
            {/if}
            <p class={cn('text-xs text-muted-foreground')}>
              Distance: {Math.round(k.distance_m)} m
            </p>
          </div>
        </Card>
      {/each}
    </div>
  {:else}
    <Card className={cn('p-6 text-center')}>
      <p class={cn('text-muted-foreground')}>No tiffin kitchens found nearby</p>
    </Card>
  {/if}
</div>
