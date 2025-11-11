<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { getKitchen, createMealPlan, deleteMealPlan, getKitchenOrders, updateOrderStatus, updateKitchen, type Kitchen, type MealPlan, type Order } from '$lib/api';
  import { authStore } from '$lib/stores/auth';
  import { initSocket, socketStore } from '$lib/stores/socket';
  import Button from '$lib/ui/Button.svelte';
  import Card from '$lib/ui/Card.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import Input from '$lib/ui/Input.svelte';
  import Label from '$lib/ui/Label.svelte';
  import MapPicker from '$lib/ui/MapPicker.svelte';
  import { cn } from '$lib/cn';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { Trash2, Menu, ShoppingBag, Plus, ChevronDown } from '$lib/icons';
  import { browser } from '$app/environment';
  
  let kitchen = $state<Kitchen | null>(null);
  let mealPlans = $state<MealPlan[]>([]);
  let orders = $state<Order[]>([]);
  let loading = $state(true);
  let error = $state('');
  let showPlanForm = $state(false);
  let planName = $state('');
  let price = $state('');
  let billingCycle = $state<'daily' | 'weekly' | 'monthly' | 'one-off'>('one-off');
  
  // Currency selection
  const commonCurrencies = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
    { code: 'NPR', name: 'Nepalese Rupee', symbol: '₨' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
    { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨' },
    { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' }
  ];
  
  function detectBrowserCurrency(): string {
    if (!browser) return 'USD';
    try {
      const locale = navigator.language || navigator.languages?.[0] || 'en-US';
      
      // Try to get currency from locale region
      const region = locale.split('-')[1];
      const currencyMap: Record<string, string> = {
        'AE': 'AED', 'IN': 'INR', 'NP': 'NPR', 'US': 'USD', 'GB': 'GBP',
        'SA': 'SAR', 'PK': 'PKR', 'BD': 'BDT', 'SG': 'SGD', 'EU': 'EUR'
      };
      
      if (region && currencyMap[region]) {
        return currencyMap[region];
      }
      
      // Try Intl API to detect currency
      try {
        // Get currency from locale using Intl.NumberFormat
        const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' });
        const resolved = formatter.resolvedOptions();
        if (resolved.currency && commonCurrencies.find(c => c.code === resolved.currency)) {
          return resolved.currency;
        }
      } catch {}
      
      return 'USD';
    } catch {
      return 'USD';
    }
  }
  
  let selectedCurrency = $state(commonCurrencies.find(c => c.code === detectBrowserCurrency()) || commonCurrencies[0]);
  let currencyDropdownOpen = $state(false);
  let billingCycleOpen = $state(false);
  let deleteDialogOpen = $state(false);
  
  const billingCycleOptions = [
    { value: 'one-off', label: 'One-off' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' }
  ];
  
  let selectedBillingCycle = $derived(billingCycleOptions.find(o => o.value === billingCycle) || billingCycleOptions[0]);
  let planToDelete = $state<MealPlan | null>(null);
  let deleting = $state(false);
  let socket = $derived.by(() => $socketStore);
  
  // Location editing
  let locationEditingEnabled = $state(false);
  let locationLat = $state<number | null>(null);
  let locationLng = $state<number | null>(null);
  let updatingLocation = $state(false);
  
  // Meal type and day selection
  let selectedMealTypes = $state<Set<'breakfast' | 'lunch' | 'dinner'>>(new Set(['lunch', 'dinner']));
  let selectedDays = $state<Set<number>>(new Set([1, 2, 3, 4, 5])); // Monday-Friday by default
  
  const daysOfWeek = [
    { value: 0, label: 'Sunday', short: 'Sun' },
    { value: 1, label: 'Monday', short: 'Mon' },
    { value: 2, label: 'Tuesday', short: 'Tue' },
    { value: 3, label: 'Wednesday', short: 'Wed' },
    { value: 4, label: 'Thursday', short: 'Thu' },
    { value: 5, label: 'Friday', short: 'Fri' },
    { value: 6, label: 'Saturday', short: 'Sat' }
  ];
  
  const mealTypeLabels = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner'
  };
  
  function toggleMealType(mealType: 'breakfast' | 'lunch' | 'dinner'): void {
    if (selectedMealTypes.has(mealType)) {
      selectedMealTypes.delete(mealType);
    } else {
      selectedMealTypes.add(mealType);
    }
    selectedMealTypes = new Set(selectedMealTypes);
  }
  
  function toggleDay(day: number): void {
    if (selectedDays.has(day)) {
      selectedDays.delete(day);
    } else {
      selectedDays.add(day);
    }
    selectedDays = new Set(selectedDays);
  }
  
  let auth = $derived.by(() => $authStore);
  
  async function handleCreatePlan(): Promise<void> {
    if (!kitchen) return;
    
    if (selectedMealTypes.size === 0) {
      error = 'Please select at least one meal type';
      return;
    }
    
    if (selectedDays.size === 0) {
      error = 'Please select at least one day';
      return;
    }
    
    try {
      const newPlan = await createMealPlan(kitchen.id, {
        name: planName,
        price: parseFloat(price),
        billingCycle,
        availableDays: Array.from(selectedDays).map(d => daysOfWeek[d].label)
      });
      
      // After creating the plan, redirect to edit page to set up schedules
      mealPlans = await getMealPlans(kitchen.id);
      showPlanForm = false;
      planName = '';
      price = '';
      billingCycle = 'one-off';
      selectedMealTypes = new Set(['lunch', 'dinner']);
      selectedDays = new Set([1, 2, 3, 4, 5]);
      
      // Redirect to edit page to configure schedules
      goto(`/owner/kitchens/${kitchen.id}/plans/${newPlan.id}/edit`);
    } catch (err: unknown) {
      error = (err as { error?: string }).error || 'Failed to create plan';
    }
  }
  
  onMount(async () => {
    const id = $page.params.id;
    if (!id) {
      error = 'Kitchen ID is required';
      loading = false;
      return;
    }
    
    if (auth.token) {
      initSocket(auth.token);
    }
    
    try {
      kitchen = await getKitchen(id);
      if (kitchen) {
        // Use mealPlans from kitchen object (already included in API response)
        mealPlans = kitchen.mealPlans || [];
        await loadOrders();
        if (kitchen.location) {
          locationLat = kitchen.location.lat;
          locationLng = kitchen.location.lng;
        }
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

  function getOrdersForPlan(planId: string): Order[] {
    return orders.filter(order => order.planId === planId);
  }

  function getOrdersInTimeWindow(planOrders: Order[], plan: MealPlan): Order[] {
    if (!plan.startTime || !plan.endTime) {
      return planOrders;
    }

    const [startHour, startMin] = plan.startTime.split(':').map(Number);
    const [endHour, endMin] = plan.endTime.split(':').map(Number);
    
    return planOrders.filter(order => {
      const orderDate = new Date(order.createdAt);
      const orderHour = orderDate.getHours();
      const orderMin = orderDate.getMinutes();
      const orderTimeInMinutes = orderHour * 60 + orderMin;
      const startTimeInMinutes = startHour * 60 + startMin;
      const endTimeInMinutes = endHour * 60 + endMin;
      
      // Handle case where end time is next day (e.g., 22:00 - 02:00)
      if (endTimeInMinutes <= startTimeInMinutes) {
        // Time window spans midnight
        return orderTimeInMinutes >= startTimeInMinutes || orderTimeInMinutes <= endTimeInMinutes;
      } else {
        // Normal time window (same day)
        return orderTimeInMinutes >= startTimeInMinutes && orderTimeInMinutes <= endTimeInMinutes;
      }
    });
  }

  function getOrderCountForPlan(plan: MealPlan): number {
    const planOrders = getOrdersForPlan(plan.id);
    const ordersInWindow = getOrdersInTimeWindow(planOrders, plan);
    return ordersInWindow.length;
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
    const planId = planToDelete.id;
    deleting = true;
    try {
      await deleteMealPlan(kitchen.id, planId);
      mealPlans = mealPlans.filter(p => p.id !== planId);
      deleteDialogOpen = false;
      planToDelete = null;
    } catch (err) {
      console.error('Failed to delete meal plan:', err);
      error = 'Failed to delete meal plan. Please try again.';
    } finally {
      deleting = false;
    }
  }
  
  function handleLocationSelect(lat: number, lng: number): void {
    locationLat = lat;
    locationLng = lng;
  }
  
  async function handleUpdateLocation(): Promise<void> {
    if (!kitchen || locationLat === null || locationLng === null) return;
    
    updatingLocation = true;
    try {
      await updateKitchen(kitchen.id, {
        lat: locationLat,
        lng: locationLng
      });
      if (kitchen.location) {
        kitchen.location.lat = locationLat;
        kitchen.location.lng = locationLng;
      } else {
        kitchen.location = { lat: locationLat, lng: locationLng };
      }
      locationEditingEnabled = false;
      error = '';
    } catch (err: unknown) {
      error = (err as { error?: string }).error || 'Failed to update location';
    } finally {
      updatingLocation = false;
    }
  }
  
  function handleCancelLocationEdit(): void {
    if (kitchen?.location) {
      locationLat = kitchen.location.lat;
      locationLng = kitchen.location.lng;
    }
    locationEditingEnabled = false;
  }
</script>

<div class={cn('container mx-auto p-6 max-w-6xl')}>
  {#if loading}
    <p>Loading...</p>
  {:else if kitchen}
    <h1 class={cn('text-3xl font-bold mb-6')}>{kitchen.title}</h1>
    
    {#if error}
      <div class={cn('mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm')}>
        {error}
      </div>
    {/if}
    
    <!-- Location Editing Section -->
    <Card class={cn('p-6 mb-6')}>
      <div class={cn('flex items-center justify-between mb-4')}>
        <div>
          <h2 class={cn('text-xl font-semibold mb-1')}>Kitchen Location</h2>
          <p class={cn('text-sm text-muted-foreground')}>
            Update your kitchen's location on the map
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={locationEditingEnabled}
          onclick={() => {
            locationEditingEnabled = !locationEditingEnabled;
            if (!locationEditingEnabled) {
              handleCancelLocationEdit();
            }
          }}
          class={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
            locationEditingEnabled ? 'bg-primary' : 'bg-muted',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          )}
        >
          <span
            class={cn(
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
              locationEditingEnabled ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      </div>
      
      {#if locationEditingEnabled}
        <div class={cn('space-y-4')}>
          <MapPicker
            lat={locationLat}
            lng={locationLng}
            location={kitchen.location}
            onLocationSelect={handleLocationSelect}
            enabled={locationEditingEnabled}
            height="400px"
            showCoordinates={true}
          />
          <div class={cn('flex gap-2 justify-end')}>
            <Button
              variant="outline"
              onclick={handleCancelLocationEdit}
              disabled={updatingLocation}
            >
              Cancel
            </Button>
            <Button
              onclick={handleUpdateLocation}
              disabled={updatingLocation || locationLat === null || locationLng === null}
            >
              {updatingLocation ? 'Updating...' : 'Save Location'}
            </Button>
          </div>
        </div>
      {:else if kitchen.location}
        <MapPicker
          location={kitchen.location}
          enabled={false}
          readonly={true}
          height="300px"
          showCoordinates={false}
        />
      {:else}
        <p class={cn('text-sm text-muted-foreground')}>
          No location set. Enable location editing to set your kitchen's location.
        </p>
      {/if}
    </Card>
    
    <div class={cn('grid gap-6 md:grid-cols-2')}>
      <div>
        <div class={cn('flex justify-between items-center mb-4')}>
          <h2 class={cn('text-2xl font-semibold')}>Meal Plans</h2>
          <Button onclick={() => showPlanForm = !showPlanForm} variant="outline">
            {showPlanForm ? 'Cancel' : 'Add Plan'}
          </Button>
        </div>
        
        {#if showPlanForm}
          <Card class={cn('p-6')}>
            <h3 class={cn('text-xl font-semibold mb-4')}>Create Meal Plan</h3>
            <form onsubmit={(e) => { e.preventDefault(); handleCreatePlan(); }} class={cn('space-y-6')}>
              <!-- Basic Info -->
              <div class={cn('space-y-3')}>
                <div>
                  <Label for="plan-name">Plan Name</Label>
                  <Input id="plan-name" bind:value={planName} required class={cn('mt-1')} />
                </div>
                <div class={cn('grid grid-cols-2 gap-3')}>
                  <div>
                    <Label for="price">Price</Label>
                    <div class={cn('relative mt-1 flex')}>
                      <Input 
                        id="price" 
                        type="number" 
                        bind:value={price} 
                        required 
                        class={cn('rounded-r-none border-r-0')} 
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                      <DropdownMenu.DropdownMenu bind:open={currencyDropdownOpen}>
                        <DropdownMenu.DropdownMenuTrigger
                          class={cn(
                            'h-10 px-3 flex items-center justify-center gap-1.5',
                            'border border-input border-l-0 bg-muted/50 hover:bg-muted',
                            'rounded-r-lg text-sm font-semibold text-foreground',
                            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                            'cursor-pointer transition-colors min-w-[80px]'
                          )}
                        >
                          <span>{selectedCurrency.code}</span>
                          <ChevronDown class={cn('w-3.5 h-3.5 transition-transform duration-200', currencyDropdownOpen && 'rotate-180')} />
                        </DropdownMenu.DropdownMenuTrigger>
                        <DropdownMenu.DropdownMenuContent align="end">
                          {#each commonCurrencies as currency}
                            <DropdownMenu.DropdownMenuItem
                              onclick={() => {
                                selectedCurrency = currency;
                                currencyDropdownOpen = false;
                              }}
                              class={cn(
                                selectedCurrency.code === currency.code && 'bg-accent font-medium'
                              )}
                            >
                              <div class={cn('flex items-center justify-between w-full')}>
                                <div class={cn('flex items-center gap-2')}>
                                  <span class={cn('font-semibold')}>{currency.code}</span>
                                  <span class={cn('text-muted-foreground text-xs')}>{currency.symbol}</span>
                                </div>
                                <span class={cn('text-xs text-muted-foreground')}>{currency.name}</span>
                              </div>
                            </DropdownMenu.DropdownMenuItem>
                          {/each}
                        </DropdownMenu.DropdownMenuContent>
                      </DropdownMenu.DropdownMenu>
                    </div>
                  </div>
                  <div>
                    <Label for="cycle">Billing Cycle</Label>
                    <DropdownMenu.DropdownMenu bind:open={billingCycleOpen}>
                      <DropdownMenu.DropdownMenuTrigger
                        class={cn(
                          'w-full h-10 flex items-center justify-between px-3 py-2 text-sm',
                          'rounded-md border border-input bg-background',
                          'hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                          'transition-colors mt-1'
                        )}
                      >
                        <span>{selectedBillingCycle.label}</span>
                        <ChevronDown class={cn('w-4 h-4 text-muted-foreground transition-transform duration-200', billingCycleOpen && 'rotate-180')} />
                      </DropdownMenu.DropdownMenuTrigger>
                      <DropdownMenu.DropdownMenuContent align="end" class={cn('w-(--radix-dropdown-menu-trigger-width)')}>
                        {#each billingCycleOptions as option}
                          <DropdownMenu.DropdownMenuItem
                            onclick={() => {
                              billingCycle = option.value as 'daily' | 'weekly' | 'monthly' | 'one-off';
                              billingCycleOpen = false;
                            }}
                            class={cn(
                              billingCycle === option.value && 'bg-accent font-medium'
                            )}
                          >
                            {option.label}
                          </DropdownMenu.DropdownMenuItem>
                        {/each}
                      </DropdownMenu.DropdownMenuContent>
                    </DropdownMenu.DropdownMenu>
                  </div>
                </div>
              </div>
              
              <!-- Meal Types Selection -->
              <div>
                <Label>Meal Types</Label>
                <p class={cn('text-sm text-muted-foreground mb-3')}>Select which meals you provide</p>
                <div class={cn('flex gap-3')}>
                  {#each ['breakfast', 'lunch', 'dinner'] as mealType}
                    {@const isSelected = selectedMealTypes.has(mealType as 'breakfast' | 'lunch' | 'dinner')}
                    <button
                      type="button"
                      class={cn(
                        'px-4 py-2 rounded-lg border-2 transition-all text-sm',
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary font-semibold'
                          : 'border-border bg-background hover:border-primary/50'
                      )}
                      onclick={() => toggleMealType(mealType as 'breakfast' | 'lunch' | 'dinner')}
                    >
                      {mealTypeLabels[mealType as keyof typeof mealTypeLabels]}
                    </button>
                  {/each}
                </div>
                {#if selectedMealTypes.size === 0}
                  <p class={cn('text-sm text-destructive mt-2')}>⚠️ Please select at least one meal type</p>
                {/if}
              </div>
              
              <!-- Days Selection -->
              <div>
                <Label>Days of Week</Label>
                <p class={cn('text-sm text-muted-foreground mb-3')}>Select which days you provide meals</p>
                <div class={cn('flex flex-wrap gap-2')}>
                  {#each daysOfWeek as day}
                    {@const isSelected = selectedDays.has(day.value)}
                    <button
                      type="button"
                      class={cn(
                        'px-3 py-1.5 rounded-full border-2 transition-all text-xs font-medium',
                        'min-h-[44px] w-[44px] flex items-center justify-center', // Fixed width, centered content, mobile-friendly touch target
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background hover:border-primary/50'
                      )}
                      onclick={() => toggleDay(day.value)}
                    >
                      {day.short}
                    </button>
                  {/each}
                </div>
                {#if selectedDays.size === 0}
                  <p class={cn('text-sm text-destructive mt-2')}>⚠️ Please select at least one day</p>
                {/if}
              </div>
              
              <div class={cn('flex gap-2 pt-2')}>
                <Button type="submit" class={cn('flex-1')}>Create Plan</Button>
                <Button type="button" variant="outline" onclick={() => {
                  showPlanForm = false;
                  planName = '';
                  price = '';
                  billingCycle = 'one-off';
                  selectedMealTypes = new Set(['lunch', 'dinner']);
                  selectedDays = new Set([1, 2, 3, 4, 5]);
                  selectedCurrency = commonCurrencies.find(c => c.code === detectBrowserCurrency()) || commonCurrencies[0];
                  currencyDropdownOpen = false;
                }} class={cn('flex-1')}>Cancel</Button>
              </div>
            </form>
          </Card>
        {:else if mealPlans.length === 0}
          <Card class={cn('p-8 text-center')}>
            <Menu class={cn('w-12 h-12 mx-auto mb-4 text-muted-foreground')} />
            <Button variant="outline" onclick={() => showPlanForm = true}>
              <Plus class={cn('w-4 h-4 mr-2')} />
              Create Your First Meal Plan
            </Button>
          </Card>
        {:else}
          <div class={cn('space-y-4')}>
            {#each mealPlans as plan}
              {@const orderCount = getOrderCountForPlan(plan)}
              {@const planOrders = getOrdersForPlan(plan.id)}
              {@const ordersInWindow = getOrdersInTimeWindow(planOrders, plan)}
              <Card class={cn('p-4')}>
                <div class={cn('space-y-3')}>
                  <div class={cn('flex justify-between items-start')}>
                    <div class={cn('flex-1')}>
                      <h3 class={cn('font-semibold text-lg')}>{plan.name}</h3>
                      <p class={cn('text-sm text-muted-foreground')}>${plan.price} - {plan.billingCycle}</p>
                      {#if plan.description}
                        <p class={cn('text-sm text-muted-foreground mt-1')}>{plan.description}</p>
                      {/if}
                      {#if plan.startTime && plan.endTime}
                        <p class={cn('text-xs text-muted-foreground mt-1')}>
                          Time Window: {plan.startTime} - {plan.endTime}
                        </p>
                      {/if}
                    </div>
                    <div class={cn('flex gap-2')}>
                      <Button
                        variant="outline"
                        onclick={() => {
                          if (kitchen) {
                            goto(`/owner/kitchens/${kitchen.id}/plans/${plan.id}/edit`);
                          }
                        }}
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
                  
                  <!-- Orders List -->
                  <div class={cn('pt-3 border-t border-border')}>
                    <div class={cn('flex items-center justify-between mb-2')}>
                      <p class={cn('text-sm font-medium')}>Orders Received</p>
                      {#if plan.startTime && plan.endTime}
                        <p class={cn('text-xs text-muted-foreground')}>
                          ({plan.startTime} - {plan.endTime})
                        </p>
                      {/if}
                    </div>
                    {#if ordersInWindow.length === 0}
                      <p class={cn('text-sm text-muted-foreground py-2')}>No orders yet</p>
                    {:else}
                      <div class={cn('space-y-2 max-h-48 overflow-y-auto')}>
                        {#each ordersInWindow as order}
                          <div class={cn('flex items-center justify-between p-2 bg-muted rounded text-sm')}>
                            <div class={cn('flex-1')}>
                              <p class={cn('font-medium')}>Order #{order.id.slice(0, 8)}</p>
                              <p class={cn('text-xs text-muted-foreground')}>
                                {new Date(order.createdAt).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                            <div class={cn('text-right')}>
                              <p class={cn('font-semibold')}>${order.amount}</p>
                              <Badge className={cn('text-xs mt-1')}>{order.status}</Badge>
                            </div>
                          </div>
                        {/each}
                      </div>
                      {#if planOrders.length > ordersInWindow.length}
                        <p class={cn('text-xs text-muted-foreground mt-2')}>
                          {planOrders.length - ordersInWindow.length} order(s) outside time window
                        </p>
                      {/if}
                    {/if}
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
          <Card class={cn('p-8 text-center')}>
            <ShoppingBag class={cn('w-12 h-12 mx-auto mb-4 text-muted-foreground')} />
            <p class={cn('text-muted-foreground')}>No orders yet</p>
            <p class={cn('text-sm text-muted-foreground mt-2')}>Orders will appear here when customers place them</p>
          </Card>
        {:else}
          <div class={cn('space-y-4')}>
            {#each orders as order}
              <Card class={cn('p-4')}>
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

