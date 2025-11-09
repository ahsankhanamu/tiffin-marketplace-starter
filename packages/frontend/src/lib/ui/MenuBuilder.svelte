<script lang="ts">
  import { cn } from '$lib/cn';
  import Button from './Button.svelte';
  import Input from './Input.svelte';
  import Label from './Label.svelte';
  import Card from './Card.svelte';
  import { X, Plus } from '$lib/icons';
  import type { MenuItem } from '$lib/api/api';

  interface Props {
    menuItems?: MenuItem[];
    onUpdate: (items: MenuItem[]) => void;
    class?: string;
  }

  let { menuItems = $bindable([]), onUpdate, class: className = '' }: Props = $props();

  const dietaryTags = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'halal', 'kosher'];

  function addItem(): void {
    menuItems = [
      ...menuItems,
      {
        name: '',
        quantity: '',
        description: '',
        allergens: [],
        tags: []
      }
    ];
    onUpdate(menuItems);
  }

  function removeItem(index: number): void {
    menuItems = menuItems.filter((_, i) => i !== index);
    onUpdate(menuItems);
  }

  function updateItem(index: number, field: keyof MenuItem, value: unknown): void {
    menuItems = menuItems.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    });
    onUpdate(menuItems);
  }

  function toggleTag(index: number, tag: string): void {
    const item = menuItems[index];
    const tags = item.tags || [];
    const newTags = tags.includes(tag)
      ? tags.filter((t) => t !== tag)
      : [...tags, tag];
    updateItem(index, 'tags', newTags);
  }

  function toggleAllergen(index: number, allergen: string): void {
    const item = menuItems[index];
    const allergens = item.allergens || [];
    const newAllergens = allergens.includes(allergen)
      ? allergens.filter((a) => a !== allergen)
      : [...allergens, allergen];
    updateItem(index, 'allergens', newAllergens);
  }
</script>

<div class={cn('space-y-4', className)}>
  <div class={cn('flex items-center justify-between')}>
    <Label>Menu Items</Label>
    <Button type="button" variant="outline" size="sm" onclick={addItem}>
      <Plus class="size-4 mr-2" />
      Add Item
    </Button>
  </div>

  <div class={cn('space-y-4')}>
    {#each menuItems as item, index}
      <Card variant="glass-subtle" class={cn('p-4')}>
        <div class={cn('flex items-start justify-between mb-3')}>
          <h4 class={cn('font-medium text-foreground')}>Item {index + 1}</h4>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onclick={() => removeItem(index)}
            class={cn('text-destructive hover:text-destructive')}
          >
            <X class="size-4" />
          </Button>
        </div>

        <div class={cn('space-y-3')}>
          <div class={cn('grid grid-cols-2 gap-3')}>
            <div>
              <Label for={`item-name-${index}`}>Name *</Label>
              <Input
                id={`item-name-${index}`}
                bind:value={item.name}
                placeholder="e.g., Chicken Biryani"
                oninput={(e) => updateItem(index, 'name', (e.target as HTMLInputElement).value)}
                class={cn('mt-1')}
              />
            </div>
            <div>
              <Label for={`item-quantity-${index}`}>Quantity *</Label>
              <Input
                id={`item-quantity-${index}`}
                bind:value={item.quantity}
                placeholder="e.g., 1 plate, 250g"
                oninput={(e) => updateItem(index, 'quantity', (e.target as HTMLInputElement).value)}
                class={cn('mt-1')}
              />
            </div>
          </div>

          <div>
            <Label for={`item-description-${index}`}>Description</Label>
            <textarea
              id={`item-description-${index}`}
              bind:value={item.description}
              placeholder="Describe the item..."
              oninput={(e) => updateItem(index, 'description', (e.target as HTMLTextAreaElement).value)}
              class={cn(
                'flex min-h-[80px] w-full rounded-lg border border-input bg-background',
                'px-3 py-2 text-sm mt-1',
                'ring-offset-background',
                'focus-visible:outline-none focus-visible:ring-2',
                'focus-visible:ring-ring focus-visible:ring-offset-2',
                'placeholder:text-muted-foreground'
              )}
            />
          </div>

          <div>
            <Label>Dietary Tags</Label>
            <div class={cn('flex flex-wrap gap-2 mt-2')}>
              {#each dietaryTags as tag}
                <button
                  type="button"
                  onclick={() => toggleTag(index, tag)}
                  class={cn(
                    'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                    item.tags?.includes(tag)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  )}
                >
                  {tag}
                </button>
              {/each}
            </div>
          </div>

          <div>
            <Label>Allergens</Label>
            <Input
              bind:value={item.allergens?.join(', ') || ''}
              placeholder="e.g., peanuts, shellfish (comma-separated)"
              oninput={(e) => {
                const value = (e.target as HTMLInputElement).value;
                const allergens = value
                  .split(',')
                  .map((a) => a.trim())
                  .filter((a) => a.length > 0);
                updateItem(index, 'allergens', allergens);
              }}
              class={cn('mt-1')}
            />
          </div>
        </div>
      </Card>
    {:else}
      <div
        class={cn(
          'text-center text-muted-foreground py-8',
          'border-2 border-dashed border-border rounded-lg'
        )}
      >
        No menu items added. Click "Add Item" to get started.
      </div>
    {/each}
  </div>
</div>

