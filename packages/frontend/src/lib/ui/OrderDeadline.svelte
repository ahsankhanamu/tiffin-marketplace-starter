<script lang="ts">
  import { cn } from '$lib/cn';
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    deadline: string;
    scheduledDate: string;
    class?: string;
  }

  let { deadline, scheduledDate, class: className = '' }: Props = $props();

  let timeRemaining = $state<{ hours: number; minutes: number; seconds: number } | null>(null);
  let isExpired = $state(false);
  let status = $state<'open' | 'closing-soon' | 'closed'>('open');

  function calculateTimeRemaining(): void {
    const now = new Date();
    const [deadlineHour, deadlineMinute] = deadline.split(':').map(Number);
    const deadlineDate = new Date(scheduledDate);
    deadlineDate.setHours(deadlineHour, deadlineMinute, 0, 0);

    const diff = deadlineDate.getTime() - now.getTime();

    if (diff <= 0) {
      isExpired = true;
      status = 'closed';
      timeRemaining = null;
      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    timeRemaining = { hours, minutes, seconds };

    if (hours < 1) {
      status = 'closing-soon';
    } else {
      status = 'open';
    }
  }

  let interval: number | null = null;

  onMount(() => {
    calculateTimeRemaining();
    interval = setInterval(calculateTimeRemaining, 1000) as unknown as number;
  });

  onDestroy(() => {
    if (interval) {
      clearInterval(interval);
    }
  });
</script>

<div class={cn('space-y-2', className)}>
  {#if isExpired}
    <div class={cn('flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20')}>
      <div class={cn('size-2 rounded-full bg-destructive')}></div>
      <p class={cn('text-sm font-medium text-destructive')}>
        Order deadline has passed. Orders must be placed by {deadline}
      </p>
    </div>
  {:else if timeRemaining}
    <div
      class={cn(
        'flex items-center gap-2 p-3 rounded-lg border transition-colors',
        status === 'open' && 'bg-success/10 border-success/20',
        status === 'closing-soon' && 'bg-warning/10 border-warning/20'
      )}
    >
      <div
        class={cn(
          'size-2 rounded-full',
          status === 'open' && 'bg-success',
          status === 'closing-soon' && 'bg-warning'
        )}
      ></div>
      <div class={cn('flex-1')}>
        <p
          class={cn(
            'text-sm font-medium',
            status === 'open' && 'text-success',
            status === 'closing-soon' && 'text-warning'
          )}
        >
          Orders must be placed by {deadline}
        </p>
        <p class={cn('text-xs text-muted-foreground')}>
          {timeRemaining.hours > 0
            ? `${timeRemaining.hours}h ${timeRemaining.minutes}m ${timeRemaining.seconds}s remaining`
            : `${timeRemaining.minutes}m ${timeRemaining.seconds}s remaining`}
        </p>
      </div>
    </div>
  {/if}
</div>

