<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore, clearAuth } from '$lib/stores/auth';
  import { theme } from '$lib/stores/theme';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { cn } from '$lib/cn';
  import { ChevronDown, User, Sun, Moon, LogOut } from '$lib/icons';

  interface Props {
    showSidebar?: boolean;
    mobile?: boolean;
    class?: string;
  }

  let {
    showSidebar = true,
    mobile = false,
    class: className = ''
  }: Props = $props();

  let open = $state(false);
  let auth = $derived.by(() => $authStore);
  
  let currentTheme = $state<'light' | 'dark'>('light');
  
  theme.subscribe((t) => {
    currentTheme = t;
  });

  function getInitials(name: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  }

  function handleProfile(): void {
    goto('/profile');
    open = false;
    if (mobile) {
      // Close sidebar on mobile after navigation
      setTimeout(() => {
        // Sidebar will be closed by navigation handler
      }, 0);
    }
  }

  function handleLogout(): void {
    clearAuth();
    goto('/login');
    open = false;
  }

  function handleThemeToggle(): void {
    theme.toggle();
  }

  function handleClose(): void {
    open = false;
  }
</script>

{#if auth.isAuthenticated && auth.user}
  <DropdownMenu.DropdownMenu bind:open={open} class={cn('w-full', className)}>
    <DropdownMenu.DropdownMenuTrigger
      class={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-start',
        'transition-all duration-200',
        'hover:bg-accent/50',
        !showSidebar && 'justify-center'
      )}
      aria-label="User menu"
      aria-expanded={open}
    >
      <!-- Avatar -->
      <div
        class={cn(
          'size-10 shrink-0 rounded-full',
          'bg-primary/10 text-primary',
          'flex items-center justify-center',
          'font-semibold text-sm'
        )}
      >
        {getInitials(auth.user.name || 'User')}
      </div>

      {#if showSidebar}
        <div class={cn('flex-1 flex flex-col items-start min-w-0')}>
          <p class={cn('text-sm font-medium text-foreground truncate w-full')}>
            {auth.user.name || 'User'}
          </p>
          <p class={cn('text-xs text-muted-foreground truncate w-full')}>
            {auth.user.email}
          </p>
        </div>
        <ChevronDown class={cn('size-4 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
      {/if}
    </DropdownMenu.DropdownMenuTrigger>
    
    <DropdownMenu.DropdownMenuContent align="start" side="right" class={cn('min-w-[200px]')}>
      <!-- User Info Header -->
      <div class={cn('px-2 py-1.5')}>
        <DropdownMenu.DropdownMenuLabel class={cn('px-0')}>
          <p class={cn('text-sm font-medium text-foreground')}>
            {auth.user.name || 'User'}
          </p>
          <p class={cn('text-xs text-muted-foreground')}>
            {auth.user.email}
          </p>
        </DropdownMenu.DropdownMenuLabel>
      </div>
      
      <DropdownMenu.DropdownMenuSeparator />

      <!-- Profile -->
      <DropdownMenu.DropdownMenuItem onclick={handleProfile}>
        <User class="size-4" />
        <span>Profile</span>
      </DropdownMenu.DropdownMenuItem>

      <!-- Theme Toggle -->
      <DropdownMenu.DropdownMenuItem onclick={handleThemeToggle}>
        {#if currentTheme === 'dark'}
          <Sun class="size-4" />
        {:else}
          <Moon class="size-4" />
        {/if}
        <span>{currentTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
      </DropdownMenu.DropdownMenuItem>

      <DropdownMenu.DropdownMenuSeparator />

      <!-- Logout -->
      <DropdownMenu.DropdownMenuItem onclick={handleLogout} variant="destructive">
        <LogOut class="size-4" />
        <span>Logout</span>
      </DropdownMenu.DropdownMenuItem>
    </DropdownMenu.DropdownMenuContent>
  </DropdownMenu.DropdownMenu>
{:else}
  <div class={cn('px-3 py-2 text-xs text-muted-foreground', !showSidebar && 'text-center')}>
    Not logged in
  </div>
{/if}

