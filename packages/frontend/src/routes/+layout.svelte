<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { theme } from '$lib/stores/theme';
  import { initAuth } from '$lib/stores/auth';
  import Sidebar from '$lib/ui/Sidebar.svelte';
  import { cn } from '$lib/cn';
  import '../app.css';

  // Initialize auth synchronously if in browser
  if (browser) {
    initAuth();
  }

  onMount(() => {
    theme.init();
    // Auth already initialized above, but ensure it's done
    if (browser) {
      initAuth();
    }
  });

  function getPageTitle(): string {
    const path = $page.url.pathname;
    
    // Route-based titles
    if (path === '/') return 'Tiffin Marketplace';
    if (path === '/profile') return 'Profile';
    if (path === '/login') return 'Login';
    if (path === '/register') return 'Register';
    if (path === '/forgot-password') return 'Forgot Password';
    if (path.startsWith('/owner')) {
      if (path === '/owner') return 'My Kitchens';
      if (path.includes('/kitchens/new')) return 'New Kitchen';
      if (path.includes('/kitchens/')) return 'Edit Kitchen';
      return 'Kitchen Owner Dashboard';
    }
    if (path.startsWith('/admin')) return 'Admin Dashboard';
    if (path.startsWith('/kitchens/')) return 'Kitchen Details';
    if (path.startsWith('/orders/')) return 'Order Details';
    
    // Default fallback
    return 'Tiffin Marketplace';
  }

  let pageTitle = $derived(getPageTitle());
</script>

<Sidebar />

<div class="flex flex-col min-h-screen">
  <!-- Top bar with page title -->
  <header class="sticky top-0 z-30 w-full border-b border-border bg-card/80 backdrop-blur-md transition-all duration-300 ease-in-out">
    <div class="container mx-auto px-4 h-14 flex items-center">
      <h1 class={cn('text-lg font-semibold text-foreground')}>{pageTitle}</h1>
    </div>
  </header>
  
  <!-- Main content with sidebar spacing -->
  <main class="flex-1 transition-all duration-300 ease-in-out">
    <slot />
  </main>
</div>

