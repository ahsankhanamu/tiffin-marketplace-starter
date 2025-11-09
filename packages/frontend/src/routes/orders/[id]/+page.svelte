<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { getOrder, type Order } from '$lib/api';
  import { authStore } from '$lib/stores/auth';
  import { initSocket, socketStore } from '$lib/stores/socket';
  import Card from '$lib/ui/Card.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import { cn } from '$lib/cn';
  
  let order = $state<Order | null>(null);
  let loading = $state(true);
  let socket = $derived.by(() => $socketStore);
  let auth = $derived.by(() => $authStore);
  
  onMount(async () => {
    const id = $page.params.id;
    if (auth.token) {
      initSocket(auth.token);
    }
    
    try {
      order = await getOrder(id);
    } catch (err) {
      console.error(err);
    } finally {
      loading = false;
    }
    
    if (socket) {
      socket.on('order:status', ({ orderId, status }: { orderId: string; status: Order['status'] }) => {
        if (orderId === id && order) {
          order.status = status;
        }
      });
    }
  });
  
  const statusColors: Record<Order['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
    created: 'default',
    preparing: 'secondary',
    'out-for-delivery': 'secondary',
    delivered: 'default'
  };
</script>

<div class={cn('container mx-auto p-6 max-w-2xl')}>
  {#if loading}
    <p>Loading...</p>
  {:else if order}
    <h1 class={cn('text-3xl font-bold mb-6')}>Order Details</h1>
    
    <Card className={cn('p-6')}>
      <div class={cn('space-y-4')}>
        <div class={cn('flex justify-between items-start')}>
          <div>
            <p class={cn('text-sm text-muted-foreground')}>Order ID</p>
            <p class={cn('font-mono text-sm')}>{order.id}</p>
          </div>
          <Badge variant={statusColors[order.status]}>{order.status}</Badge>
        </div>
        
        <div>
          <p class={cn('text-sm text-muted-foreground')}>Amount</p>
          <p class={cn('text-2xl font-bold')}>${order.amount}</p>
        </div>
        
        {#if order.kitchen}
          <div>
            <p class={cn('text-sm text-muted-foreground')}>Tiffin Kitchen</p>
            <p class={cn('font-semibold')}>{order.kitchen.title}</p>
          </div>
        {/if}
        
        <div>
          <p class={cn('text-sm text-muted-foreground')}>Order Date</p>
          <p>{new Date(order.createdAt).toLocaleString()}</p>
        </div>
      </div>
    </Card>
  {/if}
</div>

