export default async function (server, opts) {
  server.post('/', {
    schema: {
      tags: ['subscriptions'],
      description: 'Subscribe to a meal plan',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['mealPlanId', 'mealType'],
        properties: {
          mealPlanId: { type: 'string' },
          mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner'] },
          dayOfWeek: { type: 'number', minimum: 0, maximum: 6 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            mealPlanId: { type: 'string' },
            mealType: { type: 'string' },
            dayOfWeek: { type: 'number' },
            isActive: { type: 'boolean' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    },
    preHandler: [server.authenticate]
  }, async (request, reply) => {
    try {
      const { mealPlanId, mealType, dayOfWeek } = request.body;
      const userId = request.user.id;

      // Check if meal plan exists
      const mealPlan = await server.prisma.mealPlan.findUnique({
        where: { id: mealPlanId }
      });
      if (!mealPlan) {
        return reply.code(404).send({ error: 'Meal plan not found' });
      }

      // Check if subscription already exists
      const existing = await server.prisma.subscription.findFirst({
        where: {
          userId,
          mealPlanId,
          mealType,
          dayOfWeek: dayOfWeek ?? null
        }
      });

      if (existing) {
        // Reactivate if inactive
        if (!existing.isActive) {
          const updated = await server.prisma.subscription.update({
            where: { id: existing.id },
            data: { isActive: true }
          });
          return updated;
        }
        return existing;
      }

      // Create new subscription
      const subscription = await server.prisma.subscription.create({
        data: {
          userId,
          mealPlanId,
          mealType,
          dayOfWeek: dayOfWeek ?? null,
          isActive: true
        }
      });

      return subscription;
    } catch (err) {
      server.log.error('Error creating subscription:', err);
      return reply.code(400).send({ error: err.message || 'Failed to create subscription' });
    }
  });

  server.delete('/:id', {
    schema: {
      tags: ['subscriptions'],
      description: 'Unsubscribe from a meal plan',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }
          }
        }
      }
    },
    preHandler: [server.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = request.user.id;

      const subscription = await server.prisma.subscription.findUnique({
        where: { id }
      });

      if (!subscription) {
        return reply.code(404).send({ error: 'Subscription not found' });
      }

      if (subscription.userId !== userId) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      await server.prisma.subscription.update({
        where: { id },
        data: { isActive: false }
      });

      return { success: true };
    } catch (err) {
      server.log.error('Error deleting subscription:', err);
      return reply.code(400).send({ error: err.message || 'Failed to delete subscription' });
    }
  });

  server.get('/my', {
    schema: {
      tags: ['subscriptions'],
      description: 'Get user subscriptions',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              mealPlanId: { type: 'string' },
              mealType: { type: 'string' },
              dayOfWeek: { type: 'number' },
              isActive: { type: 'boolean' },
              mealPlan: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  kitchenId: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    preHandler: [server.authenticate]
  }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const subscriptions = await server.prisma.subscription.findMany({
        where: {
          userId,
          isActive: true
        },
        include: {
          mealPlan: {
            select: {
              id: true,
              name: true,
              kitchenId: true
            }
          }
        }
      });

      return subscriptions;
    } catch (err) {
      server.log.error('Error fetching subscriptions:', err);
      return reply.code(400).send({ error: err.message || 'Failed to fetch subscriptions' });
    }
  });
}

