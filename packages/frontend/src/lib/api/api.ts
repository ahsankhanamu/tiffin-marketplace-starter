import { retrieveAuthToken } from '$lib/utils/persistence';

export const apiBase = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:4000';

// Flag to enable/disable ngrok skip browser warning header
// Set VITE_NGROK_SKIP_WARNING=true in environment to enable
const shouldSkipNgrokWarning = import.meta.env.VITE_NGROK_SKIP_WARNING === "true";

interface ApiError {
  error: string;
}

/**
 * Centralized function to get headers for all API requests
 * @param token - Authentication token (optional)
 * @param hasBody - Whether the request has a body (for Content-Type)
 * @param additionalHeaders - Any additional headers to include
 * @returns Headers object for fetch requests
 */
function getHeaders(
  token: string | null = null, 
  hasBody: boolean = false,
  additionalHeaders: Record<string, string> = {}
): Record<string, string> {
  const headers: Record<string, string> = {};
  
  // Only add ngrok header if flag is enabled
  if (shouldSkipNgrokWarning) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }
  
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Merge any additional headers
  return { ...headers, ...additionalHeaders };
}

async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = retrieveAuthToken();
  const hasBody = options.body !== undefined && options.body !== null;
  const res = await fetch(`${apiBase}${endpoint}`, {
    ...options,
    headers: { ...getHeaders(token, hasBody), ...options.headers }
  });
  if (!res.ok) {
    const error = (await res.json().catch(() => ({ error: 'Request failed' }))) as ApiError;
    throw error;
  }
  return res.json();
}

export interface Kitchen {
  id: string;
  title: string;
  description?: string;
  distance_m?: number;
  location?: { lat: number; lng: number };
  images?: string[];
  coverImage?: string;
  ownerId?: string;
  mealTypes?: ('breakfast' | 'lunch' | 'dinner')[];
  rating?: number;
  mealPlans?: MealPlan[];
}

export interface MenuItem {
  name: string;
  quantity: string;
  description?: string;
  image?: string; // Image ID
  imageUrl?: string; // Full URL for display
  allergens?: string[];
  tags?: string[];
}

export interface MealPlan {
  id: string;
  kitchenId: string;
  name: string;
  description?: string;
  price: number;
  billingCycle: 'daily' | 'weekly' | 'monthly' | 'one-off';
  planType: 'subscription' | 'one-time';
  availableDays: string[];
  startTime?: string;
  endTime?: string;
  items: Array<{ name: string; qty: string }>;
  menuItems?: MenuItem[];
  trialEnabled: boolean;
  trialLimit?: number;
  trialPrice?: number;
  trialValidity?: 'first-order' | 'first-week' | 'first-month';
  trialNewCustomersOnly: boolean;
  schedules?: MealPlanSchedule[];
}

export interface MealPlanSchedule {
  id?: string;
  mealPlanId: string;
  dayOfWeek: number;
  mealType: 'breakfast' | 'lunch' | 'dinner';
  isAvailable: boolean;
  price?: number;
  startTime?: string;
  endTime?: string;
  orderDeadline: string;
  deliveryStart?: string;
  deliveryEnd?: string;
  maxOrders?: number;
  menuItems?: MenuItem[];
}

export interface Order {
  id: string;
  userId: string;
  kitchenId: string;
  planId: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner';
  isTrial: boolean;
  status: 'created' | 'preparing' | 'out-for-delivery' | 'delivered' | 'cancelled';
  amount: number;
  scheduledDate?: string;
  createdAt: string;
}

export interface AvailableMeal {
  planId: string;
  planName: string;
  date: string;
  dayOfWeek: number;
  mealType: 'breakfast' | 'lunch' | 'dinner';
  price: number; // Plan price for display
  orderDeadline: string;
  isAvailable: boolean;
  schedulePrice?: number | null; // Individual meal price if set by owner
}

/**
 * Subscription interface.
 * Relationship: Subscription → MealPlan → Kitchen
 * Users subscribe to meal plans, not kitchens directly.
 * Each meal plan belongs to a kitchen.
 */
