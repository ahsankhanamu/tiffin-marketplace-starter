<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { getHouse, getMealPlans, createOrder, type House, type MealPlan } from '$lib/api';
  import { authStore } from '$lib/stores/auth';
  import Button from '$lib/ui/Button.svelte';
  import Card from '$lib/ui/Card.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import { cn } from '$lib/cn';
  
  let house = $state<House | null>(null);
  let mealPlans = $state<MealPlan[]>([]);
  let loading = $state(true);
  let error = $state('');
  let orderLoading = $state<string | null>(null);
  
  let auth = $derived.by(() => $authStore);
  
  onMount(async () => {
    const id = $page.params.id;
    try {
      [kitchen, mealPlans] = await Promise.all([
        getKitchen(id),
        getMealPlans(id)
      ]);
    } catch (err: unknown) {
      error = (err as { error?: string }).error || 'Failed to load kitchen';
    } finally {
      loading = false;
    }
  });
  
  async function handleOrder(planId: string, price: number): Promise<void> {
    if (!auth.isAuthenticated) {
      error = 'Please login to place an order';
      return;
    }
    if (!kitchen) return;
    orderLoading = planId;
    try {
      await createOrder(kitchen.id, planId, price);
      error = '';
      alert('Order placed successfully!');
    } catch (err: unknown) {
      error = (err as { error?: string }).error || 'Failed to place order';
    } finally {
      orderLoading = null;
    }
  }
</script>

<div class={cn('container mx-auto p-6 max-w-4xl')}>
  {#if loading}
    <p>Loading...</p>
  {:else if error && !kitchen}
    <p class={cn('text-destructive')}>{error}</p>
  {:else if kitchen}
    <h1 class={cn('text-3xl font-bold mb-4')}>{kitchen.title}</h1>
    {#if kitchen.description}
      <p class={cn('text-muted-foreground mb-6')}>{kitchen.description}</p>
    {/if}
    
    {#if error}
      <div class={cn('mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm')}>
        {error}
      </div>
    {/if}
    
    <h2 class={cn('text-2xl font-semibold mb-4')}>Meal Plans</h2>
    
    {#if mealPlans.length === 0}
      <p class={cn('text-muted-foreground')}>No meal plans available</p>
    {:else}
      <div class={cn('grid gap-4 md:grid-cols-2')}>
        {#each mealPlans as plan}
          <Card className={cn('p-6')}>
            <div class={cn('space-y-3')}>
              <div class={cn('flex justify-between items-start')}>
                <h3 class={cn('text-xl font-semibold')}>{plan.name}</h3>
                <Badge>{plan.billingCycle}</Badge>
              </div>
              <p class={cn('text-2xl font-bold')}>${plan.price}</p>
              {#if plan.startTime && plan.endTime}
                <p class={cn('text-sm text-muted-foreground')}>
                  Available: {plan.startTime} - {plan.endTime}
                </p>
              {/if}
              {#if auth.isAuthenticated}
                <Button
                  onclick={() => handleOrder(plan.id, plan.price)}
                  disabled={orderLoading === plan.id}
                  class={cn('w-full')}
                >
                  {orderLoading === plan.id ? 'Ordering...' : 'Order Now'}
                </Button>
              {:else}
                <Button disabled class={cn('w-full')}>Login to Order</Button>
              {/if}
            </div>
          </Card>
        {/each}
      </div>
    {/if}
  {/if}
</div>

