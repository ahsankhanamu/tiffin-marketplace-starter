import { browser } from '$app/environment';

/**
 * Storage keys enum for type safety
 */
export const StorageKeys = {
  AUTH_TOKEN: 'auth_token',
  AUTH_USER: 'auth_user',
  THEME: 'theme',
  SIDEBAR_STATE: 'sidebar_state',
  // Add more keys as needed
} as const;

type StorageKey = typeof StorageKeys[keyof typeof StorageKeys];

/**
 * Centralized persistence class for managing localStorage
 * Handles authentication, theme, sidebar state, and other app state
 * 
 * @example
 * ```ts
 * // Use default instance
 * const storage = new Persistence();
 * storage.save('key', value);
 * 
 * // Or use singleton
 * import { persistence } from '$lib/utils/persistence';
 * persistence.save('key', value);
 * ```
 */
export class Persistence {
  private prefix: string;

  constructor(prefix: string = 'tiffin_') {
    this.prefix = prefix;
  }

  /**
   * Get the full storage key with prefix
   */
  private getKey(key: StorageKey | string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Save data to localStorage
   * @param key - Storage key (will be prefixed automatically)
   * @param value - Value to store (will be JSON stringified)
   * @returns true if successful, false otherwise
   */
  save<T>(key: StorageKey | string, value: T): boolean {
    if (!browser) return false;

    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(this.getKey(key), serialized);
      return true;
    } catch (error) {
      console.error(`Failed to save ${key} to localStorage:`, error);
      return false;
    }
  }

  /**
   * Retrieve data from localStorage
   * @param key - Storage key (will be prefixed automatically)
   * @param defaultValue - Default value if key doesn't exist or parsing fails
   * @returns Parsed value or default value
   */
  retrieve<T>(key: StorageKey | string, defaultValue: T): T {
    if (!browser) return defaultValue;

    try {
      const item = localStorage.getItem(this.getKey(key));
      if (item === null) return defaultValue;
      return JSON.parse(item) as T;
    } catch (error) {
      console.error(`Failed to retrieve ${key} from localStorage:`, error);
      return defaultValue;
    }
  }

  /**
   * Retrieve string value from localStorage (no JSON parsing)
   * @param key - Storage key (will be prefixed automatically)
   * @param defaultValue - Default value if key doesn't exist
   * @returns String value or default value
   */
  retrieveString(key: StorageKey | string, defaultValue: string = ''): string {
    if (!browser) return defaultValue;

    try {
      return localStorage.getItem(this.getKey(key)) || defaultValue;
    } catch (error) {
      console.error(`Failed to retrieve ${key} from localStorage:`, error);
      return defaultValue;
    }
  }

  /**
   * Remove a specific key from localStorage
   * @param key - Storage key (will be prefixed automatically)
   * @returns true if successful, false otherwise
   */
  remove(key: StorageKey | string): boolean {
    if (!browser) return false;

    try {
      localStorage.removeItem(this.getKey(key));
      return true;
    } catch (error) {
      console.error(`Failed to remove ${key} from localStorage:`, error);
      return false;
    }
  }

  /**
   * Check if a key exists in localStorage
   * @param key - Storage key (will be prefixed automatically)
   * @returns true if key exists, false otherwise
   */
  exists(key: StorageKey | string): boolean {
    if (!browser) return false;

    try {
      return localStorage.getItem(this.getKey(key)) !== null;
    } catch {
      return false;
    }
  }

