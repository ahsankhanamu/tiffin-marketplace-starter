# House Owner Dashboard - Comprehensive Feature Implementation Prompt

## Overview
Enhance the house owner dashboard to provide a complete service management system where owners can upload photos, set detailed pricing, manage menu items with day-wise and week-wise scheduling, and provide comprehensive meal plan details.

## Current State Analysis
- Basic house creation (title, description, location)
- Basic meal plan creation (name, price, billing cycle)
- Simple order management
- No photo/image support
- Limited menu item details
- No day-wise or week-wise scheduling interface

## Required Features

### 1. Photo/Image Management for Houses
**Frontend Requirements:**
- Add image upload component in house creation/edit forms
- Support multiple images (gallery view)
- Image preview before upload
- Drag-and-drop or file picker interface
- Image cropping/resizing (optional but recommended)
- Display house images in a carousel/gallery on house detail pages
- Image deletion capability

**Backend Requirements:**
- Add `images` field to House model (array of image URLs or file paths)
- Create image upload endpoint (`POST /api/houses/:id/images`)
- Create image deletion endpoint (`DELETE /api/houses/:id/images/:imageId`)
- Handle file storage (local filesystem or cloud storage like S3/Cloudinary)
- Image validation (file type, size limits)
- Image optimization/compression

**Database Schema Changes:**
```prisma
model House {
  // ... existing fields
  images      String[]  @default([])  // Array of image URLs/paths
  coverImage  String?                 // Primary/cover image URL
}
```

### 2. Enhanced Meal Plan Management with Detailed Menu Items and Trial Options
**Frontend Requirements:**
- Rich meal plan creation/edit form with:
  - Plan name and description
  - Plan type selection:
    - **Subscription Plan** (daily/weekly/monthly recurring)
    - **One-time Meal** (single meal order - lunch or dinner for a specific day)
  - Detailed menu items list (not just JSON string)
  - Each menu item should have:
    - Item name
    - Quantity/portion size
    - Description
    - Optional: Image
    - Optional: Allergen information
    - Optional: Dietary tags (vegetarian, vegan, gluten-free, etc.)
  - **Trial Settings:**
    - Toggle to enable/disable trial offers
    - Trial limit (number of trial orders allowed per customer)
    - Trial price (can be different from regular price, including free)
    - Trial validity period (e.g., first order only, first week only)
    - Option to restrict trials to new customers only
  - Visual menu builder (add/remove/reorder items)
  - Preview of how menu will appear to customers
  - Clear distinction between subscription plans and one-time meal options

**Backend Requirements:**
- Update MealPlan model to properly structure menu items and trial settings
- Create/update endpoints that handle structured menu item data
- Validation for menu items and trial settings
- Logic to track and enforce trial limits per customer
- Trial eligibility checking before order creation

**Database Schema Changes:**
```prisma
model MealPlan {
  // ... existing fields
  planType        String   @default("subscription")  // "subscription" or "one-time"
  menuItems       Json?    // Structured JSON: [{ name, quantity, description, image?, allergens?, tags? }]
  // Trial settings
  trialEnabled    Boolean  @default(false)
  trialLimit      Int?     // Number of trial orders allowed per customer (null = unlimited during trial period)
  trialPrice      Float?   // Trial price (null = free, or specific discounted price)
  trialValidity   String?  // "first-order", "first-week", "first-month", etc.
  trialNewCustomersOnly Boolean @default(false)  // Only allow trials for new customers
  // OR create separate MenuItem model for better normalization
}

// Optional: Better normalization approach
model MenuItem {
  id          String   @id @default(cuid())
  mealPlanId String
  mealPlan   MealPlan  @relation(fields: [mealPlanId], references: [id], onDelete: Cascade)
  name        String
  quantity    String
  description String?
  image       String?
  allergens   String[]
  tags        String[]  // ["vegetarian", "vegan", "gluten-free", etc.]
  order       Int       @default(0)  // For ordering items
  createdAt   DateTime  @default(now())
}

// Track trial usage per customer
model TrialUsage {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  mealPlanId String
  mealPlan    MealPlan @relation(fields: [mealPlanId], references: [id], onDelete: Cascade)
  orderCount  Int      @default(0)  // Number of trial orders used
  firstUsedAt DateTime @default(now())
  lastUsedAt  DateTime @default(now())
  
  @@unique([userId, mealPlanId])
}
```

