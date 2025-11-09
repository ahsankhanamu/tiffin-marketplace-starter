# How Routes Are Created in the Backend

## Overview

The `/api/auth/register` route is created through a multi-step process using Fastify's plugin system and route prefixes.

## Step-by-Step Process

### 1. Route Definition (`packages/backend/src/routes/auth.js`)

```javascript
import fp from 'fastify-plugin';

export default fp(async (server, opts) => {
  // Define the route with path '/register'
  server.post('/register', {
    schema: {
      // ... route schema definition
    }
  }, async (request, reply) => {
    // ... route handler logic
  });
});
```

**Key Points:**
- Uses `fastify-plugin` (`fp`) to wrap the route definitions
- Defines route path as `/register` (relative path)
- The `server` parameter is the Fastify instance passed when the plugin is registered

### 2. Route Registration (`packages/backend/src/index.js`)

```javascript
import authRoutes from './routes/auth.js';

// Register the auth routes plugin with prefix '/api/auth'
server.register(authRoutes, { prefix: '/api/auth' });
```

**What happens:**
- `server.register()` loads the plugin
- The `prefix: '/api/auth'` option prepends this path to all routes in the plugin
- So `/register` becomes `/api/auth/register`

### 3. Complete Path Construction

```
Route defined:     '/register'
Prefix applied:    '/api/auth'
Final route:       '/api/auth/register'
```

## How `fastify-plugin` Works

The `fp()` wrapper (from `fastify-plugin`) does several things:

1. **Encapsulation**: Makes the plugin's scope isolated
2. **Decorator Sharing**: Allows the plugin to access server decorators (like `server.prisma`, `server.jwt`)
3. **Plugin Registration**: Ensures the plugin is registered correctly with Fastify

## Route Registration Order

Routes are registered in this order in `index.js`:

1. CORS middleware
2. JWT plugin
3. Auth middleware (decorates `server.authenticate`)
4. Swagger/OpenAPI
5. **Route plugins** (including `authRoutes` with prefix `/api/auth`)
6. Socket.io

## Example Flow

```
1. Server starts → index.js loads
2. Import authRoutes → loads auth.js
3. server.register(authRoutes, { prefix: '/api/auth' })
   ↓
4. Fastify calls the plugin function with server instance
   ↓
5. Inside plugin: server.post('/register', ...)
   ↓
6. Fastify registers route as: '/api/auth' + '/register' = '/api/auth/register'
```

## Why Use `fastify-plugin`?

- **Isolation**: Each route file is a separate plugin
- **Reusability**: Can be easily tested or reused
- **Decorator Access**: Can use server decorators like `server.prisma`, `server.jwt`
- **Encapsulation**: Routes don't interfere with each other

## Current Route Structure

All auth routes are defined in `auth.js`:
- `/register` → `/api/auth/register`
- `/login` → `/api/auth/login`
- `/forgot-password` → `/api/auth/forgot-password`
- `/verify-otp` → `/api/auth/verify-otp`
- `/reset-password` → `/api/auth/reset-password`

All get the `/api/auth` prefix from the registration in `index.js`.

