<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { getKitchen, getMealPlans, createMealPlan, getOrders, updateOrderStatus, type Kitchen, type MealPlan, type Order } from '$lib/api';
  import { authStore } from '$lib/stores/auth';
  import { initSocket, socketStore } from '$lib/stores/socket';
  import Button from '$lib/ui/Button.svelte';
  import Card from '$lib/ui/Card.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import Input from '$lib/ui/Input.svelte';
  import Label from '$lib/ui/Label.svelte';
  import { cn } from '$lib/cn';
  
  let kitchen = $state<Kitchen | null>(null);
  let mealPlans = $state<MealPlan[]>([]);
  let orders = $state<Order[]>([]);
  let loading = $state(true);
  let error = $state('');
  let showPlanForm = $state(false);
  let planName = $state('');
  let price = $state('');
  let billingCycle = $state<'daily' | 'weekly' | 'monthly' | 'one-off'>('one-off');
  let socket = $derived.by(() => $socketStore);
  
  let auth = $derived.by(() => $authStore);
  
  async function handleCreatePlan(): Promise<void> {
    if (!kitchen) return;
    try {
      await createMealPlan(kitchen.id, {
        name: planName,
        price: parseFloat(price),
        billingCycle
      });
      mealPlans = await getMealPlans(kitchen.id);
      showPlanForm = false;
      planName = '';
      price = '';
      billingCycle = 'one-off';
    } catch (err: unknown) {
      error = (err as { error?: string }).error || 'Failed to create plan';
    }
  }
  
  onMount(async () => {
    const id = $page.params.id;
    if (auth.token) {
      initSocket(auth.token);
    }
    
    try {
      [kitchen, mealPlans] = await Promise.all([
        getKitchen(id),
        getMealPlans(id)
      ]);
      await loadOrders();
    } catch (err: unknown) {
      error = (err as { error?: string }).error || 'Failed to load data';
    } finally {
      loading = false;
    }
    
    if (socket) {
      socket.on('order:created', ({ kitchenId }: { kitchenId: string }) => {
        if (kitchenId === id) {
          loadOrders();
        }
      });
      socket.on('order:status', () => {
        loadOrders();
      });
    }
  });
  
  async function loadOrders(): Promise<void> {
    try {
      const allOrders = await getOrders();
      orders = allOrders.filter(o => o.kitchenId === $page.params.id);
    } catch (err) {
      console.error(err);
    }
  }
  
  async function handleStatusUpdate(orderId: string, status: Order['status']): Promise<void> {
    try {
      await updateOrderStatus(orderId, status);
      await loadOrders();
    } catch (err: unknown) {
      error = (err as { error?: string }).error || 'Failed to update status';
    }
  }
</script>

<div class={cn('container mx-auto p-6 max-w-6xl')}>
  {#if loading}
    <p>Loading...</p>
  {:else if kitchen}
    <h1 class={cn('text-3xl font-bold mb-6')}>{kitchen.title}</h1>
    
    <div class={cn('grid gap-6 md:grid-cols-2')}>
      <div>
        <div class={cn('flex justify-between items-center mb-4')}>
          <h2 class={cn('text-2xl font-semibold')}>Meal Plans</h2>
          <Button onclick={() => showPlanForm = !showPlanForm} variant="outline">
            {showPlanForm ? 'Cancel' : 'Add Plan'}
          </Button>
        </div>
        
        {#if showPlanForm}
          <Card className={cn('p-4 mb-4')}>
            <form onsubmit={(e) => { e.preventDefault(); handleCreatePlan(); }} class={cn('space-y-3')}>
              <div>
                <Label for="plan-name">Plan Name</Label>
                <Input id="plan-name" bind:value={planName} required class={cn('mt-1')} />
              </div>
              <div class={cn('grid grid-cols-2 gap-3')}>
                <div>
                  <Label for="price">Price</Label>
                  <Input id="price" type="number" bind:value={price} required class={cn('mt-1')} />
                </div>
                <div>
                  <Label for="cycle">Billing Cycle</Label>
                  <select bind:value={billingCycle} class={cn('flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1')}>
                    <option value="one-off">One-off</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>
              <div class={cn('flex gap-2')}>
                <Button type="submit" class={cn('flex-1')}>Create</Button>
                <Button type="button" variant="outline" onclick={() => showPlanForm = false} class={cn('flex-1')}>Cancel</Button>
              </div>
            </form>
          </Card>
        {/if}
        
        <div class={cn('space-y-4')}>
          {#each mealPlans as plan}
            <Card className={cn('p-4')}>
              <div class={cn('flex justify-between items-start')}>
                <div>
                  <h3 class={cn('font-semibold')}>{plan.name}</h3>
                  <p class={cn('text-sm text-muted-foreground')}>${plan.price} - {plan.billingCycle}</p>
                </div>
              </div>
            </Card>
          {/each}
        </div>
      </div>
      
      <div>
        <h2 class={cn('text-2xl font-semibold mb-4')}>Orders</h2>
        <div class={cn('space-y-4')}>
          {#each orders as order}
            <Card className={cn('p-4')}>
              <div class={cn('space-y-2')}>
                <div class={cn('flex justify-between items-start')}>
                  <div>
                    <p class={cn('font-semibold')}>Order #{order.id.slice(0, 8)}</p>
                    <p class={cn('text-sm text-muted-foreground')}>${order.amount}</p>
                  </div>
                  <Badge>{order.status}</Badge>
                </div>
                <div class={cn('flex gap-2')}>
                  {#if order.status === 'created'}
                    <Button variant="outline" onclick={() => handleStatusUpdate(order.id, 'preparing')}>
                      Accept
                    </Button>
                    <Button variant="destructive" onclick={() => handleStatusUpdate(order.id, 'cancelled')}>
                      Decline
                    </Button>
                  {:else if order.status === 'preparing'}
                    <Button variant="outline" onclick={() => handleStatusUpdate(order.id, 'out-for-delivery')}>
                      Mark Out for Delivery
                    </Button>
                  {:else if order.status === 'out-for-delivery'}
                    <Button variant="outline" onclick={() => handleStatusUpdate(order.id, 'delivered')}>
                      Mark Delivered
                    </Button>
                  {/if}
                </div>
              </div>
            </Card>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