### 3. Day-wise and Week-wise Scheduling with Order Deadlines
**Frontend Requirements:**
- Weekly schedule interface showing all 7 days
- For each day, allow owners to:
  - Enable/disable meal plan availability
  - Set meal type (Lunch, Dinner, or Both) for each day
  - Set different prices for specific days and meal types (e.g., weekend pricing)
  - Set different menu items for specific days and meal types
  - Set time slots (start time, end time) per day and meal type
  - Set maximum orders per day and meal type
  - **Set order deadline/cutoff time** - Latest time customers can place orders for that day's meal
    - Separate deadlines for lunch and dinner if both are offered
    - Visual indicator showing "Orders must be placed by [time]"
    - Countdown timer showing time remaining until deadline
  - Set delivery time window (when meals will be delivered)
- Visual calendar/week view with meal type indicators
- Bulk operations (apply same settings to multiple days)
- Preview of weekly schedule with deadlines highlighted
- Order deadline validation (prevent orders after deadline)

**Backend Requirements:**
- Add scheduling fields to MealPlan or create separate Schedule model
- Endpoints to manage day-wise availability, pricing, and deadlines
- Query endpoints that respect day-wise availability and check order deadlines
- Real-time deadline checking before order creation
- Notification system for approaching deadlines (optional)

**Database Schema Changes:**
```prisma
model MealPlanSchedule {
  id              String   @id @default(cuid())
  mealPlanId      String
  mealPlan        MealPlan  @relation(fields: [mealPlanId], references: [id], onDelete: Cascade)
  dayOfWeek       Int      // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  mealType        String   // "lunch", "dinner", or "both" (if both, create two records)
  isAvailable     Boolean  @default(true)
  price           Float?   // Override price for this day/meal type (null = use meal plan default)
  startTime       String?  // Meal service start time (e.g., "12:00" for lunch)
  endTime         String?  // Meal service end time (e.g., "14:00" for lunch)
  orderDeadline   String   // Latest time to place order (e.g., "10:00" - orders must be placed by 10 AM)
  deliveryStart   String?  // Delivery window start time
  deliveryEnd      String?  // Delivery window end time
  maxOrders       Int?     // Maximum orders allowed for this day/meal type
  menuItems       Json?    // Override menu items for this day/meal type (null = use meal plan default)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@unique([mealPlanId, dayOfWeek, mealType])
}
```

### 4. Enhanced Pricing Management with Meal Type Support
**Frontend Requirements:**
- Base price input
- Separate pricing for:
  - Subscription plans (daily/weekly/monthly rates)
  - One-time meals (lunch and dinner separately)
- Day-wise price override interface
- Meal type pricing (lunch vs dinner can have different prices)
- Bulk pricing tools (set same price for multiple days/meal types)
- Price preview showing all days and meal types in a grid/table
- Trial price settings (separate from regular pricing)
- Discount/promotion management (optional future feature)
- Price comparison view (regular vs trial pricing)

**Backend Requirements:**
- Price calculation logic that considers:
  - Base meal plan price
  - Plan type (subscription vs one-time)
  - Meal type (lunch vs dinner)
  - Day-wise overrides
  - Trial pricing (if applicable and customer is eligible)
  - Any active promotions/discounts
- Price validation (minimum price, etc.)
- Trial price validation (must be <= regular price if not free)