  /**
   * Clear all app-related data from localStorage
   * (only clears keys with the app prefix)
   */
  clearAll(): void {
    if (!browser) return;

    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          keys.push(key);
        }
      }
      keys.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  }

  /**
   * Get all keys stored by this app
   * @returns Array of storage keys (without prefix)
   */
  getAllKeys(): string[] {
    if (!browser) return [];

    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          keys.push(key.substring(this.prefix.length));
        }
      }
      return keys;
    } catch {
      return [];
    }
  }

  // Convenience methods for specific data types

  /**
   * Save authentication token
   * Note: We use direct localStorage.setItem for tokens to avoid JSON stringification
   */
  saveAuthToken(token: string): boolean {
    if (!browser) return false;
    try {
      localStorage.setItem(this.getKey(StorageKeys.AUTH_TOKEN), token);
      return true;
    } catch (error) {
      console.error('Failed to save auth token:', error);
      return false;
    }
  }

  /**
   * Retrieve authentication token
   * Note: We use direct localStorage.getItem for tokens to avoid JSON parsing
   */
  retrieveAuthToken(): string | null {
    if (!browser) return null;
    try {
      return localStorage.getItem(this.getKey(StorageKeys.AUTH_TOKEN)) || null;
    } catch (error) {
      console.error('Failed to retrieve auth token:', error);
      return null;
    }
  }

  /**
   * Save user data
   */
  saveUser<T>(user: T): boolean {
    return this.save(StorageKeys.AUTH_USER, user);
  }

  /**
   * Retrieve user data
   */
  retrieveUser<T>(): T | null {
    return this.retrieve<T | null>(StorageKeys.AUTH_USER, null);
  }

  /**
   * Clear authentication data
   */
  clearAuth(): void {
    this.remove(StorageKeys.AUTH_TOKEN);
    this.remove(StorageKeys.AUTH_USER);
  }

  /**
   * Save theme preference
   * Note: We use direct localStorage.setItem for theme to avoid JSON stringification
   */
  saveTheme(theme: string): boolean {
    if (!browser) return false;
    try {
      localStorage.setItem(this.getKey(StorageKeys.THEME), theme);
      return true;
    } catch (error) {
      console.error('Failed to save theme:', error);
      return false;
    }
  }

  /**
   * Retrieve theme preference
   * Note: We use direct localStorage.getItem for theme to avoid JSON parsing
   */
  retrieveTheme(defaultTheme: string = 'light'): string {
    if (!browser) return defaultTheme;
    try {
      return localStorage.getItem(this.getKey(StorageKeys.THEME)) || defaultTheme;
    } catch (error) {
      console.error('Failed to retrieve theme:', error);
      return defaultTheme;
    }
  }

  /**
   * Save sidebar state (open/closed)
   */
  saveSidebarState(isOpen: boolean): boolean {
    return this.save(StorageKeys.SIDEBAR_STATE, isOpen);
  }

  /**
   * Retrieve sidebar state
   */
  retrieveSidebarState(defaultState: boolean = true): boolean {
    return this.retrieve(StorageKeys.SIDEBAR_STATE, defaultState);
  }
}

// Default singleton instance for convenience
export const persistence = new Persistence();

// Export convenience functions that use the default instance
// This maintains backward compatibility with existing code
export const save = <T>(key: StorageKey | string, value: T): boolean => 
  persistence.save(key, value);

export const retrieve = <T>(key: StorageKey | string, defaultValue: T): T => 
  persistence.retrieve(key, defaultValue);

export const retrieveString = (key: StorageKey | string, defaultValue: string = ''): string => 
  persistence.retrieveString(key, defaultValue);

export const remove = (key: StorageKey | string): boolean => 
  persistence.remove(key);

export const exists = (key: StorageKey | string): boolean => 
  persistence.exists(key);

export const clearAll = (): void => 
  persistence.clearAll();

export const getAllKeys = (): string[] => 
  persistence.getAllKeys();

export const saveAuthToken = (token: string): boolean => 
  persistence.saveAuthToken(token);

export const retrieveAuthToken = (): string | null => 
  persistence.retrieveAuthToken();

export const saveUser = <T>(user: T): boolean => 
  persistence.saveUser(user);

export const retrieveUser = <T>(): T | null => 
  persistence.retrieveUser<T>();

export const clearAuth = (): void => 
  persistence.clearAuth();

export const saveTheme = (theme: string): boolean => 
  persistence.saveTheme(theme);

export const retrieveTheme = (defaultTheme: string = 'light'): string => 
  persistence.retrieveTheme(defaultTheme);

export const saveSidebarState = (isOpen: boolean): boolean => 
  persistence.saveSidebarState(isOpen);

export const retrieveSidebarState = (defaultState: boolean = true): boolean => 
  persistence.retrieveSidebarState(defaultState);

