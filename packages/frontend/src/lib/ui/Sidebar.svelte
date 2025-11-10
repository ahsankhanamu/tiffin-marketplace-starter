<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { authStore, clearAuth } from "$lib/stores/auth";
  import {
    saveSidebarState,
    retrieveSidebarState,
  } from "$lib/utils/persistence";
  import { sidebarControls } from "$lib/stores/sidebar";
  import { cn } from "$lib/cn";
  import Button from "./Button.svelte";
  import Card from "./Card.svelte";
  import UserMenu from "./UserMenu.svelte";
  import { X, Menu, Home, Building, Shield, LogOut } from "$lib/icons";

  const BREAKPOINT = 768;

  let showSidebar = $state(false);
  let mobile = $state(false);
  let isHovered = $state(false);
  let wasOpenedByClick = $state(false);
  let hoverTimeout: number | null = null;
  let navElement: HTMLElement | null = null;
  let touchstart: Touch | null = null;
  let touchend: Touch | null = null;

  let auth = $derived.by(() => $authStore);

  function checkMobile(): boolean {
    if (!browser) return false;
    return window.innerWidth < BREAKPOINT;
  }

  function updateMobile(): void {
    const wasMobile = mobile;
    mobile = checkMobile();

    if (wasMobile !== mobile) {
      if (mobile && showSidebar) {
        showSidebar = false;
      } else if (!mobile && !showSidebar) {
        showSidebar = retrieveSidebarState(true);
      }
    }
  }

  function toggleSidebar(): void {
    const willBeOpen = !showSidebar;
    if (willBeOpen) {
      wasOpenedByClick = true;
    } else {
      wasOpenedByClick = false;
    }
    showSidebar = willBeOpen;
    saveSidebarState(willBeOpen);

    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
  }

  function onSidebarClick(e: Event): void {
    e.stopPropagation();
    toggleSidebar();
  }

  function openSidebar(): void {
    if (!showSidebar) {
      toggleSidebar();
    }
  }

  function closeSidebar(): void {
    if (showSidebar) {
      toggleSidebar();
    }
  }

  function checkDirection(): void {
    if (!touchstart || !touchend) return;
    const screenWidth = window.innerWidth;
    const swipeDistance = Math.abs(touchend.screenX - touchstart.screenX);

    if (touchstart.clientX < 40 && swipeDistance >= screenWidth / 8) {
      if (touchend.screenX < touchstart.screenX) {
        showSidebar = false;
      }
      if (touchend.screenX > touchstart.screenX) {
        showSidebar = true;
      }
    }
  }

  function onTouchStart(e: TouchEvent): void {
    touchstart = e.changedTouches[0];
  }

  function onTouchEnd(e: TouchEvent): void {
    touchend = e.changedTouches[0];
    checkDirection();
  }


  function navigateTo(path: string): void {
    goto(path);
    if (mobile) {
      setTimeout(() => {
        showSidebar = false;
      }, 0);
    }
  }

  function isActive(path: string): boolean {
    return (
      $page.url.pathname === path || $page.url.pathname.startsWith(path + "/")
    );
  }

  onMount(() => {
    if (!browser) return;

    mobile = checkMobile();
    showSidebar = mobile ? false : retrieveSidebarState(true);

    // Expose sidebar controls to the store
    sidebarControls.set({
      toggle: toggleSidebar,
      open: openSidebar,
      close: closeSidebar,
      isMobile: () => mobile
    });

    const handleResize = () => {
      updateMobile();
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("touchstart", onTouchStart);
    window.addEventListener("touchend", onTouchEnd);

    // Update document body class for sidebar state
    document.body.classList.toggle("sidebar-open", showSidebar && !mobile);
    document.body.classList.toggle(
      "sidebar-collapsed",
      !showSidebar && !mobile
    );

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      sidebarControls.set(null);
    };
  });

  // Update body classes when sidebar state changes
  $effect(() => {
    if (browser) {
      document.body.classList.toggle("sidebar-open", showSidebar && !mobile);
      document.body.classList.toggle(
        "sidebar-collapsed",
        !showSidebar && !mobile
      );
      
      // Update sidebar controls when mobile state changes
      sidebarControls.set({
        toggle: toggleSidebar,
        open: openSidebar,
        close: closeSidebar,
        isMobile: () => mobile
      });
    }
  });

  onDestroy(() => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
  });
</script>

