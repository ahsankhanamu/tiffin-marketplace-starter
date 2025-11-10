import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
  role: z.enum(['user', 'owner', 'admin']).default('user')
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export const createKitchenSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90)
});

const menuItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.string().min(1),
  description: z.string().optional(),
  image: z.string().url().optional().or(z.literal('')),
  allergens: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional()
});

export const createMealPlanSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  billingCycle: z.enum(['daily', 'weekly', 'monthly', 'one-off']),
  planType: z.enum(['subscription', 'one-time']).default('subscription'),
  availableDays: z.array(z.string()).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  items: z.array(z.object({
    name: z.string(),
    qty: z.string()
  })).optional(),
  menuItems: z.array(menuItemSchema).optional(),
  trialEnabled: z.boolean().default(false),
  trialLimit: z.number().int().positive().optional().nullable(),
  trialPrice: z.number().nonnegative().optional().nullable(),
  trialValidity: z.enum(['first-order', 'first-week', 'first-month']).optional().nullable(),
  trialNewCustomersOnly: z.boolean().default(false)
});

export const updateMealPlanSchema = createMealPlanSchema.partial();

export const createOrderSchema = z.object({
  kitchenId: z.string(),
  planId: z.string(),
  amount: z.number().positive(),
  mealType: z.enum(['lunch', 'dinner']).optional(),
  scheduledDate: z.string().datetime().optional(),
  isTrial: z.boolean().default(false)
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['created', 'preparing', 'out-for-delivery', 'delivered', 'cancelled'])
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format')
});

export const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email format'),
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must contain only digits')
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must contain only digits'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters')
});

