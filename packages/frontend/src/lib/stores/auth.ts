import { writable } from 'svelte/store';
import { 
  saveAuthToken, 
  retrieveAuthToken, 
  saveUser, 
  retrieveUser, 
  clearAuth as clearAuthStorage 
} from '$lib/utils/persistence';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'owner' | 'admin';
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export const authStore = writable<AuthState>({
  user: null,
  token: null,
  isAuthenticated: false
});

export function setAuth(user: User, token: string): void {
  authStore.set({ user, token, isAuthenticated: !!token });
  if (token) {
    saveAuthToken(token);
    saveUser(user);
  }
}

export function clearAuth(): void {
  authStore.set({ user: null, token: null, isAuthenticated: false });
  clearAuthStorage();
}

export function initAuth(): void {
  const token = retrieveAuthToken();
  const user = retrieveUser<User>();
  
  if (token && user) {
    authStore.set({ user, token, isAuthenticated: true });
  } else {
    // Clear any invalid data
    clearAuth();
  }
}

