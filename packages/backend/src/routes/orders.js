import { createOrderSchema, updateOrderStatusSchema } from '../schemas/validation.js';

export default async function (server, opts) {
  server.post('/', {
    schema: {
      tags: ['orders'],
      description: 'Place a new order',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['kitchenId', 'planId', 'amount'],
        properties: {
          kitchenId: { type: 'string' },
          planId: { type: 'string' },
          amount: { type: 'number', minimum: 0 }
        }
      },
      response: {
        201: {
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
    preHandler: [server.authenticate]
  }, async (request, reply) => {
    try {
      const data = createOrderSchema.parse(request.body);
      const userId = request.user.id;

      const kitchen = await server.prisma.kitchen.findUnique({ where: { id: data.kitchenId } });
      if (!kitchen) return reply.code(404).send({ error: 'Kitchen not found' });

      const mealPlan = await server.prisma.mealPlan.findUnique({ where: { id: data.planId } });
      if (!mealPlan) return reply.code(404).send({ error: 'Meal plan not found' });

      let finalAmount = data.amount || mealPlan.price;
      let isTrial = data.isTrial || false;

      if (isTrial && mealPlan.trialEnabled) {
        const trialUsage = await server.prisma.trialUsage.findUnique({
          where: {
            userId_mealPlanId: {
              userId,
              mealPlanId: data.planId
            }
          }
        });

        if (mealPlan.trialNewCustomersOnly) {
          const existingOrders = await server.prisma.order.count({
            where: { userId, planId: data.planId }
          });
          if (existingOrders > 0) {
            return reply.code(400).send({ error: 'Trial only available for new customers' });
          }
        }

        if (mealPlan.trialLimit) {
          const currentCount = trialUsage?.orderCount || 0;
          if (currentCount >= mealPlan.trialLimit) {
            return reply.code(400).send({ error: `Trial limit reached (${mealPlan.trialLimit} orders)` });
          }
        }

        finalAmount = mealPlan.trialPrice ?? 0;
      } else if (isTrial) {
        return reply.code(400).send({ error: 'Trial not enabled for this meal plan' });
      }

      if (data.mealType) {
        const scheduledDate = data.scheduledDate ? new Date(data.scheduledDate) : new Date();
        const dayOfWeek = scheduledDate.getDay();

        const schedule = await server.prisma.mealPlanSchedule.findUnique({
          where: {
            mealPlanId_dayOfWeek_mealType: {
              mealPlanId: data.planId,
              dayOfWeek,
              mealType: data.mealType
            }
          }
        });

        if (!schedule || !schedule.isAvailable) {
          return reply.code(400).send({ error: `Meal not available for ${data.mealType} on this day` });
        }

        const now = new Date();
        const [deadlineHour, deadlineMinute] = schedule.orderDeadline.split(':').map(Number);
        const deadline = new Date(scheduledDate);
        deadline.setHours(deadlineHour, deadlineMinute, 0, 0);

        if (now > deadline) {
          return reply.code(400).send({ error: `Order deadline has passed. Orders must be placed by ${schedule.orderDeadline}` });
        }

        if (schedule.maxOrders) {
          const todayOrders = await server.prisma.order.count({
            where: {
              planId: data.planId,
              mealType: data.mealType,
              scheduledDate: {
                gte: new Date(scheduledDate.setHours(0, 0, 0, 0)),
                lt: new Date(scheduledDate.setHours(23, 59, 59, 999))
              }
            }
          });
          if (todayOrders >= schedule.maxOrders) {
            return reply.code(400).send({ error: 'Maximum orders reached for this meal' });
          }
        }

        if (schedule.price !== null) {
          finalAmount = schedule.price;
        }
      }

      const order = await server.prisma.order.create({
        data: {
          userId,
          kitchenId: data.kitchenId,
          planId: data.planId,
          mealType: data.mealType || null,
          isTrial,
          amount: finalAmount,
          scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null
        },
        include: {
          kitchen: { select: { id: true, title: true } },
          user: { select: { id: true, name: true, email: true } }
        }
      });

      if (isTrial && mealPlan.trialEnabled) {
        await server.prisma.trialUsage.upsert({
          where: {
            userId_mealPlanId: {
              userId,
              mealPlanId: data.planId
            }
          },
          update: {
            orderCount: { increment: 1 },
            lastUsedAt: new Date()
          },
          create: {
            userId,
            mealPlanId: data.planId,
            orderCount: 1
          }
        });
      }

      server.io.emit('order:created', { orderId: order.id, kitchenId: order.kitchenId, userId });
      return reply.code(201).send(order);
    } catch (err) {
      if (err.errors) {
        return reply.code(400).send({ error: 'Validation error', details: err.errors });
      }
      return reply.code(400).send({ error: err.message || 'Failed to create order' });
    }
  });

  server.get('/:id', {
    schema: {
      tags: ['orders'],
      description: 'Get order details by ID',
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
            id: { type: 'string' },
            userId: { type: 'string' },
            kitchenId: { type: 'string' },
            planId: { type: 'string' },
            status: { type: 'string', enum: ['created', 'preparing', 'out-for-delivery', 'delivered'] },
            amount: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' }
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
    preHandler: [server.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    const order = await server.prisma.order.findUnique({
      where: { id },
      include: {
        kitchen: { select: { id: true, title: true } },
        user: { select: { id: true, name: true, email: true } }
      }
    });

    if (!order) return reply.code(404).send({ error: 'Order not found' });

    if (request.user.role !== 'admin' && order.userId !== request.user.id) {
      const kitchen = await server.prisma.kitchen.findUnique({ where: { id: order.kitchenId } });
      if (kitchen && kitchen.ownerId !== request.user.id) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
    }

      return order;
  });

  server.post('/validate-deadline', {
    schema: {
      tags: ['orders'],
      description: 'Validate if order can be placed (check deadline)',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['planId', 'mealType', 'scheduledDate'],
        properties: {
          planId: { type: 'string' },
          mealType: { type: 'string', enum: ['lunch', 'dinner'] },
          scheduledDate: { type: 'string', format: 'date-time' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            valid: { type: 'boolean' },
            reason: { type: 'string' },
            deadline: { type: 'string' }
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
      const { planId, mealType, scheduledDate } = request.body;
      const mealPlan = await server.prisma.mealPlan.findUnique({ where: { id: planId } });
      if (!mealPlan) return reply.code(404).send({ error: 'Meal plan not found' });

      const date = new Date(scheduledDate);
      const dayOfWeek = date.getDay();

      const schedule = await server.prisma.mealPlanSchedule.findUnique({
        where: {
          mealPlanId_dayOfWeek_mealType: {
            mealPlanId: planId,
            dayOfWeek,
            mealType
          }
        }
      });

      if (!schedule || !schedule.isAvailable) {
        return {
          valid: false,
          reason: `Meal not available for ${mealType} on this day`,
          deadline: null
        };
      }

      const now = new Date();
      const [deadlineHour, deadlineMinute] = schedule.orderDeadline.split(':').map(Number);
      const deadline = new Date(date);
      deadline.setHours(deadlineHour, deadlineMinute, 0, 0);

      if (now > deadline) {
        return {
          valid: false,
          reason: `Order deadline has passed. Orders must be placed by ${schedule.orderDeadline}`,
          deadline: schedule.orderDeadline
        };
      }

      return {
        valid: true,
        reason: 'Order can be placed',
        deadline: schedule.orderDeadline
      };
    } catch (err) {
      server.log.error('Error validating deadline:', err);
      return reply.code(400).send({ error: err.message || 'Failed to validate deadline' });
    }
  });

  server.get('/available-meals', {
    schema: {
      tags: ['orders'],
      description: 'Get available meals for today/upcoming days (respects deadlines)',
      querystring: {
        type: 'object',
        properties: {
          kitchenId: { type: 'string' },
          days: { type: 'number', default: 7, minimum: 1, maximum: 30 }
        }
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              planId: { type: 'string' },
              planName: { type: 'string' },
              date: { type: 'string' },
              dayOfWeek: { type: 'number' },
              mealType: { type: 'string' },
              price: { type: 'number' },
              orderDeadline: { type: 'string' },
              isAvailable: { type: 'boolean' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { kitchenId, days = 7 } = request.query;
      const today = new Date();
      const availableMeals = [];

      const whereClause = kitchenId ? { kitchenId } : {};
      const mealPlans = await server.prisma.mealPlan.findMany({
        where: whereClause,
        include: {
          schedules: true
        }
      });

      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dayOfWeek = date.getDay();
        const now = new Date();

        for (const plan of mealPlans) {
          for (const schedule of plan.schedules) {
            if (schedule.dayOfWeek === dayOfWeek && schedule.isAvailable) {
              const [deadlineHour, deadlineMinute] = schedule.orderDeadline.split(':').map(Number);
              const deadline = new Date(date);
              deadline.setHours(deadlineHour, deadlineMinute, 0, 0);

              if (now <= deadline) {
                availableMeals.push({
                  planId: plan.id,
                  planName: plan.name,
                  date: date.toISOString().split('T')[0],
                  dayOfWeek,
                  mealType: schedule.mealType,
                  price: schedule.price ?? plan.price,
                  orderDeadline: schedule.orderDeadline,
                  isAvailable: true
                });
              }
            }
          }
        }
      }

      return availableMeals;
    } catch (err) {
      server.log.error('Error fetching available meals:', err);
      return reply.code(400).send({ error: err.message || 'Failed to fetch available meals' });
    }
  });

  server.patch('/:id/status', {
    schema: {
      tags: ['orders'],
      description: 'Update order status (owner/admin only)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['created', 'preparing', 'out-for-delivery', 'delivered', 'cancelled'] }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            kitchenId: { type: 'string' },
            planId: { type: 'string' },
            status: { type: 'string', enum: ['created', 'preparing', 'out-for-delivery', 'delivered', 'cancelled'] },
            amount: { type: 'number' },
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
      const { id } = request.params;
      const data = updateOrderStatusSchema.parse(request.body);

      const order = await server.prisma.order.findUnique({
        where: { id },
        include: { kitchen: true }
      });

      if (!order) return reply.code(404).send({ error: 'Order not found' });

      if (request.user.role !== 'admin' && order.kitchen.ownerId !== request.user.id) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const updated = await server.prisma.order.update({
        where: { id },
        data: { status: data.status }
      });

      server.io.emit('order:status', { orderId: id, status: data.status, userId: order.userId });
      return updated;
    } catch (err) {
      if (err.errors) {
        return reply.code(400).send({ error: 'Validation error', details: err.errors });
      }
      return reply.code(400).send({ error: err.message || 'Failed to update order status' });
    }
  });
}
