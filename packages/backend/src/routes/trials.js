export default async function (server, opts) {
  server.get('/:planId/trial-status', {
    schema: {
      tags: ['trials'],
      description: 'Get trial settings and eligibility for a meal plan',
      params: {
        type: 'object',
        required: ['planId'],
        properties: {
          planId: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            trialEnabled: { type: 'boolean' },
            trialLimit: { type: 'number' },
            trialPrice: { type: 'number' },
            trialValidity: { type: 'string' },
            trialNewCustomersOnly: { type: 'boolean' },
            userEligible: { type: 'boolean' },
            userUsage: { type: 'object' }
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
    const { planId } = request.params;
    const { userId } = request.query;
    const mealPlan = await server.prisma.mealPlan.findUnique({ where: { id: planId } });
    if (!mealPlan) return reply.code(404).send({ error: 'Meal plan not found' });

    const response = {
      trialEnabled: mealPlan.trialEnabled,
      trialLimit: mealPlan.trialLimit,
      trialPrice: mealPlan.trialPrice,
      trialValidity: mealPlan.trialValidity,
      trialNewCustomersOnly: mealPlan.trialNewCustomersOnly,
      userEligible: false,
      userUsage: null
    };

    if (userId && mealPlan.trialEnabled) {
      const trialUsage = await server.prisma.trialUsage.findUnique({
        where: {
          userId_mealPlanId: {
            userId,
            mealPlanId: planId
          }
        }
      });

      if (trialUsage) {
        response.userUsage = {
          orderCount: trialUsage.orderCount,
          firstUsedAt: trialUsage.firstUsedAt,
          lastUsedAt: trialUsage.lastUsedAt
        };

        if (mealPlan.trialLimit && trialUsage.orderCount >= mealPlan.trialLimit) {
          response.userEligible = false;
        } else {
          response.userEligible = true;
        }
      } else {
        response.userEligible = true;
        response.userUsage = {
          orderCount: 0,
          firstUsedAt: null,
          lastUsedAt: null
        };
      }

      if (mealPlan.trialNewCustomersOnly && response.userUsage.orderCount > 0) {
        response.userEligible = false;
      }
    }

    return response;
  });

  server.put('/:planId/trial-settings', {
    schema: {
      tags: ['trials'],
      description: 'Update trial settings (owner only)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['planId'],
        properties: {
          planId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          trialEnabled: { type: 'boolean' },
          trialLimit: { type: 'number', minimum: 1 },
          trialPrice: { type: 'number', minimum: 0 },
          trialValidity: { type: 'string', enum: ['first-order', 'first-week', 'first-month'] },
          trialNewCustomersOnly: { type: 'boolean' }
        }
      },
      response: {
        200: { type: 'object' },
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
        }
      }
    },
    preHandler: [server.requireRole(['owner', 'admin'])]
  }, async (request, reply) => {
    try {
      const { planId } = request.params;
      const mealPlan = await server.prisma.mealPlan.findUnique({
        where: { id: planId },
        include: { kitchen: true }
      });
      if (!mealPlan) return reply.code(404).send({ error: 'Meal plan not found' });

      if (request.user.role !== 'admin' && mealPlan.kitchen.ownerId !== request.user.id) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const data = request.body;
      const updateData = {};

      if (data.trialEnabled !== undefined) updateData.trialEnabled = data.trialEnabled;
      if (data.trialLimit !== undefined) updateData.trialLimit = data.trialLimit;
      if (data.trialPrice !== undefined) updateData.trialPrice = data.trialPrice;
      if (data.trialValidity !== undefined) updateData.trialValidity = data.trialValidity;
      if (data.trialNewCustomersOnly !== undefined) updateData.trialNewCustomersOnly = data.trialNewCustomersOnly;

      if (data.trialPrice !== undefined && data.trialPrice !== null && mealPlan.price && data.trialPrice > mealPlan.price) {
        return reply.code(400).send({ error: 'Trial price must be less than or equal to regular price' });
      }

      const updated = await server.prisma.mealPlan.update({
        where: { id: planId },
        data: updateData
      });

      return updated;
    } catch (err) {
      server.log.error('Error updating trial settings:', err);
      return reply.code(400).send({ error: err.message || 'Failed to update trial settings' });
    }
  });

  server.get('/users/:userId/trial-usage/:planId', {
    schema: {
      tags: ['trials'],
      description: 'Check customer trial usage for a plan',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['userId', 'planId'],
        properties: {
          userId: { type: 'string' },
          planId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            orderCount: { type: 'number' },
            firstUsedAt: { type: 'string' },
            lastUsedAt: { type: 'string' },
            eligible: { type: 'boolean' }
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
    const { userId, planId } = request.params;
    const mealPlan = await server.prisma.mealPlan.findUnique({ where: { id: planId } });
    if (!mealPlan) return reply.code(404).send({ error: 'Meal plan not found' });

    const trialUsage = await server.prisma.trialUsage.findUnique({
      where: {
        userId_mealPlanId: {
          userId,
          mealPlanId: planId
        }
      }
    });

    if (!trialUsage) {
      return {
        orderCount: 0,
        firstUsedAt: null,
        lastUsedAt: null,
        eligible: mealPlan.trialEnabled
      };
    }

    let eligible = true;
    if (mealPlan.trialLimit && trialUsage.orderCount >= mealPlan.trialLimit) {
      eligible = false;
    }
    if (mealPlan.trialNewCustomersOnly && trialUsage.orderCount > 0) {
      eligible = false;
    }

    return {
      orderCount: trialUsage.orderCount,
      firstUsedAt: trialUsage.firstUsedAt,
      lastUsedAt: trialUsage.lastUsedAt,
      eligible
    };
  });

  server.post('/orders/check-trial-eligibility', {
    schema: {
      tags: ['trials'],
      description: 'Check if customer is eligible for trial',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['planId'],
        properties: {
          planId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            eligible: { type: 'boolean' },
            reason: { type: 'string' },
            trialPrice: { type: 'number' }
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
    const { planId } = request.body;
    const userId = request.user?.id;

    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const mealPlan = await server.prisma.mealPlan.findUnique({ where: { id: planId } });
    if (!mealPlan) return reply.code(404).send({ error: 'Meal plan not found' });

    if (!mealPlan.trialEnabled) {
      return {
        eligible: false,
        reason: 'Trial not enabled for this meal plan',
        trialPrice: null
      };
    }

    const trialUsage = await server.prisma.trialUsage.findUnique({
      where: {
        userId_mealPlanId: {
          userId,
          mealPlanId: planId
        }
      }
    });

    let eligible = true;
    let reason = 'Eligible for trial';

    if (mealPlan.trialNewCustomersOnly) {
      const userOrders = await server.prisma.order.count({
        where: {
          userId,
          planId
        }
      });
      if (userOrders > 0) {
        eligible = false;
        reason = 'Trial only available for new customers';
      }
    }

    if (trialUsage) {
      if (mealPlan.trialLimit && trialUsage.orderCount >= mealPlan.trialLimit) {
        eligible = false;
        reason = `Trial limit reached (${mealPlan.trialLimit} orders)`;
      }
    }

    return {
      eligible,
      reason,
      trialPrice: mealPlan.trialPrice
    };
  });
}

