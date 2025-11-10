<script lang="ts">
  import { onMount } from 'svelte';
  import { tick } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { authStore, initAuth } from '$lib/stores/auth';
  import { getUsers, getKitchens, getOrders, type User, type Kitchen, type Order } from '$lib/api';
  import Button from '$lib/ui/Button.svelte';
  import Card from '$lib/ui/Card.svelte';
  import { cn } from '$lib/cn';
  
  let users = $state<User[]>([]);
  let kitchens = $state<Kitchen[]>([]);
  let orders = $state<Order[]>([]);
  let loading = $state(true);
  let activeTab = $state<'users' | 'kitchens' | 'orders'>('users');
  
  let auth = $derived.by(() => $authStore);
  
  // Initialize auth synchronously before component renders
  if (browser) {
    initAuth();
  }
  
  onMount(async () => {
    // Ensure auth is initialized and wait for store to update
    if (browser) {
      initAuth();
      await tick(); // Wait for reactive updates
    }
    
    if (!auth.isAuthenticated || auth.user?.role !== 'admin') {
      goto('/login');
      return;
    }
    await loadData();
  });
  
  async function loadData(): Promise<void> {
    try {
      users = await getUsers();
      kitchens = await getKitchens();
      orders = await getOrders();
    } catch (err) {
      console.error(err);
    } finally {
      loading = false;
    }
  }
</script>

<div class={cn('container mx-auto p-6 max-w-7xl')}>
  <h1 class={cn('text-3xl font-bold mb-6')}>Admin Dashboard</h1>
  
  <div class={cn('flex gap-2 mb-6 border-b')}>
    <button
      onclick={() => activeTab = 'users'}
      class={cn('px-4 py-2 border-b-2', activeTab === 'users' ? 'border-primary' : 'border-transparent')}
    >
      Users ({users.length})
    </button>
    <button
      onclick={() => activeTab = 'kitchens'}
      class={cn('px-4 py-2 border-b-2', activeTab === 'kitchens' ? 'border-primary' : 'border-transparent')}
    >
      Kitchens ({kitchens.length})
    </button>
    <button
      onclick={() => activeTab = 'orders'}
      class={cn('px-4 py-2 border-b-2', activeTab === 'orders' ? 'border-primary' : 'border-transparent')}
    >
      Orders ({orders.length})
    </button>
  </div>
  
  {#if loading}
    <p>Loading...</p>
  {:else if activeTab === 'users'}
    <div class={cn('grid gap-4')}>
      {#each users as user}
        <Card class={cn('p-4')}>
          <div class={cn('flex justify-between items-center')}>
            <div>
              <p class={cn('font-semibold')}>{user.name || 'No name'}</p>
              <p class={cn('text-sm text-muted-foreground')}>{user.email}</p>
              <p class={cn('text-xs capitalize')}>{user.role}</p>
            </div>
          </div>
        </Card>
      {/each}
    </div>
  {:else if activeTab === 'kitchens'}
    <div class={cn('grid gap-4 md:grid-cols-2')}>
      {#each kitchens as kitchen}
        <Card class={cn('p-4')}>
          <h3 class={cn('font-semibold mb-2')}>{kitchen.title}</h3>
          {#if kitchen.description}
            <p class={cn('text-sm text-muted-foreground mb-2')}>{kitchen.description}</p>
          {/if}
          <p class={cn('text-xs text-muted-foreground')}>
            Owner: {kitchen.owner?.name || kitchen.owner?.email || 'Unknown'}
          </p>
        </Card>
      {/each}
    </div>
  {:else if activeTab === 'orders'}
    <div class={cn('grid gap-4')}>
      {#each orders as order}
        <Card class={cn('p-4')}>
          <div class={cn('flex justify-between items-center')}>
            <div>
              <p class={cn('font-semibold')}>Order #{order.id.slice(0, 8)}</p>
              <p class={cn('text-sm text-muted-foreground')}>${order.amount}</p>
              <p class={cn('text-xs text-muted-foreground capitalize')}>{order.status}</p>
            </div>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
</div>

