<script lang="ts">
  import { onMount } from 'svelte';
  import { tick } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { authStore, initAuth } from '$lib/stores/auth';
  import { getMyKitchens, deleteKitchen, type Kitchen } from '$lib/api';
  import Button from '$lib/ui/Button.svelte';
  import Card from '$lib/ui/Card.svelte';
  import { cn } from '$lib/cn';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Trash2, Building, Plus } from '$lib/icons';
  
  let kitchens = $state<Kitchen[]>([]);
  let loading = $state(true);
  let deleteDialogOpen = $state(false);
  let kitchenToDelete = $state<Kitchen | null>(null);
  let deleting = $state(false);
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
    
    if (!auth.isAuthenticated || auth.user?.role !== 'owner') {
      goto('/login');
      return;
    }
    
    try {
      kitchens = await getMyKitchens();
    } catch (err) {
      console.error(err);
    } finally {
      loading = false;
    }
  });
  
  function openDeleteDialog(kitchen: Kitchen) {
    kitchenToDelete = kitchen;
    deleteDialogOpen = true;
  }
  
  async function handleDeleteKitchen() {
    if (!kitchenToDelete) return;
    deleting = true;
    try {
      await deleteKitchen(kitchenToDelete.id);
      kitchens = kitchens.filter(k => k.id !== kitchenToDelete.id);
      deleteDialogOpen = false;
      kitchenToDelete = null;
    } catch (err) {
      console.error('Failed to delete kitchen:', err);
      alert('Failed to delete kitchen. Please try again.');
    } finally {
      deleting = false;
    }
  }
</script>

<div class={cn('container mx-auto p-6 max-w-6xl')}>
  <div class={cn('flex justify-between items-center mb-6')}>
    <h1 class={cn('text-3xl font-bold')}>My Tiffin Kitchens</h1>
    <Button onclick={() => goto('/owner/kitchens/new')}>
      Add New Kitchen
    </Button>
  </div>
  
  {#if loading}
    <p>Loading...</p>
  {:else if kitchens.length === 0}
    <Card className={cn('p-8 text-center')}>
      <Building class={cn('w-12 h-12 mx-auto mb-4 text-muted-foreground')} />
      <p class={cn('text-muted-foreground mb-2')}>No kitchens yet</p>
      <p class={cn('text-sm text-muted-foreground mb-4')}>Create your first kitchen to start offering meal plans</p>
      <Button onclick={() => goto('/owner/kitchens/new')}>
        <Plus class={cn('w-4 h-4 mr-2')} />
        Create Kitchen
      </Button>
    </Card>
  {:else}
    <div class={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-3')}>
      {#each kitchens as kitchen}
        <Card className={cn('p-6 hover:shadow-md transition-shadow')}>
          <h3 class={cn('text-xl font-semibold mb-2')}>{kitchen.title}</h3>
          {#if kitchen.description}
            <p class={cn('text-sm text-muted-foreground mb-4 line-clamp-2')}>{kitchen.description}</p>
          {/if}
          <div class={cn('flex gap-2')}>
            <Button variant="outline" onclick={() => goto(`/owner/kitchens/${kitchen.id}`)} class={cn('flex-1')}>
              Manage
            </Button>
            <Button 
              variant="destructive" 
              onclick={() => openDeleteDialog(kitchen)}
              class={cn('px-3')}
            >
              <Trash2 class={cn('w-4 h-4')} />
            </Button>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
  
  <Dialog.Root bind:open={deleteDialogOpen}>
    <Dialog.Content>
      <Dialog.Header>
        <Dialog.Title>Delete Kitchen</Dialog.Title>
        <Dialog.Description>
          Are you sure you want to delete "{kitchenToDelete?.title}"? This action cannot be undone and will also delete all associated meal plans and orders.
        </Dialog.Description>
      </Dialog.Header>
      <Dialog.Footer>
        <Button variant="outline" onclick={() => { deleteDialogOpen = false; kitchenToDelete = null; }} disabled={deleting}>
          Cancel
        </Button>
        <Button variant="destructive" onclick={handleDeleteKitchen} disabled={deleting}>
          {deleting ? 'Deleting...' : 'Delete'}
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
</div>

