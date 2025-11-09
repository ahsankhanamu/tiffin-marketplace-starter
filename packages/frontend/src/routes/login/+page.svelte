<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Button from '$lib/ui/Button.svelte';
  import Input from '$lib/ui/Input.svelte';
  import Label from '$lib/ui/Label.svelte';
  import Card from '$lib/ui/Card.svelte';
  import { login } from '$lib/api';
  import { setAuth, initAuth } from '$lib/stores/auth';
  import { cn } from '$lib/cn';
  
  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);
  
  onMount(() => {
    initAuth();
  });
  
  async function handleSubmit() {
    error = '';
    loading = true;
    try {
      const result = await login(email, password);
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
    <h1 class={cn('text-2xl font-bold mb-6')}>Login</h1>
    
    {#if error}
      <div class={cn('mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm')}>
        {error}
      </div>
    {/if}
    
    <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class={cn('space-y-4')}>
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
          class={cn('mt-1')}
        />
      </div>
      
      <Button type="submit" disabled={loading} class={cn('w-full')}>
        {loading ? 'Please wait...' : 'Login'}
      </Button>
    </form>
    
    <div class={cn('mt-4 space-y-2 text-center text-sm')}>
      <p class={cn('text-muted-foreground')}>
        Don't have an account?{' '}
        <a href="/register" class={cn('text-primary underline')}>
          Register
        </a>
      </p>
      <p class={cn('text-muted-foreground')}>
        <a href="/forgot-password" class={cn('text-primary underline')}>
          Forgot password?
        </a>
      </p>
    </div>
  </Card>
</div>
