import { writable } from 'svelte/store';

export interface SidebarControls {
  toggle: () => void;
  open: () => void;
  close: () => void;
  isMobile: () => boolean;
}

export const sidebarControls = writable<SidebarControls | null>(null);