### 5. UI/UX Improvements
**Design Requirements:**
- Modern, intuitive interface following existing glassmorphism theme
- Responsive design (mobile, tablet, desktop)
- Loading states for image uploads
- Success/error notifications
- Form validation with clear error messages
- Drag-and-drop for image uploads and menu item reordering
- Tabbed interface for different sections (Details, Menu, Schedule, Images, Orders, Trials)
- Preview mode showing how customers will see the house/meal plan
- **Order Deadline Indicators:**
  - Visual countdown timers for approaching deadlines
  - Color-coded status (green = open, yellow = closing soon, red = closed)
  - Clear messaging when deadline has passed
  - Deadline information prominently displayed on order forms
- **Trial Badge/Indicator:**
  - Visual indicators for trial-eligible plans
  - Trial pricing clearly displayed
  - Trial limit information shown to customers

**Component Requirements:**
- `ImageUpload.svelte` - Reusable image upload component
- `ImageGallery.svelte` - Gallery view for house images
- `MenuBuilder.svelte` - Visual menu item builder
- `WeeklySchedule.svelte` - Weekly scheduling interface with meal types and deadlines
- `PriceManager.svelte` - Pricing management component with meal type support
- `TrialSettings.svelte` - Trial configuration component
- `OrderDeadline.svelte` - Order deadline display and countdown component
- `MealTypeSelector.svelte` - Component for selecting lunch/dinner options
- `OneTimeMealPlanner.svelte` - Interface for creating one-time meal options

### 6. API Endpoints Required

**House Management:**
- `GET /api/houses/:id` - Get house details (already exists, enhance with images)
- `PUT /api/houses/:id` - Update house details (add image support)
- `POST /api/houses/:id/images` - Upload house images
- `DELETE /api/houses/:id/images/:imageId` - Delete specific image
- `PUT /api/houses/:id/cover-image` - Set cover image

**Meal Plan Management:**
- `GET /api/houses/:houseId/plans` - Get all meal plans (already exists)
- `GET /api/houses/:houseId/plans/:planId` - Get detailed meal plan
- `POST /api/houses/:houseId/plans` - Create meal plan (enhance with menu items)
- `PUT /api/houses/:houseId/plans/:planId` - Update meal plan
- `DELETE /api/houses/:houseId/plans/:planId` - Delete meal plan

**Schedule Management:**
- `GET /api/plans/:planId/schedule` - Get weekly schedule with deadlines
- `PUT /api/plans/:planId/schedule` - Update weekly schedule (bulk)
- `PUT /api/plans/:planId/schedule/:dayOfWeek/:mealType` - Update specific day/meal type
- `GET /api/plans/:planId/deadlines` - Get order deadlines for upcoming days
- `POST /api/orders/validate-deadline` - Validate if order can be placed (check deadline)

**Menu Item Management:**
- `POST /api/plans/:planId/menu-items` - Add menu item
- `PUT /api/plans/:planId/menu-items/:itemId` - Update menu item
- `DELETE /api/plans/:planId/menu-items/:itemId` - Delete menu item
- `PUT /api/plans/:planId/menu-items/reorder` - Reorder menu items

**Trial Management:**
- `GET /api/plans/:planId/trial-status` - Get trial settings and eligibility
- `PUT /api/plans/:planId/trial-settings` - Update trial settings
- `GET /api/users/:userId/trial-usage/:planId` - Check customer's trial usage for a plan
- `POST /api/orders/check-trial-eligibility` - Check if customer is eligible for trial

**Order Management:**
- `GET /api/orders` - Get orders (already exists, enhance with deadline checking)
- `POST /api/orders` - Create order (enhance with deadline and trial validation)
  - Must validate order deadline before creation
  - Must check trial eligibility if trial is requested
  - Must track trial usage
- `PUT /api/orders/:id/status` - Update order status (already exists)
- `GET /api/orders/available-meals` - Get available meals for today/upcoming days (respects deadlines)

### 7. Technical Considerations

**File Storage:**
- Decide on storage solution:
  - Local filesystem (simple, but not scalable)
  - Cloud storage (S3, Cloudinary, etc.) - recommended for production
