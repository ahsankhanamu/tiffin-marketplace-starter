import { createMealPlanSchema, updateMealPlanSchema } from '../schemas/validation.js';

export default async function (server, opts) {
  server.post('/:kitchenId/plans', {
    schema: {
      tags: ['meal-plans'],
      description: 'Create a meal plan for a kitchen (owner only)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['kitchenId'],
        properties: {
          kitchenId: { type: 'string' }
        }
      },
      body: {
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
      response: {
        201: {
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
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    },
    preHandler: [server.requireRole(['owner', 'admin'])]
  }, async (request, reply) => {
    try {
      const { kitchenId } = request.params;
      const kitchen = await server.prisma.kitchen.findUnique({ where: { id: kitchenId } });
      if (!kitchen) return reply.code(404).send({ error: 'Kitchen not found' });

      if (request.user.role !== 'admin' && kitchen.ownerId !== request.user.id) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const data = createMealPlanSchema.parse(request.body);
      const mealPlan = await server.prisma.mealPlan.create({
        data: {
          kitchenId,
          name: data.name,
          description: data.description || null,
          price: data.price,
          billingCycle: data.billingCycle,
          planType: data.planType || 'subscription',
          availableDays: data.availableDays || [],
          startTime: data.startTime || null,
          endTime: data.endTime || null,
          items: JSON.stringify(data.items || []),
          menuItems: data.menuItems ? JSON.parse(JSON.stringify(data.menuItems)) : null,
          trialEnabled: data.trialEnabled || false,
          trialLimit: data.trialLimit ?? null,
          trialPrice: data.trialPrice ?? null,
          trialValidity: data.trialValidity || null,
          trialNewCustomersOnly: data.trialNewCustomersOnly || false
        },
        include: {
          schedules: true
        }
      });
      return reply.code(201).send(mealPlan);
    } catch (err) {
      if (err.errors) {
        return reply.code(400).send({ error: 'Validation error', details: err.errors });
      }
      return reply.code(400).send({ error: err.message || 'Failed to create meal plan' });
    }
  });

  // IMPORTANT: More specific route must come first
  server.get('/:kitchenId/plans/:planId', {
    schema: {
      tags: ['meal-plans'],
      description: 'Get detailed meal plan by ID',
      params: {
        type: 'object',
        required: ['kitchenId', 'planId'],
        properties: {
          kitchenId: { type: 'string' },
          planId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            kitchenId: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            price: { type: 'number' },
            billingCycle: { type: 'string' },
            planType: { type: 'string' },
            availableDays: { type: 'array', items: { type: 'string' } },
            startTime: { type: 'string' },
            endTime: { type: 'string' },
            items: { type: 'string' },
            menuItems: { type: 'object' },
            trialEnabled: { type: 'boolean' },
            trialLimit: { type: 'number' },
            trialPrice: { type: 'number' },
            trialValidity: { type: 'string' },
            trialNewCustomersOnly: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            schedules: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  mealPlanId: { type: 'string' },
                  dayOfWeek: { type: 'number' },
                  mealType: { type: 'string' },
                  isAvailable: { type: 'boolean' },
                  price: { type: 'number' },
                  startTime: { type: 'string' },
                  endTime: { type: 'string' },
                  orderDeadline: { type: 'string' },
                  deliveryStart: { type: 'string' },
                  deliveryEnd: { type: 'string' },
                  maxOrders: { type: 'number' },
                  menuItems: { type: 'object' },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { kitchenId, planId } = request.params;
      
      server.log.info(`Fetching meal plan: kitchenId=${kitchenId}, planId=${planId}`);
      
      const kitchen = await server.prisma.kitchen.findUnique({ where: { id: kitchenId } });
      if (!kitchen) {
        server.log.warn(`Kitchen not found: ${kitchenId}`);
        return reply.code(404).send({ error: 'Kitchen not found' });
      }

      const mealPlan = await server.prisma.mealPlan.findFirst({
        where: {
          id: planId,
          kitchenId
        },
        include: {
          schedules: {
            orderBy: [
              { dayOfWeek: 'asc' },
              { mealType: 'asc' }
            ]
          }
        }
      });

      if (!mealPlan) {
        server.log.warn(`Meal plan not found: planId=${planId}, kitchenId=${kitchenId}`);
        // Let's also check if the plan exists at all
        const anyPlan = await server.prisma.mealPlan.findUnique({ where: { id: planId } });
        if (anyPlan) {
          server.log.warn(`Meal plan exists but belongs to different kitchen: ${anyPlan.kitchenId}`);
        }
        return reply.code(404).send({ error: 'Meal plan not found' });
      }

      server.log.info(`Meal plan found: ${mealPlan.name}`);
      
      // Explicitly construct response object to ensure proper serialization
      const response = {
        id: mealPlan.id,
        kitchenId: mealPlan.kitchenId,
        name: mealPlan.name,
        description: mealPlan.description,
        price: mealPlan.price,
        billingCycle: mealPlan.billingCycle,
        planType: mealPlan.planType,
        availableDays: mealPlan.availableDays,
        startTime: mealPlan.startTime,
        endTime: mealPlan.endTime,
        items: mealPlan.items,
        menuItems: mealPlan.menuItems,
        trialEnabled: mealPlan.trialEnabled,
        trialLimit: mealPlan.trialLimit,
        trialPrice: mealPlan.trialPrice,
        trialValidity: mealPlan.trialValidity,
        trialNewCustomersOnly: mealPlan.trialNewCustomersOnly,
        createdAt: mealPlan.createdAt,
        updatedAt: mealPlan.updatedAt,
        schedules: mealPlan.schedules.map(s => ({
          id: s.id,
          mealPlanId: s.mealPlanId,
          dayOfWeek: s.dayOfWeek,
          mealType: s.mealType,
          isAvailable: s.isAvailable,
          price: s.price,
          startTime: s.startTime,
          endTime: s.endTime,
          orderDeadline: s.orderDeadline,
          deliveryStart: s.deliveryStart,
          deliveryEnd: s.deliveryEnd,
          maxOrders: s.maxOrders,
          menuItems: s.menuItems,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt
        }))
      };
      
      return response;
    } catch (err) {
      server.log.error('Error fetching meal plan:', err);
      return reply.code(500).send({ error: err.message || 'Failed to fetch meal plan' });
    }
  });

  server.get('/:kitchenId/plans', {
    schema: {
      tags: ['meal-plans'],
      description: 'Get all meal plans for a kitchen',
      params: {
        type: 'object',
        required: ['kitchenId'],
        properties: {
          kitchenId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'array',
          items: {
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
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { kitchenId } = request.params;
    const kitchen = await server.prisma.kitchen.findUnique({ where: { id: kitchenId } });
    if (!kitchen) return reply.code(404).send({ error: 'Kitchen not found' });

    const mealPlans = await server.prisma.mealPlan.findMany({
      where: { kitchenId },
      include: {
        schedules: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return mealPlans;
  });

  server.put('/:kitchenId/plans/:planId', {
    schema: {
      tags: ['meal-plans'],
      description: 'Update meal plan (owner only)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['kitchenId', 'planId'],
        properties: {
          kitchenId: { type: 'string' },
          planId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          price: { type: 'number', minimum: 0 },
          billingCycle: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'one-off'] },
          planType: { type: 'string', enum: ['subscription', 'one-time'] },
          availableDays: { type: 'array', items: { type: 'string' } },
          startTime: { type: 'string' },
          endTime: { type: 'string' },
          menuItems: { type: 'array' },
          trialEnabled: { type: 'boolean' },
          trialLimit: { type: 'number' },
          trialPrice: { type: 'number' },
          trialValidity: { type: 'string' },
          trialNewCustomersOnly: { type: 'boolean' }
        }
      },
      response: {
        200: {
          type: 'object'
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        403: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    },
    preHandler: [server.requireRole(['owner', 'admin'])]
  }, async (request, reply) => {
    try {
      const { kitchenId, planId } = request.params;
      const kitchen = await server.prisma.kitchen.findUnique({ where: { id: kitchenId } });
      if (!kitchen) return reply.code(404).send({ error: 'Kitchen not found' });

      if (request.user.role !== 'admin' && kitchen.ownerId !== request.user.id) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const mealPlan = await server.prisma.mealPlan.findFirst({
        where: { id: planId, kitchenId }
      });
      if (!mealPlan) return reply.code(404).send({ error: 'Meal plan not found' });

      const data = updateMealPlanSchema.parse(request.body);
      const updateData = {};
      
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.price !== undefined) updateData.price = data.price;
      if (data.billingCycle !== undefined) updateData.billingCycle = data.billingCycle;
      if (data.planType !== undefined) updateData.planType = data.planType;
      if (data.availableDays !== undefined) updateData.availableDays = data.availableDays;
      if (data.startTime !== undefined) updateData.startTime = data.startTime;
      if (data.endTime !== undefined) updateData.endTime = data.endTime;
      if (data.menuItems !== undefined) {
        updateData.menuItems = data.menuItems ? JSON.parse(JSON.stringify(data.menuItems)) : null;
      }
      if (data.trialEnabled !== undefined) updateData.trialEnabled = data.trialEnabled;
      if (data.trialLimit !== undefined) updateData.trialLimit = data.trialLimit;
      if (data.trialPrice !== undefined) updateData.trialPrice = data.trialPrice;
      if (data.trialValidity !== undefined) updateData.trialValidity = data.trialValidity;
      if (data.trialNewCustomersOnly !== undefined) updateData.trialNewCustomersOnly = data.trialNewCustomersOnly;

      const updated = await server.prisma.mealPlan.update({
        where: { id: planId },
        data: updateData,
        include: {
          schedules: true
        }
      });

      return updated;
    } catch (err) {
      if (err.errors) {
        return reply.code(400).send({ error: 'Validation error', details: err.errors });
      }
      return reply.code(400).send({ error: err.message || 'Failed to update meal plan' });
    }
  });

  server.delete('/:kitchenId/plans/:planId', {
    schema: {
      tags: ['meal-plans'],
      description: 'Delete meal plan (owner only)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['kitchenId', 'planId'],
        properties: {
          kitchenId: { type: 'string' },
          planId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        },
        403: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    },
    preHandler: [server.requireRole(['owner', 'admin'])]
  }, async (request, reply) => {
    try {
      const { kitchenId, planId } = request.params;
      const kitchen = await server.prisma.kitchen.findUnique({ where: { id: kitchenId } });
      if (!kitchen) return reply.code(404).send({ error: 'Kitchen not found' });

      if (request.user.role !== 'admin' && kitchen.ownerId !== request.user.id) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const mealPlan = await server.prisma.mealPlan.findFirst({
        where: { id: planId, kitchenId }
      });
      if (!mealPlan) return reply.code(404).send({ error: 'Meal plan not found' });

      await server.prisma.mealPlan.delete({
        where: { id: planId }
      });

      return { message: 'Meal plan deleted successfully' };
    } catch (err) {
      server.log.error('Error deleting meal plan:', err);
      return reply.code(400).send({ error: err.message || 'Failed to delete meal plan' });
    }
  });
}

