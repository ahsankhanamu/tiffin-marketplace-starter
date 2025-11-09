export const swaggerSchemas = {
  registerRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 6 },
      name: { type: 'string' },
      role: { type: 'string', enum: ['user', 'owner', 'admin'], default: 'user' }
    }
  },
  loginRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string' }
    }
  },
  authResponse: {
    type: 'object',
    properties: {
      token: { type: 'string' },
      user: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          name: { type: 'string' },
          role: { type: 'string' }
        }
      }
    }
  },
  createKitchenRequest: {
    type: 'object',
    required: ['title', 'lng', 'lat'],
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      lng: { type: 'number', minimum: -180, maximum: 180 },
      lat: { type: 'number', minimum: -90, maximum: 90 }
    }
  },
  kitchenResponse: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      ownerId: { type: 'string' },
      location: { type: 'object' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },
  createMealPlanRequest: {
    type: 'object',
    required: ['name', 'price', 'billingCycle'],
    properties: {
      name: { type: 'string' },
      price: { type: 'number', minimum: 0 },
      billingCycle: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'one-off'] },
      availableDays: { type: 'array', items: { type: 'string' } },
      startTime: { type: 'string' },
      endTime: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            qty: { type: 'string' }
          }
        }
      }
    }
  },
  mealPlanResponse: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      kitchenId: { type: 'string' },
      name: { type: 'string' },
      price: { type: 'number' },
      billingCycle: { type: 'string' },
      availableDays: { type: 'array', items: { type: 'string' } },
      startTime: { type: 'string' },
      endTime: { type: 'string' },
      items: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },
  createOrderRequest: {
    type: 'object',
    required: ['kitchenId', 'planId', 'amount'],
    properties: {
      kitchenId: { type: 'string' },
      planId: { type: 'string' },
      amount: { type: 'number', minimum: 0 }
    }
  },
  orderResponse: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      userId: { type: 'string' },
      kitchenId: { type: 'string' },
      planId: { type: 'string' },
      status: { type: 'string', enum: ['created', 'preparing', 'out-for-delivery', 'delivered'] },
      amount: { type: 'number' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },
  updateOrderStatusRequest: {
    type: 'object',
    required: ['status'],
    properties: {
      status: { type: 'string', enum: ['created', 'preparing', 'out-for-delivery', 'delivered'] }
    }
  },
  errorResponse: {
    type: 'object',
    properties: {
      error: { type: 'string' }
    }
  }
};

export const securitySchemes = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT'
  }
};