export interface Subscription {
  id: string;
  userId: string;
  mealPlanId: string; // Subscription is tied to a meal plan, not a kitchen
  mealType: 'breakfast' | 'lunch' | 'dinner';
  dayOfWeek?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  mealPlan?: {
    id: string;
    name: string;
    kitchenId: string; // Meal plan belongs to a kitchen
  };
}

export interface Image {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'owner' | 'admin';
  createdAt: string;
}

export async function getNearby(lng: number, lat: number, radius = 15000): Promise<Kitchen[]> {
  try {
    return await apiCall<Kitchen[]>(`/api/kitchens/nearby?lng=${lng}&lat=${lat}&radius=${radius}`);
  } catch {
    return [];
  }
}

export async function getKitchen(id: string): Promise<Kitchen> {
  return apiCall<Kitchen>(`/api/kitchens/${id}`);
}

export async function createKitchen(data: Partial<Kitchen>): Promise<Kitchen> {
  return apiCall<Kitchen>('/api/kitchens', { method: 'POST', body: JSON.stringify(data) });
}

export async function getMealPlans(kitchenId: string): Promise<MealPlan[]> {
  return apiCall<MealPlan[]>(`/api/kitchens/${kitchenId}/plans`);
}

export async function createMealPlan(kitchenId: string, data: Partial<MealPlan>): Promise<MealPlan> {
  return apiCall<MealPlan>(`/api/kitchens/${kitchenId}/plans`, { method: 'POST', body: JSON.stringify(data) });
}

export async function login(email: string, password: string): Promise<{ user: User; token: string }> {
  return apiCall<{ user: User; token: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export async function register(email: string, password: string, name: string, role: 'user' | 'owner' | 'admin' = 'user'): Promise<{ user: User; token: string }> {
  return apiCall<{ user: User; token: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name, role })
  });
}

export async function forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
  return apiCall<{ success: boolean; message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

export async function verifyOtp(email: string, otp: string): Promise<{ success: boolean; message: string }> {
  return apiCall<{ success: boolean; message: string }>('/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp })
  });
}

export async function resetPassword(email: string, otp: string, newPassword: string): Promise<{ success: boolean; message: string }> {
  return apiCall<{ success: boolean; message: string }>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, otp, newPassword })
  });
}

export async function createOrder(
  kitchenId: string,
  planId: string,
  amount: number,
  options?: {
    mealType?: 'breakfast' | 'lunch' | 'dinner';
    scheduledDate?: string;
    isTrial?: boolean;
  }
): Promise<Order> {
  return apiCall<Order>('/api/orders', {
    method: 'POST',
    body: JSON.stringify({ kitchenId, planId, amount, ...options })
  });
}

export async function getAvailableMeals(kitchenId: string, days = 7): Promise<AvailableMeal[]> {
  return apiCall<AvailableMeal[]>(`/api/orders/available-meals?kitchenId=${kitchenId}&days=${days}`);
}

/**
 * Subscribe to a meal plan.
 * Note: Users subscribe to meal plans (not kitchens). Each meal plan belongs to a kitchen.
 * Relationship: Subscription → MealPlan → Kitchen
 */
export async function subscribeToMealPlan(
  mealPlanId: string,
  mealType: 'breakfast' | 'lunch' | 'dinner',
  dayOfWeek?: number
): Promise<Subscription> {
  return apiCall<Subscription>('/api/subscriptions', {
    method: 'POST',
    body: JSON.stringify({ mealPlanId, mealType, dayOfWeek })
  });
}

export async function unsubscribeFromMealPlan(subscriptionId: string): Promise<{ success: boolean }> {
  return apiCall<{ success: boolean }>(`/api/subscriptions/${subscriptionId}`, {
    method: 'DELETE'
  });
}

/**
 * Get current user's subscriptions.
 * Note: Subscriptions are tied to meal plans, not kitchens.
 * Relationship: Subscription → MealPlan → Kitchen
 */
