<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore, clearAuth } from '$lib/stores/auth';
  import Button from '$lib/ui/Button.svelte';
  import Card from '$lib/ui/Card.svelte';
  import { cn } from '$lib/cn';
  
  let auth = $derived.by(() => $authStore);
  
  function handleLogout(): void {
    clearAuth();
    goto('/login');
  }
</script>

<div class={cn('container mx-auto p-6 max-w-2xl')}>
  <h1 class={cn('text-3xl font-bold mb-6')}>Profile</h1>
  
  {#if auth.isAuthenticated && auth.user}
    <Card class={cn('p-6')}>
      <div class={cn('space-y-4')}>
        <div>
          <label class={cn('text-sm font-medium text-muted-foreground')}>Name</label>
          <p class={cn('text-lg')}>{auth.user.name || 'Not set'}</p>
        </div>
        <div>
          <label class={cn('text-sm font-medium text-muted-foreground')}>Email</label>
          <p class={cn('text-lg')}>{auth.user.email}</p>
        </div>
        <div>
          <label class={cn('text-sm font-medium text-muted-foreground')}>Role</label>
          <p class={cn('text-lg capitalize')}>{auth.user.role}</p>
        </div>
        <div class={cn('pt-4 border-t')}>
          <Button onclick={handleLogout} variant="destructive">
            Logout
          </Button>
        </div>
      </div>
    </Card>
  {:else}
    <p>Not authenticated</p>
  {/if}
</div>

