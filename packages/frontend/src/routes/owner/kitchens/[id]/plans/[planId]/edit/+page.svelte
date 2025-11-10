<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { getKitchen, getMealPlan, updateMealPlan, updateSchedule, type Kitchen, type MealPlan, type MealPlanSchedule, type MenuItem } from '$lib/api';
  import Button from '$lib/ui/Button.svelte';
  import Card from '$lib/ui/Card.svelte';
  import Input from '$lib/ui/Input.svelte';
  import Label from '$lib/ui/Label.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import { cn } from '$lib/cn';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import ImagePicker from '$lib/ui/ImagePicker.svelte';
  import { Plus, X, Upload, Trash2, ChevronDown } from '$lib/icons';
  import { apiBase } from '$lib/api/api';
  import type { Image } from '$lib/api';

  let kitchen = $state<Kitchen | null>(null);
  let mealPlan = $state<MealPlan | null>(null);
  let loading = $state(true);
  let error = $state('');
  let saving = $state(false);

  // Basic plan info
  let planName = $state('');
  let description = $state('');
  let price = $state('0');
  let billingCycle = $state<'daily' | 'weekly' | 'monthly' | 'one-off'>('one-off');
  let billingCycleOpen = $state(false);
  
  const billingCycleOptions = [
    { value: 'one-off', label: 'One-off' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' }
  ];
  
  let selectedBillingCycle = $derived(billingCycleOptions.find(o => o.value === billingCycle) || billingCycleOptions[0]);

  // Meal types (breakfast, lunch, dinner)
  let selectedMealTypes = $state<Set<'breakfast' | 'lunch' | 'dinner'>>(new Set(['lunch', 'dinner']));

  // Days of week selection (default: Monday-Friday, i.e., 1-5)
  let selectedDays = $state<Set<number>>(new Set([1, 2, 3, 4, 5]));

  // Weekly schedule
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

  // Schedule data: [dayOfWeek][mealType] -> schedule
  let scheduleData = $state<Record<number, Record<string, Partial<MealPlanSchedule>>>>({});

  // Menu items for each day/meal
  let menuItems = $state<Record<string, MenuItem[]>>({});

  function getScheduleKey(dayOfWeek: number, mealType: string): string {
    return `${dayOfWeek}-${mealType}`;
  }

  function getSchedule(dayOfWeek: number, mealType: string): Partial<MealPlanSchedule> {
    // Pure getter - don't mutate state
    const planId = $page.params.planId || mealPlan?.id || '';
    if (!scheduleData[dayOfWeek] || !scheduleData[dayOfWeek][mealType]) {
      // Return default schedule without mutating
      return {
        mealPlanId: planId,
        dayOfWeek,
        mealType: mealType as 'breakfast' | 'lunch' | 'dinner',
        isAvailable: false,
        orderDeadline: '10:00',
        menuItems: []
      };
    }
    return scheduleData[dayOfWeek][mealType];
  }

  function ensureSchedule(dayOfWeek: number, mealType: string): void {
    // Initialize schedule if it doesn't exist (call this when needed, not in template)
    const planId = $page.params.planId || mealPlan?.id || '';
    if (!scheduleData[dayOfWeek]) {
      scheduleData = { ...scheduleData, [dayOfWeek]: {} };
    }
    if (!scheduleData[dayOfWeek][mealType]) {
      scheduleData[dayOfWeek] = {
        ...scheduleData[dayOfWeek],
        [mealType]: {
          mealPlanId: planId,
          dayOfWeek,
          mealType: mealType as 'breakfast' | 'lunch' | 'dinner',
          isAvailable: false,
          orderDeadline: '10:00',
          menuItems: []
        }
      };
    }
  }

  function updateScheduleData(dayOfWeek: number, mealType: string, updates: Partial<MealPlanSchedule>): void {
    ensureSchedule(dayOfWeek, mealType);
    scheduleData[dayOfWeek][mealType] = {
      ...getSchedule(dayOfWeek, mealType),
      ...updates
    };
  }

  function toggleMealType(mealType: 'breakfast' | 'lunch' | 'dinner'): void {
    if (selectedMealTypes.has(mealType)) {
      selectedMealTypes.delete(mealType);
      // Remove schedules for this meal type
      daysOfWeek.forEach(day => {
        if (scheduleData[day.value]?.[mealType]) {
          delete scheduleData[day.value][mealType];
        }
        const key = getScheduleKey(day.value, mealType);
        if (menuItems[key]) {
          delete menuItems[key];
        }
      });
    } else {
      selectedMealTypes.add(mealType);
    }
    selectedMealTypes = new Set(selectedMealTypes);
  }

  function toggleDay(dayValue: number): void {
    if (selectedDays.has(dayValue)) {
      selectedDays.delete(dayValue);
      // Remove schedules for this day
      selectedMealTypes.forEach(mealType => {
        if (scheduleData[dayValue]?.[mealType]) {
          delete scheduleData[dayValue][mealType];
        }
        const key = getScheduleKey(dayValue, mealType);
        if (menuItems[key]) {
          delete menuItems[key];
        }
      });
      // Clean up empty day object
      if (scheduleData[dayValue] && Object.keys(scheduleData[dayValue]).length === 0) {
        const { [dayValue]: _, ...rest } = scheduleData;
        scheduleData = rest;
      }
    } else {
      selectedDays.add(dayValue);
    }
    selectedDays = new Set(selectedDays);
  }

  function addMenuItem(dayOfWeek: number, mealType: string): void {
    const key = getScheduleKey(dayOfWeek, mealType);
    if (!menuItems[key]) menuItems[key] = [];
    menuItems[key] = [
      ...menuItems[key],
      { name: '', quantity: '', description: '', image: '', allergens: [], tags: [] }
    ];
    updateScheduleData(dayOfWeek, mealType, { menuItems: menuItems[key] });
  }

  function removeMenuItem(dayOfWeek: number, mealType: string, index: number): void {
    const key = getScheduleKey(dayOfWeek, mealType);
    if (menuItems[key]) {
      menuItems[key] = menuItems[key].filter((_, i) => i !== index);
      updateScheduleData(dayOfWeek, mealType, { menuItems: menuItems[key] });
    }
  }

  function updateMenuItem(dayOfWeek: number, mealType: string, index: number, updates: Partial<MenuItem>): void {
    const key = getScheduleKey(dayOfWeek, mealType);
    if (menuItems[key]) {
      menuItems[key][index] = { ...menuItems[key][index], ...updates };
      updateScheduleData(dayOfWeek, mealType, { menuItems: menuItems[key] });
    }
  }

  let imagePickerOpen = $state(false);
  let imagePickerContext = $state<{ dayOfWeek: number; mealType: string; itemIndex: number } | null>(null);

  function openImagePicker(dayOfWeek: number, mealType: string, itemIndex: number): void {
    imagePickerContext = { dayOfWeek, mealType, itemIndex };
    imagePickerOpen = true;
  }

  function handleImageSelect(image: Image): void {
    if (!imagePickerContext) return;
    const { dayOfWeek, mealType, itemIndex } = imagePickerContext;
    // Store image ID and URL
    updateMenuItem(dayOfWeek, mealType, itemIndex, { 
      image: image.id, 
      imageUrl: `${apiBase}${image.url}` 
    });
    imagePickerOpen = false;
    imagePickerContext = null;
  }

  async function handleSave(): Promise<void> {
    const planId = $page.params.planId;
    const kitchenId = $page.params.id;
    
    if (!kitchen || !mealPlan || !planId || !kitchenId) {
      error = 'Missing required information. Please refresh the page.';
      return;
    }
    
    // Validation: Check if at least one day is selected
    if (selectedDays.size === 0) {
      error = 'Please select at least one day for the meal plan';
      return;
    }

    // Validation: Check if at least one meal type is selected
    if (selectedMealTypes.size === 0) {
      error = 'Please select at least one meal type';
      return;
    }
    
    saving = true;
    error = '';

    try {
      // Update basic plan info
      await updateMealPlan(kitchenId, planId, {
        name: planName,
        description,
        price: parseFloat(price) || 0,
        billingCycle
      });

      // Prepare schedules for API (only for selected days)
      const schedules: Partial<MealPlanSchedule>[] = [];
      daysOfWeek
        .filter(day => selectedDays.has(day.value))
        .forEach(day => {
          selectedMealTypes.forEach(mealType => {
            const schedule = scheduleData[day.value]?.[mealType] || getSchedule(day.value, mealType);
            if (schedule?.isAvailable) {
            schedules.push({
              dayOfWeek: day.value,
              mealType: mealType as 'breakfast' | 'lunch' | 'dinner',
              isAvailable: true,
              orderDeadline: schedule.orderDeadline || '10:00',
              menuItems: menuItems[getScheduleKey(day.value, mealType)] || [],
              price: schedule.price,
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              deliveryStart: schedule.deliveryStart,
              deliveryEnd: schedule.deliveryEnd,
              maxOrders: schedule.maxOrders
            });
          }
        });
      });

      // Update schedules
      if (schedules.length > 0) {
        await updateSchedule(planId, schedules as MealPlanSchedule[]);
      } else {
        // If no schedules, clear all
        await updateSchedule(planId, []);
      }

      // Navigate back
      goto(`/owner/kitchens/${kitchenId}`);
    } catch (err: unknown) {
      error = (err as { error?: string }).error || 'Failed to save meal plan';
    } finally {
      saving = false;
    }
  }

  onMount(async () => {
    const kitchenId = $page.params.id;
    const planId = $page.params.planId;

    try {
      [kitchen, mealPlan] = await Promise.all([
        getKitchen(kitchenId),
        getMealPlan(kitchenId, planId)
      ]);

      // Initialize form data with existing meal plan values
      if (mealPlan) {
        // Ensure all fields are properly populated from the meal plan
        planName = String(mealPlan.name || '');
        description = String(mealPlan.description || '');
        price = mealPlan.price != null && !isNaN(mealPlan.price) ? String(mealPlan.price) : '0';
        billingCycle = (mealPlan.billingCycle && ['daily', 'weekly', 'monthly', 'one-off'].includes(mealPlan.billingCycle))
          ? (mealPlan.billingCycle as 'daily' | 'weekly' | 'monthly' | 'one-off')
          : 'one-off';
      }

      // Initialize meal types and days from existing schedules
      if (mealPlan.schedules) {
        mealPlan.schedules.forEach(schedule => {
          selectedMealTypes.add(schedule.mealType);
          selectedDays.add(schedule.dayOfWeek);
          const day = schedule.dayOfWeek;
          const mealType = schedule.mealType;
          
          if (!scheduleData[day]) scheduleData[day] = {};
          scheduleData[day][mealType] = {
            ...schedule,
            menuItems: schedule.menuItems || []
          };

          // Load menu items
          const key = getScheduleKey(day, mealType);
          if (schedule.menuItems !== null && schedule.menuItems !== undefined) {
            if (Array.isArray(schedule.menuItems)) {
              menuItems[key] = schedule.menuItems as MenuItem[];
            } else {
              // If it's not an array, initialize as empty
              menuItems[key] = [];
            }
          } else {
            // If menuItems is null/undefined, initialize as empty array
            menuItems[key] = [];
          }
        });
      }

      selectedMealTypes = new Set(selectedMealTypes);
      selectedDays = new Set(selectedDays);
    } catch (err: unknown) {
      error = (err as { error?: string }).error || 'Failed to load meal plan';
    } finally {
      loading = false;
    }
  });

  // Reactive effect to update form fields when mealPlan changes
  $effect(() => {
    if (mealPlan && !loading) {
      // Always populate form fields from mealPlan when it's available
      planName = String(mealPlan.name || '');
      description = String(mealPlan.description || '');
      price = mealPlan.price != null && !isNaN(mealPlan.price) ? String(mealPlan.price) : '0';
      if (mealPlan.billingCycle && ['daily', 'weekly', 'monthly', 'one-off'].includes(mealPlan.billingCycle)) {
        billingCycle = mealPlan.billingCycle as 'daily' | 'weekly' | 'monthly' | 'one-off';
      }
    }
  });
</script>

<div class={cn('container mx-auto p-6 max-w-7xl')}>
  {#if loading}
    <p>Loading...</p>
  {:else if error && !kitchen}
    <div class={cn('text-red-500')}>{error}</div>
  {:else if kitchen && mealPlan}
    <div class={cn('space-y-6')}>
      <!-- Header -->
      <div class={cn('flex items-center justify-between')}>
        <div>
          <h1 class={cn('text-3xl font-bold')}>Edit Meal Plan</h1>
          <p class={cn('text-muted-foreground mt-1')}>{kitchen.title}</p>
        </div>
        <Button variant="outline" onclick={() => goto(`/owner/kitchens/${kitchen.id}`)}>
          Cancel
        </Button>
      </div>

      {#if error}
        <div class={cn('bg-destructive/10 text-destructive p-4 rounded-lg')}>{error}</div>
      {/if}

      <!-- Basic Info -->
      <Card class={cn('p-6')}>
        <h2 class={cn('text-xl font-semibold mb-4')}>Basic Information</h2>
        <div class={cn('grid gap-4 md:grid-cols-2')}>
          <div>
            <Label for="name">Plan Name</Label>
            <Input id="name" bind:value={planName} class={cn('mt-1')} />
          </div>
          <div>
            <Label for="price">Price</Label>
            <Input id="price" type="number" bind:value={price} class={cn('mt-1')} />
          </div>
          <div>
            <Label for="billing">Billing Cycle</Label>
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
        <div class={cn('mt-4')}>
          <Label for="description">Description</Label>
          <textarea
            id="description"
            bind:value={description}
            class={cn('flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1')}
            placeholder="Describe your meal plan..."
          />
        </div>
      </Card>

      <!-- Meal Type and Days Selection -->
      <Card class={cn('p-6')}>
        <div class={cn('flex items-start justify-between gap-6 flex-wrap')}>
          <div class={cn('flex-1 min-w-[200px]')}>
            <h2 class={cn('text-xl font-semibold mb-4')}>Meal Types</h2>
            <p class={cn('text-sm text-muted-foreground mb-4')}>Select which meals you provide</p>
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
          </div>
          
          <div class={cn('flex-1 min-w-[200px]')}>
            <h2 class={cn('text-xl font-semibold mb-4')}>Days of Week</h2>
            <p class={cn('text-sm text-muted-foreground mb-4')}>Select which days you provide meals (at least one day required)</p>
            <div class={cn('flex flex-wrap gap-3')}>
              {#each daysOfWeek as day}
                {@const isSelected = selectedDays.has(day.value)}
                <button
                  type="button"
                  class={cn(
                    'px-4 py-2 rounded-lg border-2 transition-all text-sm',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
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
        </div>
      </Card>

      <!-- Weekly Schedule -->
      <Card class={cn('p-6')}>
        <h2 class={cn('text-xl font-semibold mb-4')}>Weekly Schedule & Menu</h2>
        <p class={cn('text-sm text-muted-foreground mb-6')}>Set availability and menu for each day</p>
        
        <div class={cn('overflow-x-auto')}>
          <table class={cn('w-full border-collapse')}>
            <thead>
              <tr>
                <th class={cn('p-3 text-left border-b border-border font-semibold')}>Day</th>
                {#each Array.from(selectedMealTypes) as mealType}
                  <th class={cn('p-3 text-center border-b border-border font-semibold')}>
                    {mealTypeLabels[mealType]}
                  </th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each daysOfWeek.filter(day => selectedDays.has(day.value)) as day}
                <tr>
                  <td class={cn('p-3 border-b border-border font-medium')}>{day.short}</td>
                  {#each Array.from(selectedMealTypes) as mealType}
                    {@const schedule = getSchedule(day.value, mealType)}
                    {@const key = getScheduleKey(day.value, mealType)}
                    <td class={cn('p-3 border-b border-border')}>
                      <div class={cn('space-y-4')}>
                        {#if !schedule.isAvailable}
                          <!-- Add Button -->
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onclick={() => updateScheduleData(day.value, mealType, { isAvailable: true })}
                            class={cn('w-auto min-w-[80px]')}
                          >
                            <Plus class={cn('w-4 h-4 mr-1')} />
                            Add
                          </Button>
                        {:else}
                          <!-- Remove Button -->
                          <div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onclick={() => updateScheduleData(day.value, mealType, { isAvailable: false })}
                              class={cn('w-auto min-w-[80px]')}
                            >
                              <X class={cn('w-4 h-4 mr-1')} />
                              Remove
                            </Button>
                          </div>

                          <!-- Order Deadline -->
                          <div>
                            <Label for="deadline-{day.value}-{mealType}" class={cn('text-xs')}>Order Deadline</Label>
                            <Input
                              id="deadline-{day.value}-{mealType}"
                              type="time"
                              value={schedule.orderDeadline || '10:00'}
                              onchange={(e) => updateScheduleData(day.value, mealType, { orderDeadline: e.currentTarget.value })}
                              class={cn('h-8 text-xs mt-1')}
                            />
                          </div>

                          <!-- Menu Items -->
                          <div>
                            <div class={cn('flex items-center justify-between mb-2')}>
                              <Label class={cn('text-xs')}>Menu Items</Label>
                              <button
                                type="button"
                                onclick={() => addMenuItem(day.value, mealType)}
                                class={cn('text-xs text-primary hover:underline')}
                              >
                                <Plus class={cn('size-3 inline')} /> Add
                              </button>
                            </div>
                            <div class={cn('space-y-3')}>
                              {#if menuItems[key]}
                                {#each menuItems[key] as item, index}
                                  <div class={cn('p-2 bg-muted rounded text-xs space-y-1')}>
                                    <div class={cn('flex items-center justify-between')}>
                                      <Input
                                        placeholder="Item name"
                                        value={item.name || ''}
                                        onchange={(e) => updateMenuItem(day.value, mealType, index, { name: e.currentTarget.value })}
                                        class={cn('h-7 text-xs')}
                                      />
                                      <button
                                        type="button"
                                        onclick={() => removeMenuItem(day.value, mealType, index)}
                                        class={cn('text-destructive ml-1')}
                                      >
                                        <Trash2 class={cn('size-3')} />
                                      </button>
                                    </div>
                                    <Input
                                      placeholder="Quantity"
                                      value={item.quantity || ''}
                                      onchange={(e) => updateMenuItem(day.value, mealType, index, { quantity: e.currentTarget.value })}
                                      class={cn('h-7 text-xs')}
                                    />
                                    <textarea
                                      placeholder="Description"
                                      value={item.description || ''}
                                      onchange={(e) => updateMenuItem(day.value, mealType, index, { description: e.currentTarget.value })}
                                      class={cn('h-12 text-xs w-full rounded border border-input bg-background px-2 py-1')}
                                    />
                                    {#if item.imageUrl}
                                      <div class={cn('relative')}>
                                        <img src={item.imageUrl} alt={item.name} class={cn('w-full h-20 object-cover rounded')} />
                                        <button
                                          type="button"
                                          onclick={() => openImagePicker(day.value, mealType, index)}
                                          class={cn('absolute top-1 right-1 p-1 rounded bg-background/80 hover:bg-background transition-colors')}
                                        >
                                          <Upload class={cn('size-3')} />
                                        </button>
                                      </div>
                                    {:else}
                                      <button
                                        type="button"
                                        onclick={() => openImagePicker(day.value, mealType, index)}
                                        class={cn('flex items-center gap-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors')}
                                      >
                                        <Upload class={cn('size-3')} />
                                        <span>Upload Image</span>
                                      </button>
                                    {/if}
                                  </div>
                                {/each}
                              {/if}
                            </div>
                          </div>
                        {/if}
                      </div>
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </Card>

      <!-- Save Button -->
      <div class={cn('flex justify-end gap-3')}>
        <Button variant="outline" onclick={() => goto(`/owner/kitchens/${kitchen.id}`)}>
          Cancel
        </Button>
        <Button 
          onclick={handleSave} 
          disabled={saving || selectedDays.size === 0 || selectedMealTypes.size === 0}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
      {#if selectedDays.size === 0 || selectedMealTypes.size === 0}
        <p class={cn('text-sm text-muted-foreground text-center')}>
          Please select at least one day and one meal type to save the meal plan
        </p>
      {/if}
    </div>
  {/if}
</div>

<!-- Image Picker Modal -->
<ImagePicker bind:open={imagePickerOpen} onSelect={handleImageSelect} />

