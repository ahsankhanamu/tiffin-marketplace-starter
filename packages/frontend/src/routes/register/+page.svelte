<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Button from '$lib/ui/Button.svelte';
  import Input from '$lib/ui/Input.svelte';
  import Select from '$lib/ui/Select.svelte';
  import Label from '$lib/ui/Label.svelte';
  import Card from '$lib/ui/Card.svelte';
  import { register } from '$lib/api';
  import { setAuth, initAuth } from '$lib/stores/auth';
  import { cn } from '$lib/cn';
  
  let email = $state('');
  let password = $state('');
  let name = $state('');
  let role = $state<'user' | 'owner' | 'admin'>('user');
  let error = $state('');
  let loading = $state(false);
  
  onMount(() => {
    initAuth();
  });
  
  async function handleSubmit() {
    error = '';
    loading = true;
    try {
      const result = await register(email, password, name, role);
      setAuth(result.user, result.token);
      goto('/');
    } catch (err: any) {
      error = err.error || 'An error occurred';
    } finally {
      loading = false;
    }
  }
</script>

<div class={cn('flex min-h-screen items-center justify-center p-4')}>
  <Card class={cn('w-full max-w-md p-6')}>
    <h1 class={cn('text-2xl font-bold mb-6')}>Register</h1>
    
    {#if error}
      <div class={cn('mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm')}>
        {error}
      </div>
    {/if}
    
    <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class={cn('space-y-4')}>
      <div>
        <Label for="name">Name</Label>
        <Input
          id="name"
          bind:value={name}
          placeholder="Your name"
          required
          class={cn('mt-1')}
        />
      </div>
      
      <div>
        <Label for="role">Account Type</Label>
        <Select
          id="role"
          bind:value={role}
          class={cn('mt-1')}
        >
          <option value="user">Customer</option>
          <option value="owner">Tiffin Kitchen Owner</option>
          <option value="admin">Admin</option>
        </Select>
      </div>
      
      <div>
        <Label for="email">Email</Label>
        <Input
          id="email"
          type="email"
          bind:value={email}
          placeholder="you@example.com"
          required
          class={cn('mt-1')}
        />
      </div>
      
      <div>
        <Label for="password">Password</Label>
        <Input
          id="password"
          type="password"
          bind:value={password}
          placeholder="••••••••"
          required
          minlength="6"
          class={cn('mt-1')}
        />
        <p class={cn('mt-1 text-xs text-muted-foreground')}>
          Password must be at least 6 characters
        </p>
      </div>
      
      <Button type="submit" disabled={loading} class={cn('w-full')}>
        {loading ? 'Please wait...' : 'Register'}
      </Button>
    </form>
    
    <p class={cn('mt-4 text-center text-sm text-muted-foreground')}>
      Already have an account?{' '}
      <a href="/login" class={cn('text-primary underline')}>
        Login
      </a>
    </p>
  </Card>
</div>