{#if showSidebar && mobile}
  <div
    class={cn("fixed inset-0 z-40 bg-black/50 backdrop-blur-sm")}
    on:click={onSidebarClick}
    role="button"
    tabindex="-1"
    aria-label="Close sidebar"
  ></div>
{/if}

<nav
  bind:this={navElement}
  class={cn(
    "bg-card/80 backdrop-blur-md border-r border-border",
    "select-none shadow-lg",
    "transition-all duration-300 ease-in-out",
    "flex flex-col",
    // Mobile styles - fixed overlay
    mobile && "fixed left-0 top-0 bottom-0 z-50",
    mobile && showSidebar && "w-64",
    mobile && !showSidebar && "w-0 overflow-hidden",
    // Desktop styles - relative but with fixed height, doesn't scroll with main
    !mobile && "relative h-screen",
    !mobile && showSidebar && "w-64",
    !mobile && !showSidebar && "w-16"
  )}
  data-state={showSidebar}
>
  <div
    class={cn(
      "flex flex-col h-full py-4 px-3 overflow-y-auto overflow-x-hidden"
    )}
  >
    <!-- Header with toggle button -->
    <div class={cn("flex items-center justify-between mb-6 px-2")}>
      {#if showSidebar}
        <h2 class={cn("text-lg font-semibold text-foreground")}>
          Tiffin Market
        </h2>
      {/if}
      <button
        type="button"
        class={cn(
          "flex items-center justify-center rounded-lg",
          "size-10 p-2",
          "hover:bg-accent/50 transition-colors",
          "text-foreground"
        )}
        on:click={onSidebarClick}
        aria-label="Toggle sidebar"
      >
        {#if showSidebar}
          <X class="size-5" />
        {:else}
          <Menu class="size-5" />
        {/if}
      </button>
    </div>

    <!-- Navigation Items -->
    <div class={cn("flex flex-col gap-1 flex-1")}>
      <!-- Home -->
      <button
        class={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg",
          "transition-all duration-200",
          "hover:bg-accent/50",
          isActive("/") && "bg-primary/10 text-primary",
          !isActive("/") && "text-foreground",
          !showSidebar && "justify-center"
        )}
        on:click={() => navigateTo("/")}
      >
        <Home class="size-5" />
        {#if showSidebar}
          <span class={cn("text-sm font-medium")}>Home</span>
        {/if}
      </button>

      {#if auth.isAuthenticated}
        {#if auth.user?.role === "owner"}
          <!-- Owner Dashboard -->
          <button
            class={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg",
              "transition-all duration-200",
              "hover:bg-accent/50",
              isActive("/owner") && "bg-primary/10 text-primary",
              !isActive("/owner") && "text-foreground",
              !showSidebar && "justify-center"
            )}
            on:click={() => navigateTo("/owner")}
          >
            <Building class="size-5" />
            {#if showSidebar}
              <span class={cn("text-sm font-medium")}>My Kitchens</span>
            {/if}
          </button>
        {/if}

        {#if auth.user?.role === "admin"}
          <!-- Admin Dashboard -->
          <button
            class={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg",
              "transition-all duration-200",
              "hover:bg-accent/50",
              isActive("/admin") && "bg-primary/10 text-primary",
              !isActive("/admin") && "text-foreground",
              !showSidebar && "justify-center"
            )}
            on:click={() => navigateTo("/admin")}
          >
            <Shield class="size-5" />
            {#if showSidebar}
              <span class={cn("text-sm font-medium")}>Admin</span>
            {/if}
          </button>
        {/if}
      {:else}
        <!-- Login -->
        <button
          class={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg",
            "transition-all duration-200",
            "hover:bg-accent/50",
            isActive("/login") && "bg-primary/10 text-primary",
            !isActive("/login") && "text-foreground",
            !showSidebar && "justify-center"
          )}
          on:click={() => navigateTo("/login")}
        >
          <LogOut class="size-5" />
          {#if showSidebar}
            <span class={cn("text-sm font-medium")}>Login</span>
          {/if}
        </button>
      {/if}
    </div>

    <!-- User Menu -->
    <div class={cn("mt-auto pt-4 border-t border-border")}>
      <UserMenu {showSidebar} {mobile} />
    </div>
  </div>
</nav>

<style>
  nav {
    scrollbar-width: thin;
    scrollbar-color: rgb(var(--color-border)) transparent;
  }

  nav::-webkit-scrollbar {
    width: 6px;
  }

  nav::-webkit-scrollbar-track {
    background: transparent;
  }

  nav::-webkit-scrollbar-thumb {
    background-color: rgb(var(--color-border));
    border-radius: 3px;
  }

  nav::-webkit-scrollbar-thumb:hover {
    background-color: rgb(var(--color-muted-foreground));
  }
</style>
