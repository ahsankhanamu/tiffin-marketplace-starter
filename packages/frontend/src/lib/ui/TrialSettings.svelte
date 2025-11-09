<script lang="ts">
  import { cn } from '$lib/cn';
  import Button from './Button.svelte';
  import Input from './Input.svelte';
  import Label from './Label.svelte';
  import Card from './Card.svelte';
  import Select from './Select.svelte';

  interface Props {
    trialEnabled?: boolean;
    trialLimit?: number;
    trialPrice?: number;
    trialValidity?: 'first-order' | 'first-week' | 'first-month';
    trialNewCustomersOnly?: boolean;
    regularPrice?: number;
    onUpdate: (settings: {
      trialEnabled: boolean;
      trialLimit?: number;
      trialPrice?: number;
      trialValidity?: 'first-order' | 'first-week' | 'first-month';
      trialNewCustomersOnly: boolean;
    }) => void;
    class?: string;
  }

  let {
    trialEnabled = $bindable(false),
    trialLimit = $bindable(undefined),
    trialPrice = $bindable(undefined),
    trialValidity = $bindable(undefined),
    trialNewCustomersOnly = $bindable(false),
    regularPrice,
    onUpdate,
    class: className = ''
  }: Props = $props();

  function handleUpdate(): void {
    onUpdate({
      trialEnabled,
      trialLimit: trialEnabled ? trialLimit : undefined,
      trialPrice: trialEnabled ? trialPrice : undefined,
      trialValidity: trialEnabled ? trialValidity : undefined,
      trialNewCustomersOnly: trialEnabled ? trialNewCustomersOnly : false
    });
  }

  $effect(() => {
    handleUpdate();
  });
</script>

<Card variant="glass-subtle" class={cn('p-4', className)}>
  <div class={cn('space-y-4')}>
    <div class={cn('flex items-center justify-between')}>
      <Label>Enable Trial Offer</Label>
      <button
        type="button"
        role="switch"
        aria-checked={trialEnabled}
        onclick={() => {
          trialEnabled = !trialEnabled;
          handleUpdate();
        }}
        class={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          trialEnabled ? 'bg-primary' : 'bg-muted',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
        )}
      >
        <span
          class={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
            trialEnabled ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>

    {#if trialEnabled}
      <div class={cn('space-y-4 pt-4 border-t border-border')}>
        <div>
          <Label for="trial-limit">Trial Limit (orders per customer)</Label>
          <Input
            id="trial-limit"
            type="number"
            min="1"
            bind:value={trialLimit}
            placeholder="Leave empty for unlimited"
            oninput={(e) => {
              const value = (e.target as HTMLInputElement).value;
              trialLimit = value ? parseInt(value) : undefined;
              handleUpdate();
            }}
            class={cn('mt-1')}
          />
          <p class={cn('text-xs text-muted-foreground mt-1')}>
            Number of trial orders allowed per customer. Leave empty for unlimited during validity period.
          </p>
        </div>

        <div>
          <Label for="trial-price">Trial Price</Label>
          <Input
            id="trial-price"
            type="number"
            min="0"
            step="0.01"
            bind:value={trialPrice}
            placeholder="0.00 (leave empty for free)"
            oninput={(e) => {
              const value = (e.target as HTMLInputElement).value;
              trialPrice = value ? parseFloat(value) : undefined;
              handleUpdate();
            }}
            class={cn('mt-1')}
          />
          <p class={cn('text-xs text-muted-foreground mt-1')}>
            {regularPrice !== undefined && trialPrice !== undefined && trialPrice > regularPrice && (
              <span class={cn('text-destructive')}>
              Warning: Trial price ({trialPrice}) is higher than regular price ({regularPrice})
            </span>
            )}
            {trialPrice === undefined || trialPrice === 0
              ? 'Leave empty or set to 0 for free trial'
              : `Trial price: $${trialPrice}`}
          </p>
        </div>

        <div>
          <Label for="trial-validity">Trial Validity Period</Label>
          <Select
            id="trial-validity"
            bind:value={trialValidity}
            onchange={(e) => {
              trialValidity = (e.target as HTMLSelectElement).value as typeof trialValidity;
              handleUpdate();
            }}
            class={cn('mt-1')}
          >
            <option value="">Select validity period</option>
            <option value="first-order">First Order Only</option>
            <option value="first-week">First Week</option>
            <option value="first-month">First Month</option>
          </Select>
        </div>

        <div class={cn('flex items-center gap-2')}>
          <input
            type="checkbox"
            id="trial-new-customers"
            checked={trialNewCustomersOnly}
            onchange={(e) => {
              trialNewCustomersOnly = (e.target as HTMLInputElement).checked;
              handleUpdate();
            }}
            class={cn('rounded border-input')}
          />
          <Label for="trial-new-customers" class={cn('cursor-pointer')}>
            Only allow trials for new customers
          </Label>
        </div>
      </div>
    {/if}
  </div>
</Card>

