<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { 
    getKitchen, 
    getAvailableMeals, 
    createOrder, 
    subscribeToMealPlan,
    unsubscribeFromMealPlan,
    getMySubscriptions,
    type Kitchen, 
    type AvailableMeal,
    type Subscription
  } from '$lib/api';
  import { authStore } from '$lib/stores/auth';
  import Button from '$lib/ui/Button.svelte';
  import Card from '$lib/ui/Card.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import MapPicker from '$lib/ui/MapPicker.svelte';
  import { cn } from '$lib/cn';
  
  let kitchen = $state<Kitchen | null>(null);
  let availableMeals = $state<AvailableMeal[]>([]);
  let subscriptions = $state<Subscription[]>([]);
  let loading = $state(true);
  let error = $state('');
  let orderLoading = $state<string | null>(null);
  let subscribeLoading = $state<string | null>(null);
  
  let auth = $derived.by(() => $authStore);
  
  // Group meals by date
  const mealsByDate = $derived(() => {
    const grouped: Record<string, AvailableMeal[]> = {};
    for (const meal of availableMeals) {
      if (!grouped[meal.date]) {
        grouped[meal.date] = [];
      }
      grouped[meal.date].push(meal);
    }
    return grouped;
  });
  
  // Check if user is subscribed to a meal
  function isSubscribed(planId: string, mealType: string, dayOfWeek?: number): Subscription | null {
    return subscriptions.find(sub => 
      sub.mealPlanId === planId && 
      sub.mealType === mealType &&
      (dayOfWeek === undefined || sub.dayOfWeek === dayOfWeek || sub.dayOfWeek === null)
    ) || null;
  }
  
  // Format date for display
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const mealDate = new Date(date);
    mealDate.setHours(0, 0, 0, 0);
    
    if (mealDate.getTime() === today.getTime()) {
      return 'Today';
    }
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (mealDate.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    }
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }
  
  // Check if deadline has passed
  function isDeadlinePassed(meal: AvailableMeal): boolean {
    const now = new Date();
    const [deadlineHour, deadlineMin] = meal.orderDeadline.split(':').map(Number);
    const deadline = new Date(meal.date);
    deadline.setHours(deadlineHour, deadlineMin, 0, 0);
    return now > deadline;
  }
  
  onMount(async () => {
    const id = $page.params.id;
    try {
      [kitchen, availableMeals] = await Promise.all([
        getKitchen(id),
        getAvailableMeals(id, 7)
      ]);
      
      if (auth.isAuthenticated) {
        subscriptions = await getMySubscriptions();
      }
    } catch (err: unknown) {
      error = (err as { error?: string }).error || 'Failed to load kitchen';
    } finally {
      loading = false;
    }
  });
  
  async function handleOrder(meal: AvailableMeal): Promise<void> {
    if (!auth.isAuthenticated) {
      error = 'Please login to place an order';
      return;
    }
    if (!kitchen) return;
    
    if (isDeadlinePassed(meal)) {
      error = 'Order deadline has passed for this meal';
      return;
    }
    
    orderLoading = `${meal.planId}-${meal.mealType}-${meal.date}`;
    try {
      const scheduledDate = new Date(meal.date);
      scheduledDate.setHours(12, 0, 0, 0); // Set to noon of the scheduled date
      
      await createOrder(kitchen.id, meal.planId, meal.price, {
        mealType: meal.mealType,
        scheduledDate: scheduledDate.toISOString()
      });
      error = '';
      alert('Order placed successfully!');
      // Refresh available meals
      availableMeals = await getAvailableMeals(kitchen.id, 7);
    } catch (err: unknown) {
      error = (err as { error?: string }).error || 'Failed to place order';
    } finally {
      orderLoading = null;
    }
  }
  
  async function handleSubscribe(meal: AvailableMeal): Promise<void> {
    if (!auth.isAuthenticated) {
      error = 'Please login to subscribe';
      return;
    }
    
    subscribeLoading = `${meal.planId}-${meal.mealType}-${meal.date}`;
    try {
      await subscribeToMealPlan(meal.planId, meal.mealType, meal.dayOfWeek);
      error = '';
      alert('Subscribed successfully! Your orders will be placed automatically.');
      // Refresh subscriptions
      subscriptions = await getMySubscriptions();
    } catch (err: unknown) {
      error = (err as { error?: string }).error || 'Failed to subscribe';
    } finally {
      subscribeLoading = null;
    }
  }
  
  async function handleUnsubscribe(subscription: Subscription): Promise<void> {
    if (!auth.isAuthenticated) return;
    
    subscribeLoading = subscription.id;
    try {
      await unsubscribeFromMealPlan(subscription.id);
      error = '';
      alert('Unsubscribed successfully');
      // Refresh subscriptions
      subscriptions = await getMySubscriptions();
    } catch (err: unknown) {
      error = (err as { error?: string }).error || 'Failed to unsubscribe';
    } finally {
      subscribeLoading = null;
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
    
    {#if kitchen.location}
      <div class={cn('mb-6')}>
        <h2 class={cn('text-xl font-semibold mb-3')}>Location</h2>
        <MapPicker
          location={kitchen.location}
          height="300px"
          readonly={true}
        />
      </div>
    {/if}
    
    {#if auth.isAuthenticated && auth.user?.role === 'owner' && kitchen?.ownerId === auth.user.id}
      <Card class={cn('p-6 mb-6')}>
        <p class={cn('text-muted-foreground text-center')}>
          You own this kitchen. Manage it from the owner dashboard.
        </p>
      </Card>
    {:else}
      <h2 class={cn('text-2xl font-semibold mb-4')}>Available Meals</h2>
      
      {#if availableMeals.length === 0}
        <Card class={cn('p-6 text-center')}>
          <p class={cn('text-muted-foreground')}>No meals available at this time</p>
        </Card>
      {:else}
        <div class={cn('space-y-6')}>
          {#each Object.entries(mealsByDate) as [date, meals]}
            <Card class={cn('p-6')}>
              <h3 class={cn('text-xl font-semibold mb-4')}>{formatDate(date)}</h3>
              <div class={cn('space-y-4')}>
                {#each meals as meal}
                  {@const subscription = isSubscribed(meal.planId, meal.mealType, meal.dayOfWeek)}
                  {@const deadlinePassed = isDeadlinePassed(meal)}
                  <div class={cn('p-4 border rounded-lg', deadlinePassed && 'opacity-50')}>
                    <div class={cn('flex justify-between items-start mb-3')}>
                      <div>
                        <div class={cn('flex items-center gap-2 mb-1')}>
                          <Badge variant={meal.mealType === 'breakfast' ? 'default' : meal.mealType === 'lunch' ? 'secondary' : 'outline'}>
                            {meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1)}
                          </Badge>
                          <span class={cn('font-semibold')}>{meal.planName}</span>
                        </div>
                        <p class={cn('text-sm text-muted-foreground')}>
                          Order by: {meal.orderDeadline}
                        </p>
                        {#if deadlinePassed}
                          <p class={cn('text-xs text-destructive mt-1')}>Deadline passed</p>
                        {/if}
                      </div>
                      <p class={cn('text-xl font-bold')}>${meal.price}</p>
                    </div>
                    
                    {#if auth.isAuthenticated}
                      <div class={cn('flex gap-2')}>
                        {#if subscription}
                          <Button
                            variant="outline"
                            onclick={() => handleUnsubscribe(subscription)}
                            disabled={subscribeLoading === subscription.id || deadlinePassed}
                            class={cn('flex-1')}
                          >
                            {subscribeLoading === subscription.id ? 'Unsubscribing...' : 'Unsubscribe'}
                          </Button>
                          <Button
                            onclick={() => handleOrder(meal)}
                            disabled={orderLoading === `${meal.planId}-${meal.mealType}-${meal.date}` || deadlinePassed}
                            class={cn('flex-1')}
                          >
                            {orderLoading === `${meal.planId}-${meal.mealType}-${meal.date}` ? 'Ordering...' : 'Order (Additional)'}
                          </Button>
                        {:else}
                          <Button
                            variant="outline"
                            onclick={() => handleSubscribe(meal)}
                            disabled={subscribeLoading === `${meal.planId}-${meal.mealType}-${meal.date}` || deadlinePassed}
                            class={cn('flex-1')}
                          >
                            {subscribeLoading === `${meal.planId}-${meal.mealType}-${meal.date}` ? 'Subscribing...' : 'Subscribe'}
                          </Button>
                          <Button
                            onclick={() => handleOrder(meal)}
                            disabled={orderLoading === `${meal.planId}-${meal.mealType}-${meal.date}` || deadlinePassed}
                            class={cn('flex-1')}
                          >
                            {orderLoading === `${meal.planId}-${meal.mealType}-${meal.date}` ? 'Ordering...' : 'Order'}
                          </Button>
                        {/if}
                      </div>
                    {:else}
                      <Button disabled class={cn('w-full')}>Login to Order</Button>
                    {/if}
                  </div>
                {/each}
              </div>
            </Card>
          {/each}
        </div>
      {/if}
    {/if}
  {/if}
</div>