export async function getMySubscriptions(): Promise<Subscription[]> {
  return apiCall<Subscription[]>('/api/subscriptions/my');
}

/**
 * Get subscriptions for meal plans belonging to a kitchen.
 * Note: Subscriptions are tied to meal plans, not kitchens directly.
 * This endpoint returns all subscriptions for meal plans that belong to the specified kitchen.
 * Relationship: Subscription → MealPlan → Kitchen
 */
export async function getKitchenSubscriptions(kitchenId: string): Promise<Subscription[]> {
  return apiCall<Subscription[]>(`/api/subscriptions/kitchen/${kitchenId}`);
}

export async function getOrder(id: string): Promise<Order> {
  return apiCall<Order>(`/api/orders/${id}`);
}

export async function updateOrderStatus(id: string, status: Order['status']): Promise<Order> {
  return apiCall<Order>(`/api/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

export async function getUsers(filters: Record<string, string> = {}): Promise<User[]> {
  const params = new URLSearchParams(filters);
  return apiCall<User[]>(`/api/admin/users?${params}`);
}

export async function getKitchens(filters: Record<string, string> = {}): Promise<Kitchen[]> {
  const params = new URLSearchParams(filters);
  const response = await apiCall<{ kitchens: Kitchen[]; total: number }>(`/api/admin/kitchens?${params}`);
  return response.kitchens;
}

export async function getMyKitchens(): Promise<Kitchen[]> {
  return apiCall<Kitchen[]>(`/api/kitchens/my`);
}

export async function getOrders(filters: Record<string, string> = {}): Promise<Order[]> {
  const params = new URLSearchParams(filters);
  return apiCall<Order[]>(`/api/admin/orders?${params}`);
}

export async function getKitchenOrders(kitchenId: string): Promise<Order[]> {
  return apiCall<Order[]>(`/api/kitchens/${kitchenId}/orders`);
}

export async function deleteUser(id: string): Promise<void> {
  return apiCall<void>(`/api/admin/users/${id}`, { method: 'DELETE' });
}

export async function deleteKitchen(id: string): Promise<void> {
  return apiCall<void>(`/api/kitchens/${id}`, { method: 'DELETE' });
}

export async function updateKitchen(id: string, data: Partial<Kitchen>): Promise<Kitchen> {
  return apiCall<Kitchen>(`/api/kitchens/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function uploadKitchenImage(kitchenId: string, file: File): Promise<{ images: string[]; message: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const token = retrieveAuthToken();
  const headers = getHeaders(token, false);
  
  const res = await fetch(`${apiBase}/api/kitchens/${kitchenId}/images`, {
    method: 'POST',
    headers,
    body: formData
  });
  if (!res.ok) {
    const error = (await res.json().catch(() => ({ error: 'Request failed' }))) as ApiError;
    throw error;
  }
  return res.json();
}

export async function deleteKitchenImage(kitchenId: string, imageIndex: number): Promise<{ images: string[]; message: string }> {
  return apiCall<{ images: string[]; message: string }>(`/api/kitchens/${kitchenId}/images/${imageIndex}`, {
    method: 'DELETE'
  });
}

export async function setCoverImage(kitchenId: string, imageUrl: string): Promise<{ coverImage: string; message: string }> {
  return apiCall<{ coverImage: string; message: string }>(`/api/kitchens/${kitchenId}/cover-image`, {
    method: 'PUT',
    body: JSON.stringify({ imageUrl })
  });
}

export async function getMealPlan(kitchenId: string, planId: string): Promise<MealPlan> {
  return apiCall<MealPlan>(`/api/kitchens/${kitchenId}/plans/${planId}`);
}

export async function updateMealPlan(kitchenId: string, planId: string, data: Partial<MealPlan>): Promise<MealPlan> {
  return apiCall<MealPlan>(`/api/kitchens/${kitchenId}/plans/${planId}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function deleteMealPlan(kitchenId: string, planId: string): Promise<void> {
  return apiCall<void>(`/api/kitchens/${kitchenId}/plans/${planId}`, { method: 'DELETE' });
}

export async function getSchedule(planId: string): Promise<MealPlanSchedule[]> {
  return apiCall<MealPlanSchedule[]>(`/api/plans/${planId}/schedule`);
}

export async function updateSchedule(planId: string, schedules: Partial<MealPlanSchedule>[]): Promise<{ message: string; schedules: MealPlanSchedule[] }> {
  return apiCall<{ message: string; schedules: MealPlanSchedule[] }>(`/api/plans/${planId}/schedule`, {
    method: 'PUT',
    body: JSON.stringify({ schedules })
  });
}

export async function updateScheduleDay(planId: string, dayOfWeek: number, mealType: 'breakfast' | 'lunch' | 'dinner', data: Partial<MealPlanSchedule>): Promise<MealPlanSchedule> {
  return apiCall<MealPlanSchedule>(`/api/plans/${planId}/schedule/${dayOfWeek}/${mealType}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function getDeadlines(planId: string, days: number = 7): Promise<Array<{ date: string; dayOfWeek: number; mealType: string; orderDeadline: string; isAvailable: boolean }>> {
  return apiCall<Array<{ date: string; dayOfWeek: number; mealType: string; orderDeadline: string; isAvailable: boolean }>>(`/api/plans/${planId}/deadlines?days=${days}`);
}

export async function validateDeadline(planId: string, mealType: 'lunch' | 'dinner', scheduledDate: string): Promise<{ valid: boolean; reason: string; deadline: string | null }> {
  return apiCall<{ valid: boolean; reason: string; deadline: string | null }>('/api/orders/validate-deadline', {
    method: 'POST',
    body: JSON.stringify({ planId, mealType, scheduledDate })
  });
}

export async function getTrialStatus(planId: string, userId?: string): Promise<{
  trialEnabled: boolean;
  trialLimit?: number;
  trialPrice?: number;
  trialValidity?: string;
  trialNewCustomersOnly: boolean;
  userEligible: boolean;
  userUsage: { orderCount: number; firstUsedAt: string | null; lastUsedAt: string | null } | null;
}> {
  const url = userId ? `/api/plans/${planId}/trial-status?userId=${userId}` : `/api/plans/${planId}/trial-status`;
  return apiCall(url);
}

export async function updateTrialSettings(planId: string, data: {
  trialEnabled?: boolean;
  trialLimit?: number;
  trialPrice?: number;
  trialValidity?: 'first-order' | 'first-week' | 'first-month';
  trialNewCustomersOnly?: boolean;
}): Promise<MealPlan> {
  return apiCall<MealPlan>(`/api/plans/${planId}/trial-settings`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function checkTrialEligibility(planId: string): Promise<{ eligible: boolean; reason: string; trialPrice?: number }> {
  return apiCall<{ eligible: boolean; reason: string; trialPrice?: number }>('/api/plans/orders/check-trial-eligibility', {
    method: 'POST',
    body: JSON.stringify({ planId })
  });
}

// Image management APIs
export async function getImages(page = 1, limit = 50): Promise<{ images: Image[]; total: number; page: number; limit: number }> {
  return apiCall<{ images: Image[]; total: number; page: number; limit: number }>(`/api/images?page=${page}&limit=${limit}`);
}

export async function uploadImage(file: File): Promise<Image> {
  const formData = new FormData();
  formData.append('file', file);
  const token = retrieveAuthToken();
  const headers = getHeaders(token, false);
  
  const res = await fetch(`${apiBase}/api/images`, {
    method: 'POST',
    headers,
    body: formData
  });
  if (!res.ok) {
    const error = (await res.json().catch(() => ({ error: 'Request failed' }))) as ApiError;
    throw error;
  }
  return res.json();
}

export async function deleteImage(imageId: string): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/api/images/${imageId}`, {
    method: 'DELETE'
  });
}

