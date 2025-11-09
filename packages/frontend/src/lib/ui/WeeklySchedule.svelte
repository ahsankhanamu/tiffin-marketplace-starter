<script lang="ts">
  import { cn } from '$lib/cn';
  import Button from './Button.svelte';
  import Input from './Input.svelte';
  import Label from './Label.svelte';
  import Card from './Card.svelte';
  import Select from './Select.svelte';
  import type { MealPlanSchedule } from '$lib/api/api';

  interface Props {
    schedules?: MealPlanSchedule[];
    onUpdate: (schedules: Partial<MealPlanSchedule>[]) => void;
    class?: string;
  }

  let { schedules = [], onUpdate, class: className = '' }: Props = $props();

  const daysOfWeek = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' }
  ];

  const mealTypes: Array<'lunch' | 'dinner'> = ['lunch', 'dinner'];

  function getSchedule(dayOfWeek: number, mealType: 'lunch' | 'dinner'): Partial<MealPlanSchedule> | null {
    return (
      schedules.find((s) => s.dayOfWeek === dayOfWeek && s.mealType === mealType) || null
    );
  }

  function updateSchedule(dayOfWeek: number, mealType: 'lunch' | 'dinner', updates: Partial<MealPlanSchedule>): void {
    const existing = schedules.find((s) => s.dayOfWeek === dayOfWeek && s.mealType === mealType);
    const newSchedules = existing
      ? schedules.map((s) =>
          s.dayOfWeek === dayOfWeek && s.mealType === mealType ? { ...s, ...updates } : s
        )
      : [
          ...schedules,
          {
            dayOfWeek,
            mealType,
            isAvailable: true,
            orderDeadline: '10:00',
            ...updates
          } as Partial<MealPlanSchedule>
        ];
    onUpdate(newSchedules);
  }

  function toggleAvailability(dayOfWeek: number, mealType: 'lunch' | 'dinner'): void {
    const schedule = getSchedule(dayOfWeek, mealType);
    updateSchedule(dayOfWeek, mealType, {
      isAvailable: !schedule?.isAvailable ?? true
    });
  }
</script>

<div class={cn('space-y-4', className)}>
  <div class={cn('flex items-center justify-between')}>
    <Label>Weekly Schedule</Label>
    <p class={cn('text-xs text-muted-foreground')}>
      Set availability, pricing, and deadlines for each day and meal type
    </p>
  </div>

  <div class={cn('space-y-4')}>
    {#each daysOfWeek as day}
      <Card variant="glass-subtle" class={cn('p-4')}>
        <h4 class={cn('font-semibold text-foreground mb-4')}>{day.label}</h4>

        <div class={cn('space-y-4')}>
          {#each mealTypes as mealType}
            {@const schedule = getSchedule(day.value, mealType)}
            <div class={cn('space-y-3 p-3 rounded-lg border border-border')}>
              <div class={cn('flex items-center justify-between')}>
                <Label class={cn('capitalize')}>{mealType}</Label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={schedule?.isAvailable ?? false}
                  onclick={() => toggleAvailability(day.value, mealType)}
                  class={cn(
                    'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                    schedule?.isAvailable ?? false ? 'bg-primary' : 'bg-muted',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  )}
                >
                  <span
                    class={cn(
                      'inline-block h-3 w-3 transform rounded-full bg-white transition-transform',
                      schedule?.isAvailable ?? false ? 'translate-x-5' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>

              {#if schedule?.isAvailable ?? false}
                <div class={cn('grid grid-cols-2 gap-3')}>
                  <div>
                    <Label for={`${day.value}-${mealType}-price`}>Price Override</Label>
                    <Input
                      id={`${day.value}-${mealType}-price`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={schedule?.price?.toString() || ''}
                      placeholder="Use plan default"
                      oninput={(e) => {
                        const value = (e.target as HTMLInputElement).value;
                        updateSchedule(day.value, mealType, {
                          price: value ? parseFloat(value) : undefined
                        });
                      }}
                      class={cn('mt-1')}
                    />
                  </div>
                  <div>
                    <Label for={`${day.value}-${mealType}-deadline`}>Order Deadline *</Label>
                    <Input
                      id={`${day.value}-${mealType}-deadline`}
                      type="time"
                      value={schedule?.orderDeadline || '10:00'}
                      oninput={(e) => {
                        updateSchedule(day.value, mealType, {
                          orderDeadline: (e.target as HTMLInputElement).value
                        });
                      }}
                      class={cn('mt-1')}
                    />
                  </div>
                </div>

                <div class={cn('grid grid-cols-2 gap-3')}>
                  <div>
                    <Label for={`${day.value}-${mealType}-start`}>Service Start</Label>
                    <Input
                      id={`${day.value}-${mealType}-start`}
                      type="time"
                      value={schedule?.startTime || ''}
                      placeholder="e.g., 12:00"
                      oninput={(e) => {
                        updateSchedule(day.value, mealType, {
                          startTime: (e.target as HTMLInputElement).value || undefined
                        });
                      }}
                      class={cn('mt-1')}
                    />
                  </div>
                  <div>
                    <Label for={`${day.value}-${mealType}-end`}>Service End</Label>
                    <Input
                      id={`${day.value}-${mealType}-end`}
                      type="time"
                      value={schedule?.endTime || ''}
                      placeholder="e.g., 14:00"
                      oninput={(e) => {
                        updateSchedule(day.value, mealType, {
                          endTime: (e.target as HTMLInputElement).value || undefined
                        });
                      }}
                      class={cn('mt-1')}
                    />
                  </div>
                </div>

                <div>
                  <Label for={`${day.value}-${mealType}-max`}>Max Orders</Label>
                  <Input
                    id={`${day.value}-${mealType}-max`}
                    type="number"
                    min="1"
                    value={schedule?.maxOrders?.toString() || ''}
                    placeholder="Unlimited"
                    oninput={(e) => {
                      const value = (e.target as HTMLInputElement).value;
                      updateSchedule(day.value, mealType, {
                        maxOrders: value ? parseInt(value) : undefined
                      });
                    }}
                    class={cn('mt-1')}
                  />
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </Card>
    {/each}
  </div>
</div>