- Implement file upload middleware (e.g., `multer` for Node.js)
- Image optimization library (e.g., `sharp`)

**Validation:**
- Image file type validation (jpg, png, webp)
- Image size limits (e.g., max 5MB per image, max 10 images per house)
- Menu item validation (required fields, quantity formats)
- Schedule validation (valid day of week, time formats, price ranges)
- **Order deadline validation:**
  - Deadline must be before meal service start time
  - Deadline format validation (HH:MM 24-hour format)
  - Prevent scheduling conflicts
- **Trial settings validation:**
  - Trial limit must be positive integer if enabled
  - Trial price must be <= regular price (or free)
  - Trial validity period must be valid option
- **Meal type validation:**
  - Valid meal types: "lunch", "dinner", "both"
  - Time slot validation (start < end)
  - Delivery window validation (must be after order deadline)

**Performance:**
- Image lazy loading
- Pagination for large image galleries
- Optimistic UI updates where appropriate
- Caching for frequently accessed data

**Security:**
- Authentication/authorization checks (only owner can modify their houses)
- File upload security (validate file types, scan for malware if possible)
- Rate limiting on upload endpoints
- Image URL signing/expiration for private images (if needed)

### 8. Implementation Priority

**Phase 1 - Core Features:**
1. Image upload and management for houses
2. Enhanced meal plan form with structured menu items
3. Basic day-wise availability toggle
4. **Order deadline setting and validation**
5. **Meal type selection (lunch/dinner) for day-wise scheduling**
6. **Trial settings (enable/disable, limit, price)**

**Phase 2 - Advanced Features:**
1. Weekly schedule interface with day-wise pricing and meal types
2. Menu item images and detailed information
3. Advanced scheduling (time slots, max orders, delivery windows)
4. **One-time meal plan creation (separate from subscriptions)**
5. **Trial eligibility checking and tracking**
6. **Order deadline countdown and validation in real-time**

**Phase 3 - Polish:**
1. Image optimization and compression
2. Drag-and-drop interfaces
3. Preview modes
4. Bulk operations
5. **Advanced trial analytics (trial conversion rates)**
6. **Deadline notifications and reminders**
7. **Meal type-specific menu variations**

## Success Criteria
- House owners can upload and manage multiple images for their houses
- House owners can create detailed meal plans with structured menu items
- House owners can set day-wise availability and pricing
- House owners can manage weekly schedules with different menus/prices per day
- **House owners can set order deadlines for each day and meal type**
- **House owners can offer both lunch and dinner options with separate pricing**
- **House owners can create one-time meal options (not just subscriptions)**
- **House owners can configure trial offers with limits and pricing**
- **Order system enforces deadlines and prevents late orders**
- **Trial system tracks usage and enforces limits per customer**
- All features are accessible on mobile devices
- Image uploads are optimized and performant
- UI follows existing design system (glassmorphism theme)
- All API endpoints are properly secured and validated
- **Deadline information is clearly visible to customers**
- **Trial eligibility is clearly communicated to customers**

## Notes
- Consider using a library like `react-dropzone` equivalent for Svelte or build custom drag-and-drop
- For image storage, Cloudinary offers free tier and easy integration
- Consider adding image CDN for faster delivery
- Menu items could be stored as JSON initially, but consider normalization if querying becomes complex
- Weekly schedule could be simplified to just availability flags initially, then enhanced with pricing overrides
- **Order deadlines should account for timezone differences if serving multiple regions**
- **Deadline validation should happen both client-side (UX) and server-side (security)**
- **Trial tracking should be persistent and survive customer account deletion/recreation attempts**
- **Consider adding deadline buffer time (e.g., 30 minutes before actual deadline) for better UX**
- **Meal type (lunch/dinner) should be clearly distinguished in UI with appropriate icons/badges**
- **One-time meals should be prominently displayed separately from subscription plans**
- **Trial offers should have clear terms and conditions displayed to customers**
- **Consider adding deadline extension feature for special circumstances (admin override)**

