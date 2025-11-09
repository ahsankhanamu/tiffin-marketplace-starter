<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { getKitchen, getMealPlans, createMealPlan, deleteMealPlan, getKitchenOrders, updateOrderStatus, type Kitchen, type MealPlan, type Order } from '$lib/api';
  import { authStore } from '$lib/stores/auth';
  import { initSocket, socketStore } from '$lib/stores/socket';
  import Button from '$lib/ui/Button.svelte';
  import Card from '$lib/ui/Card.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import Input from '$lib/ui/Input.svelte';
  import Label from '$lib/ui/Label.svelte';
  import { cn } from '$lib/cn';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Trash2, Menu, ShoppingBag, Plus } from '$lib/icons';
  
  let kitchen = $state<Kitchen | null>(null);
  let mealPlans = $state<MealPlan[]>([]);
  let orders = $state<Order[]>([]);
  let loading = $state(true);
  let error = $state('');
  let showPlanForm = $state(false);
  let planName = $state('');
  let price = $state('');
  let billingCycle = $state<'daily' | 'weekly' | 'monthly' | 'one-off'>('one-off');
  let deleteDialogOpen = $state(false);
  let planToDelete = $state<MealPlan | null>(null);
  let deleting = $state(false);
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
      if (kitchen) {
        await loadOrders();
      }
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
      if (!kitchen) return;
      orders = await getKitchenOrders(kitchen.id);
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
  
  function openDeleteDialog(plan: MealPlan) {
    planToDelete = plan;
    deleteDialogOpen = true;
  }
  
  async function handleDeleteMealPlan() {
    if (!planToDelete || !kitchen) return;
    deleting = true;
    try {
      await deleteMealPlan(kitchen.id, planToDelete.id);
      mealPlans = mealPlans.filter(p => p.id !== planToDelete.id);
      deleteDialogOpen = false;
      planToDelete = null;
    } catch (err) {
      console.error('Failed to delete meal plan:', err);
      error = 'Failed to delete meal plan. Please try again.';
    } finally {
      deleting = false;
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
          <Card className={cn('p-4')}>
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
        {:else if mealPlans.length === 0}
          <Card className={cn('p-8 text-center')}>
            <Menu class={cn('w-12 h-12 mx-auto mb-4 text-muted-foreground')} />
            <p class={cn('text-muted-foreground mb-4')}>No meal plans yet</p>
            <Button variant="outline" onclick={() => showPlanForm = true}>
              <Plus class={cn('w-4 h-4 mr-2')} />
              Create Your First Meal Plan
            </Button>
          </Card>
        {:else}
          <div class={cn('space-y-4')}>
            {#each mealPlans as plan}
              <Card className={cn('p-4')}>
                <div class={cn('flex justify-between items-start')}>
                  <div>
                    <h3 class={cn('font-semibold')}>{plan.name}</h3>
                    <p class={cn('text-sm text-muted-foreground')}>${plan.price} - {plan.billingCycle}</p>
                    {#if plan.description}
                      <p class={cn('text-sm text-muted-foreground mt-1')}>{plan.description}</p>
                    {/if}
                  </div>
                  <div class={cn('flex gap-2')}>
                    <Button
                      variant="outline"
                      onclick={() => goto(`/owner/kitchens/${kitchen.id}/plans/${plan.id}/edit`)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      onclick={() => openDeleteDialog(plan)}
                      class={cn('px-3')}
                    >
                      <Trash2 class={cn('w-4 h-4')} />
                    </Button>
                  </div>
                </div>
              </Card>
            {/each}
          </div>
        {/if}
      </div>
      
      <div>
        <h2 class={cn('text-2xl font-semibold mb-4')}>Orders</h2>
        {#if orders.length === 0}
          <Card className={cn('p-8 text-center')}>
            <ShoppingBag class={cn('w-12 h-12 mx-auto mb-4 text-muted-foreground')} />
            <p class={cn('text-muted-foreground')}>No orders yet</p>
            <p class={cn('text-sm text-muted-foreground mt-2')}>Orders will appear here when customers place them</p>
          </Card>
        {:else}
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
        {/if}
      </div>
    </div>
  {/if}
  
  <Dialog.Root bind:open={deleteDialogOpen}>
    <Dialog.Content>
      <Dialog.Header>
        <Dialog.Title>Delete Meal Plan</Dialog.Title>
        <Dialog.Description>
          Are you sure you want to delete "{planToDelete?.name}"? This action cannot be undone and will also delete all associated schedules and orders.
        </Dialog.Description>
      </Dialog.Header>
      <Dialog.Footer>
        <Button variant="outline" onclick={() => { deleteDialogOpen = false; planToDelete = null; }} disabled={deleting}>
          Cancel
        </Button>
        <Button variant="destructive" onclick={handleDeleteMealPlan} disabled={deleting}>
          {deleting ? 'Deleting...' : 'Delete'}
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
</div>

