<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { theme } from '$lib/stores/theme';
  import { initAuth } from '$lib/stores/auth';
  import { sidebarControls } from '$lib/stores/sidebar';
  import Sidebar from '$lib/ui/Sidebar.svelte';
  import { Menu } from '$lib/icons';
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

  let controls = $state<{ toggle: () => void } | null>(null);
  let isMobile = $state(false);

  $effect(() => {
    const unsubscribe = sidebarControls.subscribe((value) => {
      controls = value;
    });
    return unsubscribe;
  });

  function handleMenuClick(): void {
    if (controls) {
      controls.toggle();
    }
  }

  if (browser) {
    onMount(() => {
      const checkMobile = () => {
        isMobile = window.innerWidth < 768;
      };
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    });
  }
</script>

<div class="flex h-screen overflow-hidden">
  <Sidebar />
  
  <div class="flex flex-col flex-1 min-w-0 overflow-hidden">
    <!-- Top bar with page title -->
    <header class="sticky top-0 z-30 w-full border-b border-border bg-card/80 backdrop-blur-md transition-all duration-300 ease-in-out flex-shrink-0">
      <div class="container mx-auto px-4 h-14 flex items-center gap-3">
        {#if isMobile && controls}
          <button
            type="button"
            onclick={handleMenuClick}
            class={cn(
              'flex items-center justify-center rounded-lg',
              'size-10 p-2',
              'hover:bg-accent/50 transition-colors',
              'text-foreground'
            )}
            aria-label="Toggle sidebar"
          >
            <Menu class="size-5" />
          </button>
        {/if}
        <h1 class={cn('text-lg font-semibold text-foreground')}>{pageTitle}</h1>
      </div>
    </header>
    
    <!-- Main content - scrollable independently -->
    <main class="flex-1 overflow-y-auto transition-all duration-300 ease-in-out">
      <slot />
    </main>
  </div>
</div>

