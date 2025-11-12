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
  import * as Dialog from '$lib/components/ui/dialog';
  
  let kitchen = $state<Kitchen | null>(null);
  let availableMeals = $state<AvailableMeal[]>([]);
  let subscriptions = $state<Subscription[]>([]);
  let loading = $state(true);
  let error = $state('');
  let orderLoading = $state<string | null>(null);
  let subscribeLoading = $state<string | null>(null);
  
  // Order dialog state
  let orderDialogOpen = $state(false);
  let selectedPlanForOrder = $state<{ planId: string; planName: string; planPrice: number; billingCycle: string; meals: AvailableMeal[]; availableMealTypes: Set<'breakfast' | 'lunch' | 'dinner'> } | null>(null);
  let selectedMealTypes = $state<Set<'breakfast' | 'lunch' | 'dinner'>>(new Set());
  let selectedOrderDate = $state<string | null>(null);
  let deadlineTimer = $state<{ hours: number; minutes: number; seconds: number } | null>(null);
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  
  // Calculate per-meal price from plan price for a single day order
  // Formula: (plan price per day) / (3 meals per day) * 1.2
  // IMPORTANT: Orders are for ONE DAY ONLY, so we calculate price per day first
  function calculatePerMealPrice(planPrice: number, billingCycle: string): number {
    if (!planPrice || planPrice <= 0) return 0;
    
    let daysInCycle: number;
    switch (billingCycle) {
      case 'daily':
        daysInCycle = 1;
        break;
      case 'weekly':
        daysInCycle = 7;
        break;
      case 'biweekly':
        daysInCycle = 14;
        break;
      case 'monthly':
        daysInCycle = 30;
        break;
      case 'one-off':
        daysInCycle = 1;
        break;
      default:
        daysInCycle = 30; // Default to monthly
    }
    
    // Step 1: Calculate price per day (for a single day order)
    const pricePerDay = planPrice / daysInCycle;
    
    // Step 2: Calculate price per meal (assuming 3 meals per day: breakfast, lunch, dinner)
    const pricePerMeal = pricePerDay / 3;
    
    // Step 3: Add 20% markup for individual orders
    const finalPrice = pricePerMeal * 1.2;
    
    // Round to 2 decimal places
    return Math.round(finalPrice * 100) / 100;
  }
  
  // Get price for a specific meal type
  function getMealPrice(mealType: 'breakfast' | 'lunch' | 'dinner'): number {
    if (!selectedPlanForOrder || !selectedOrderDate) return 0;
    
    // Find meal for the selected date and meal type
    const meal = selectedPlanForOrder.meals.find(m => 
      m.mealType === mealType && 
      m.date === selectedOrderDate
    );
    
    // If owner has set a specific price for this meal, use it
    if (meal?.schedulePrice !== null && meal?.schedulePrice !== undefined && meal.schedulePrice > 0) {
      return meal.schedulePrice;
    }
    
    // Otherwise, calculate per-meal price from plan price for a single day order
    // This ensures orders are priced for ONE DAY ONLY, not the entire billing cycle
    const calculatedPrice = calculatePerMealPrice(selectedPlanForOrder.planPrice, selectedPlanForOrder.billingCycle);
    
    // Ensure we're not returning the plan price by mistake
    // The calculated price should be much smaller than the plan price
    if (calculatedPrice > selectedPlanForOrder.planPrice) {
      console.error('Price calculation error: calculated price is larger than plan price!', {
        planPrice: selectedPlanForOrder.planPrice,
        billingCycle: selectedPlanForOrder.billingCycle,
        calculatedPrice
      });
      // Fallback: return a reasonable default
      return selectedPlanForOrder.planPrice / 30 / 3 * 1.2;
    }
    
    return calculatedPrice;
  }
  
  // Get total price for all selected meals
  const totalOrderPrice = $derived.by(() => {
    if (!selectedPlanForOrder || selectedMealTypes.size === 0) return 0;
    
    let total = 0;
    for (const mealType of selectedMealTypes) {
      total += getMealPrice(mealType);
    }
    return total;
  });
  
  // Find the next available date that has all selected meal types available
  const findNextAvailableDate = $derived.by(() => {
    if (!selectedPlanForOrder || selectedMealTypes.size === 0) return selectedOrderDate;
    
    // Get all unique dates from meals
    const dates = [...new Set(selectedPlanForOrder.meals.map(m => m.date))].sort();
    
    for (const date of dates) {
      // Check if all selected meal types are available for this date and deadline hasn't passed
      const mealsForDate = selectedPlanForOrder.meals.filter(m => m.date === date);
      const availableMealTypes = new Set(
        mealsForDate
          .filter(m => !isDeadlinePassed(m))
          .map(m => m.mealType)
      );
      
      // Check if all selected meal types are available
      let allAvailable = true;
      for (const mealType of selectedMealTypes) {
        if (!availableMealTypes.has(mealType)) {
          allAvailable = false;
          break;
        }
      }
      
      if (allAvailable) {
        return date;
      }
    }
    
    return null;
  });
  
  // Update selectedOrderDate when meal types change to ensure all selected meals are for the same day
  $effect(() => {
    if (selectedMealTypes.size > 0) {
      const nextDate = findNextAvailableDate;
      if (nextDate && nextDate !== selectedOrderDate) {
        selectedOrderDate = nextDate;
        updateDeadlineTimer(); // Update timer when date changes
      }
    }
  });
  
  // Check if a meal type is available (not past deadline) for the selected date
  function isMealTypeAvailable(mealType: 'breakfast' | 'lunch' | 'dinner'): boolean {
    if (!selectedPlanForOrder || !selectedOrderDate) return false;
    
    const meal = selectedPlanForOrder.meals.find(m => 
      m.mealType === mealType && 
      m.date === selectedOrderDate
    );
    
    if (!meal) return false;
    
    // Check if deadline has passed
    return !isDeadlinePassed(meal);
  }
  
  let auth = $derived.by(() => $authStore);
  
  // Group meals by meal plan
  const mealsByPlan = $derived.by(() => {
    const grouped: Record<string, {
      planId: string;
      planName: string;
      planPrice: number;
      billingCycle: string;
      meals: AvailableMeal[];
      mealTypes: Set<'breakfast' | 'lunch' | 'dinner'>;
      days: Set<number>;
      price: number;
    }> = {};
    
    if (!availableMeals || availableMeals.length === 0) {
      console.log('No available meals to group');
      return grouped;
    }
    
    console.log('Grouping meals, count:', availableMeals.length);
    
    for (const meal of availableMeals) {
      if (meal && meal.planId) {
        if (!grouped[meal.planId]) {
          // Get meal plan details from kitchen object
          const mealPlan = kitchen?.mealPlans?.find(mp => mp.id === meal.planId);
          
          grouped[meal.planId] = {
            planId: meal.planId,
            planName: meal.planName,
            planPrice: meal.price, // This is the plan price from available-meals
            billingCycle: mealPlan?.billingCycle || 'monthly',
            meals: [],
            mealTypes: new Set(),
            days: new Set(),
            price: meal.price // Plan price for display
          };
        }
        grouped[meal.planId].meals.push(meal);
        grouped[meal.planId].mealTypes.add(meal.mealType);
        grouped[meal.planId].days.add(meal.dayOfWeek);
      }
    }
    
    console.log('Grouped plans:', Object.keys(grouped).length);
    console.log('Grouped data:', grouped);
    
    return grouped;
  });

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

  const billingCycleLabels: Record<string, string> = {
    'daily': 'Daily',
    'weekly': 'Weekly',
    'biweekly': 'Bi-weekly',
    'monthly': 'Monthly',
    'one-off': 'One-time'
  };

  // Currency detection (similar to owner view)
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
    if (typeof window === 'undefined') return 'USD';
    try {
      const locale = navigator.language || navigator.languages?.[0] || 'en-US';
      const region = locale.split('-')[1];
      const currencyMap: Record<string, string> = {
        'AE': 'AED', 'IN': 'INR', 'NP': 'NPR', 'US': 'USD', 'GB': 'GBP',
        'SA': 'SAR', 'PK': 'PKR', 'BD': 'BDT', 'SG': 'SGD', 'EU': 'EUR'
      };
      if (region && currencyMap[region]) {
        return currencyMap[region];
      }
      return 'USD';
    } catch {
      return 'USD';
    }
  }

  const defaultCurrency = $derived(() => {
    return commonCurrencies.find(c => c.code === detectBrowserCurrency()) || commonCurrencies[0];
  });

  function formatPrice(price: number): string {
    const currency = defaultCurrency();
    return `${currency.symbol}${price.toFixed(2)}`;
  }
  
  // Check if user is subscribed to a meal plan
  // Note: Subscriptions are tied to meal plans (planId), not kitchens
  // Relationship: Subscription → MealPlan → Kitchen
  function isSubscribed(planId: string, mealType: string, dayOfWeek?: number): Subscription | null {
    return subscriptions.find(sub => 
      sub.mealPlanId === planId && 
      sub.mealType === mealType &&
      (dayOfWeek === undefined || sub.dayOfWeek === dayOfWeek || sub.dayOfWeek === null)
    ) || null;
  }
  
  // Format date for display
  function formatDate(dateStr: string): string {
    if (!dateStr) return 'Unknown Date';
    
    // Handle YYYY-MM-DD format (add time to avoid timezone issues)
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) {
      console.error('Invalid date string:', dateStr);
      return dateStr;
    }
    
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
    if (!id) {
      error = 'Kitchen ID is required';
      loading = false;
      return;
    }
    
    try {
      const [kitchenData, mealsData] = await Promise.all([
        getKitchen(id),
        getAvailableMeals(id, 7)
      ]);
      
      kitchen = kitchenData;
      availableMeals = Array.isArray(mealsData) ? mealsData : [];
      
      // Debug logging
      console.log('Available meals loaded:', availableMeals.length);
      console.log('Available meals data:', availableMeals);
      
      // Load user's subscriptions (tied to meal plans, not kitchens)
      // Relationship: Subscription → MealPlan → Kitchen
      if (auth.isAuthenticated) {
        subscriptions = await getMySubscriptions();
      }
    } catch (err: unknown) {
      console.error('Error loading kitchen data:', err);
      error = (err as { error?: string }).error || 'Failed to load kitchen';
    } finally {
      loading = false;
    }
  });
  
  // Determine pre-selected meal type based on current time
  function getPreselectedMealType(availableTypes: Set<'breakfast' | 'lunch' | 'dinner'>): 'breakfast' | 'lunch' | 'dinner' | null {
    const now = new Date();
    const hour = now.getHours();
    
    // Breakfast: 6 AM - 11 AM
    // Lunch: 11 AM - 4 PM
    // Dinner: 4 PM - 10 PM
    // After 10 PM or before 6 AM, default to next meal
    
    let preselected: 'breakfast' | 'lunch' | 'dinner' | null = null;
    
    if (hour >= 6 && hour < 11) {
      preselected = 'breakfast';
    } else if (hour >= 11 && hour < 16) {
      preselected = 'lunch';
    } else if (hour >= 16 && hour < 22) {
      preselected = 'dinner';
    } else {
      // After 10 PM or before 6 AM, default to breakfast (next day)
      preselected = 'breakfast';
    }
    
    // If preselected type is not available, use first available type
    if (preselected && availableTypes.has(preselected)) {
      return preselected;
    }
    
    // Return first available type
    if (availableTypes.has('breakfast')) return 'breakfast';
    if (availableTypes.has('lunch')) return 'lunch';
    if (availableTypes.has('dinner')) return 'dinner';
    
    return null;
  }

  function openOrderDialog(planData: { planId: string; planName: string; planPrice: number; billingCycle: string; meals: AvailableMeal[]; mealTypes: Set<'breakfast' | 'lunch' | 'dinner'> }): void {
    if (!auth.isAuthenticated) {
      error = 'Please login to place an order';
      return;
    }
    
    selectedPlanForOrder = {
      planId: planData.planId,
      planName: planData.planName,
      planPrice: planData.planPrice,
      billingCycle: planData.billingCycle,
      meals: planData.meals,
      availableMealTypes: planData.mealTypes
    };
    
    // Find the next available date
    const dates = [...new Set(planData.meals.map(m => m.date))].sort();
    selectedOrderDate = dates[0] || null;
    
    // Pre-select meal type based on current time (if available)
    const preselected = getPreselectedMealType(planData.mealTypes);
    selectedMealTypes = new Set();
    if (preselected && selectedOrderDate) {
      const meal = planData.meals.find(m => m.mealType === preselected && m.date === selectedOrderDate);
      if (meal && !isDeadlinePassed(meal)) {
        selectedMealTypes.add(preselected);
      }
    }
    
    orderDialogOpen = true;
    updateDeadlineTimer();
  }
  
  // Calculate time remaining until deadline
  function updateDeadlineTimer(): void {
    if (!selectedPlanForOrder || !selectedOrderDate || selectedMealTypes.size === 0) {
      deadlineTimer = null;
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      return;
    }
    
    // Find the earliest deadline from selected meal types
    let earliestDeadline: Date | null = null;
    
    for (const mealType of selectedMealTypes) {
      const meal = selectedPlanForOrder.meals.find(m => 
        m.mealType === mealType && 
        m.date === selectedOrderDate
      );
      
      if (meal && !isDeadlinePassed(meal)) {
        const [deadlineHour, deadlineMin] = meal.orderDeadline.split(':').map(Number);
        const deadline = new Date(meal.date);
        deadline.setHours(deadlineHour, deadlineMin, 0, 0);
        
        if (!earliestDeadline || deadline < earliestDeadline) {
          earliestDeadline = deadline;
        }
      }
    }
    
    if (!earliestDeadline) {
      deadlineTimer = null;
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      return;
    }
    
    // Calculate time remaining
    const now = new Date();
    const diff = earliestDeadline.getTime() - now.getTime();
    
    if (diff <= 0) {
      deadlineTimer = { hours: 0, minutes: 0, seconds: 0 };
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      return;
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    deadlineTimer = { hours, minutes, seconds };
    
    // Set up interval to update timer every second
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    timerInterval = setInterval(() => {
      updateDeadlineTimer();
    }, 1000);
  }
  
  // Update timer when meal types or date change
  $effect(() => {
    if (orderDialogOpen && selectedMealTypes.size > 0 && selectedOrderDate) {
      updateDeadlineTimer();
    }
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    };
  });

  async function handleOrder(): Promise<void> {
    if (!auth.isAuthenticated || !kitchen || !selectedPlanForOrder || selectedMealTypes.size === 0 || !selectedOrderDate) {
      return;
    }
    
    // Verify all selected meal types are available for the selected date
    const mealsForDate = selectedPlanForOrder.meals.filter(m => m.date === selectedOrderDate);
    const availableMealTypes = new Set(
      mealsForDate
        .filter(m => !isDeadlinePassed(m))
        .map(m => m.mealType)
    );
    
    // Check if all selected meal types are available
    for (const mealType of selectedMealTypes) {
      if (!availableMealTypes.has(mealType)) {
        error = `Meal type ${mealType} is no longer available for the selected date`;
        return;
      }
    }
    
    orderLoading = `${selectedPlanForOrder.planId}-${Array.from(selectedMealTypes).join(',')}`;
    try {
      const scheduledDate = new Date(selectedOrderDate);
      scheduledDate.setHours(12, 0, 0, 0);
      
      // Create order for each selected meal type
      const orderPromises = [];
      for (const mealType of selectedMealTypes) {
        const mealPrice = getMealPrice(mealType);
        orderPromises.push(
          createOrder(kitchen.id, selectedPlanForOrder.planId, mealPrice, {
            mealType,
            scheduledDate: scheduledDate.toISOString()
          })
        );
      }
      
      await Promise.all(orderPromises);
      
      error = '';
      alert(`Order placed successfully! ${selectedMealTypes.size} meal(s) ordered.`);
      orderDialogOpen = false;
      selectedPlanForOrder = null;
      selectedMealTypes = new Set();
      selectedOrderDate = null;
      
      // Refresh available meals
      availableMeals = await getAvailableMeals(kitchen.id, 7);
    } catch (err: unknown) {
      error = (err as { error?: string }).error || 'Failed to place order';
    } finally {
      orderLoading = null;
    }
  }
  
  // Subscribe to a meal plan
  // Note: Users subscribe to meal plans (meal.planId), not kitchens
  // Relationship: Subscription → MealPlan → Kitchen
  async function handleSubscribe(meal: AvailableMeal): Promise<void> {
    if (!auth.isAuthenticated) {
      error = 'Please login to subscribe';
      return;
    }
    
    subscribeLoading = `${meal.planId}-${meal.mealType}-${meal.date}`;
    try {
      // Subscribe to the meal plan (not the kitchen)
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
  
  // Unsubscribe from a meal plan
  // Note: Users unsubscribe from meal plans, not kitchens
  // Relationship: Subscription → MealPlan → Kitchen
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
      
      {#if loading}
        <Card class={cn('p-6 text-center')}>
          <p class={cn('text-muted-foreground')}>Loading meals...</p>
        </Card>
      {:else if availableMeals.length === 0}
        <Card class={cn('p-6 text-center')}>
          <p class={cn('text-muted-foreground')}>No meals available at this time</p>
        </Card>
      {:else}
        {@const planEntries = Object.values(mealsByPlan)}
        {#if planEntries.length === 0}
          <Card class={cn('p-6 text-center')}>
            <p class={cn('text-muted-foreground')}>No meal plans available</p>
            <p class={cn('text-xs text-muted-foreground mt-2')}>
              Debug: Available meals: {availableMeals.length}, Grouped plans: {Object.keys(mealsByPlan).length}
            </p>
          </Card>
        {:else}
          <div class={cn('space-y-6')}>
            {#each planEntries as planData}
            {@const hasSubscription = subscriptions.some(sub => sub.mealPlanId === planData.planId && sub.isActive)}
            {@const planSubscription = subscriptions.find(sub => sub.mealPlanId === planData.planId && sub.isActive)}
            <Card class={cn('p-6')}>
              <div class={cn('flex justify-between items-start mb-4')}>
                <div class={cn('flex-1')}>
                  <h3 class={cn('text-xl font-semibold mb-3')}>{planData.planName}</h3>
                  
                  <!-- Meal Types Pills -->
                  <div class={cn('flex flex-wrap gap-2 mb-3')}>
                    {#each ['breakfast', 'lunch', 'dinner'] as mealType}
                      {@const isAvailable = planData.mealTypes.has(mealType as 'breakfast' | 'lunch' | 'dinner')}
                      <span
                        class={cn(
                          'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors',
                          isAvailable
                            ? mealType === 'breakfast'
                              ? 'bg-primary text-primary-foreground'
                              : mealType === 'lunch'
                              ? 'bg-secondary text-secondary-foreground'
                              : 'border border-input bg-transparent hover:bg-accent'
                            : 'border border-input bg-transparent opacity-50 cursor-not-allowed'
                        )}
                      >
                        {mealTypeLabels[mealType as keyof typeof mealTypeLabels]}
                      </span>
                    {/each}
                  </div>
                  
                  <!-- Days of Week Pills -->
                  <div class={cn('flex flex-wrap gap-2 mb-4')}>
                    {#each daysOfWeek as day}
                      {@const isAvailable = planData.days.has(day.value)}
                      <span
                        class={cn(
                          'inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-medium transition-colors min-h-[44px] w-[44px]',
                          isAvailable
                            ? 'bg-primary text-primary-foreground'
                            : 'border border-input bg-transparent opacity-50 cursor-not-allowed'
                        )}
                      >
                        {day.short}
                      </span>
                    {/each}
                  </div>
                </div>
                
                <!-- Price and Billing Cycle -->
                <div class={cn('text-right ml-4')}>
                  <p class={cn('text-2xl font-bold')}>{formatPrice(planData.price)}</p>
                  {#if planData.billingCycle}
                    <span
                      class={cn(
                        'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-accent text-accent-foreground mt-2'
                      )}
                    >
                      {billingCycleLabels[planData.billingCycle] || planData.billingCycle}
                    </span>
                  {/if}
                </div>
              </div>
              
              <!-- Subscribe/Unsubscribe and Order Buttons -->
              {#if auth.isAuthenticated}
                <div class={cn('flex gap-2 pt-4 border-t border-border')}>
                  {#if hasSubscription && planSubscription}
                    <Button
                      variant="outline"
                      onclick={() => handleUnsubscribe(planSubscription)}
                      disabled={subscribeLoading === planSubscription.id}
                      class={cn('flex-1')}
                    >
                      {subscribeLoading === planSubscription.id ? 'Unsubscribing...' : 'Unsubscribe'}
                    </Button>
                  {:else}
                    <Button
                      variant="outline"
                      onclick={() => {
                        // Subscribe to the first available meal type and day
                        const firstMeal = planData.meals[0];
                        if (firstMeal) {
                          handleSubscribe(firstMeal);
                        }
                      }}
                      disabled={subscribeLoading !== null || planData.meals.length === 0}
                      class={cn('flex-1')}
                    >
                      {subscribeLoading !== null ? 'Subscribing...' : 'Subscribe'}
                    </Button>
                  {/if}
                  <Button
                    onclick={() => openOrderDialog({
                      planId: planData.planId,
                      planName: planData.planName,
                      planPrice: planData.planPrice,
                      billingCycle: planData.billingCycle,
                      meals: planData.meals,
                      mealTypes: planData.mealTypes
                    })}
                    disabled={planData.meals.length === 0}
                    class={cn('flex-1')}
                  >
                    Order
                  </Button>
                </div>
              {:else}
                <div class={cn('pt-4 border-t border-border')}>
                  <Button disabled class={cn('w-full')}>Login to Order</Button>
                </div>
              {/if}
            </Card>
            {/each}
          </div>
        {/if}
      {/if}
    {/if}
  {/if}

  <!-- Order Dialog -->
  <Dialog.Root bind:open={orderDialogOpen}>
    <Dialog.Content class={cn('max-w-md')}>
      <Dialog.Header>
        <Dialog.Title>Place Order</Dialog.Title>
        <Dialog.Description>
          {selectedPlanForOrder ? `Order from ${selectedPlanForOrder.planName}` : 'Select meal details'}
        </Dialog.Description>
      </Dialog.Header>
      
      {#if selectedPlanForOrder && selectedOrderDate}
        <div class={cn('space-y-6 py-4')}>
          <!-- Deadline Timer -->
          {#if deadlineTimer}
            <div class={cn('p-4 rounded-lg border-2', deadlineTimer.hours === 0 && deadlineTimer.minutes < 30 ? 'border-destructive bg-destructive/10' : 'border-primary bg-primary/10')}>
              <p class={cn('text-xs font-medium mb-2 text-muted-foreground')}>Time remaining to place order</p>
              <div class={cn('flex items-center gap-2')}>
                <span class={cn('text-2xl font-bold tabular-nums')}>
                  {String(deadlineTimer.hours).padStart(2, '0')}:
                  {String(deadlineTimer.minutes).padStart(2, '0')}:
                  {String(deadlineTimer.seconds).padStart(2, '0')}
                </span>
                <span class={cn('text-sm text-muted-foreground')}>
                  {deadlineTimer.hours > 0 ? `${deadlineTimer.hours}h ` : ''}
                  {deadlineTimer.minutes > 0 ? `${deadlineTimer.minutes}m ` : ''}
                  {deadlineTimer.seconds}s
                </span>
              </div>
            </div>
          {/if}
          
          <!-- Meal Type Selection (Multiple) -->
          <div>
            <p class={cn('text-sm font-medium mb-3 block')}>Select Meal Types</p>
            <div class={cn('flex flex-wrap gap-2')}>
              {#each ['breakfast', 'lunch', 'dinner'] as mealType}
                {@const mealTypeKey = mealType as 'breakfast' | 'lunch' | 'dinner'}
                {@const isAvailable = isMealTypeAvailable(mealTypeKey)}
                {@const isSelected = selectedMealTypes.has(mealTypeKey)}
                <button
                  type="button"
                  onclick={() => {
                    if (isAvailable) {
                      if (isSelected) {
                        selectedMealTypes.delete(mealTypeKey);
                      } else {
                        selectedMealTypes.add(mealTypeKey);
                      }
                      selectedMealTypes = new Set(selectedMealTypes); // Trigger reactivity
                      updateDeadlineTimer(); // Update timer when selection changes
                    }
                  }}
                  disabled={!isAvailable}
                  class={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    isSelected && isAvailable
                      ? 'bg-primary text-primary-foreground'
                      : isAvailable
                      ? 'border-2 border-input bg-background hover:bg-accent hover:text-accent-foreground'
                      : 'border-2 border-input bg-background opacity-50 cursor-not-allowed'
                  )}
                >
                  {mealTypeLabels[mealTypeKey]}
                  {#if isSelected}
                    <span class={cn('ml-2')}>✓</span>
                  {/if}
                </button>
              {/each}
            </div>
            {#if selectedMealTypes.size === 0}
              <p class={cn('text-xs text-destructive mt-2')}>Please select at least one meal type</p>
            {:else if !findNextAvailableDate}
              <p class={cn('text-xs text-warning mt-2')}>Selected meals are not all available for the same date</p>
            {/if}
          </div>
          
          <!-- Price Breakdown and Total -->
          {#if selectedMealTypes.size > 0}
            <div class={cn('pt-4 border-t border-border space-y-2')}>
              {#each Array.from(selectedMealTypes) as mealType}
                <div class={cn('flex justify-between items-center text-sm')}>
                  <span class={cn('text-muted-foreground')}>{mealTypeLabels[mealType]}</span>
                  <span class={cn('font-medium')}>{formatPrice(getMealPrice(mealType))}</span>
                </div>
              {/each}
              <div class={cn('flex justify-between items-center pt-2 border-t border-border')}>
                <span class={cn('text-sm font-medium')}>Total ({selectedMealTypes.size} meal{selectedMealTypes.size > 1 ? 's' : ''})</span>
                <span class={cn('text-xl font-bold')}>
                  {formatPrice(totalOrderPrice)}
                </span>
              </div>
            </div>
          {/if}
        </div>
      {/if}
      
      <Dialog.Footer>
        <Button
          variant="outline"
          onclick={() => {
            orderDialogOpen = false;
            selectedPlanForOrder = null;
            selectedMealTypes = new Set();
            selectedOrderDate = null;
            deadlineTimer = null;
            if (timerInterval) {
              clearInterval(timerInterval);
              timerInterval = null;
            }
          }}
          disabled={orderLoading !== null}
        >
          Cancel
        </Button>
        <Button
          onclick={handleOrder}
          disabled={orderLoading !== null || selectedMealTypes.size === 0 || !selectedPlanForOrder || !selectedOrderDate}
        >
          {orderLoading !== null ? 'Ordering...' : `Place Order (${selectedMealTypes.size} meal${selectedMealTypes.size > 1 ? 's' : ''})`}
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
</div>
