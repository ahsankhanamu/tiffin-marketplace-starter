export default async function (server, opts) {
  server.get('/:planId/schedule', {
    schema: {
      tags: ['schedules'],
      description: 'Get weekly schedule for a meal plan',
      params: {
        type: 'object',
        required: ['planId'],
        properties: {
          planId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
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
              menuItems: { type: 'object' }
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
    const { planId } = request.params;
    const mealPlan = await server.prisma.mealPlan.findUnique({ where: { id: planId } });
    if (!mealPlan) return reply.code(404).send({ error: 'Meal plan not found' });

    const schedules = await server.prisma.mealPlanSchedule.findMany({
      where: { mealPlanId: planId },
      orderBy: [
        { dayOfWeek: 'asc' },
        { mealType: 'asc' }
      ]
    });

    return schedules;
  });

  server.put('/:planId/schedule', {
    schema: {
      tags: ['schedules'],
      description: 'Update weekly schedule (bulk) (owner only)',
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
        required: ['schedules'],
        properties: {
          schedules: {
            type: 'array',
            items: {
              type: 'object',
              required: ['dayOfWeek', 'mealType', 'orderDeadline'],
              properties: {
                dayOfWeek: { type: 'number', minimum: 0, maximum: 6 },
                mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner'] },
                isAvailable: { type: 'boolean' },
                price: { type: 'number', minimum: 0 },
                startTime: { type: 'string' },
                endTime: { type: 'string' },
                orderDeadline: { type: 'string' },
                deliveryStart: { type: 'string' },
                deliveryEnd: { type: 'string' },
                maxOrders: { type: 'number', minimum: 1 },
                menuItems: { type: 'object' }
              }
            }
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            schedules: { type: 'array' }
          }
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
        }
      }
    },
    preHandler: [server.requireRole(['owner', 'admin'])]
  }, async (request, reply) => {
    try {
      const { planId } = request.params;
      const { schedules } = request.body;

      const mealPlan = await server.prisma.mealPlan.findUnique({
        where: { id: planId },
        include: { kitchen: true }
      });
      if (!mealPlan) return reply.code(404).send({ error: 'Meal plan not found' });

      if (request.user.role !== 'admin' && mealPlan.kitchen.ownerId !== request.user.id) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const validMealTypes = ['breakfast', 'lunch', 'dinner'];
      for (const schedule of schedules) {
        if (!validMealTypes.includes(schedule.mealType)) {
          return reply.code(400).send({ error: `Invalid meal type: ${schedule.mealType}` });
        }
        if (schedule.dayOfWeek < 0 || schedule.dayOfWeek > 6) {
          return reply.code(400).send({ error: 'dayOfWeek must be between 0 and 6' });
        }
        if (!schedule.orderDeadline || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(schedule.orderDeadline)) {
          return reply.code(400).send({ error: 'orderDeadline must be in HH:MM format (24-hour)' });
        }
      }

      await server.prisma.mealPlanSchedule.deleteMany({
        where: { mealPlanId: planId }
      });

      const createdSchedules = await Promise.all(
        schedules.map(schedule =>
          server.prisma.mealPlanSchedule.create({
            data: {
              mealPlanId: planId,
              dayOfWeek: schedule.dayOfWeek,
              mealType: schedule.mealType,
              isAvailable: schedule.isAvailable !== undefined ? schedule.isAvailable : true,
              price: schedule.price || null,
              startTime: schedule.startTime || null,
              endTime: schedule.endTime || null,
              orderDeadline: schedule.orderDeadline,
              deliveryStart: schedule.deliveryStart || null,
              deliveryEnd: schedule.deliveryEnd || null,
              maxOrders: schedule.maxOrders || null,
              menuItems: schedule.menuItems ? JSON.parse(JSON.stringify(schedule.menuItems)) : null
            }
          })
        )
      );

      return { message: 'Schedule updated successfully', schedules: createdSchedules };
    } catch (err) {
      server.log.error('Error updating schedule:', err);
      return reply.code(400).send({ error: err.message || 'Failed to update schedule' });
    }
  });

  server.put('/:planId/schedule/:dayOfWeek/:mealType', {
    schema: {
      tags: ['schedules'],
      description: 'Update specific day/meal type schedule (owner only)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['planId', 'dayOfWeek', 'mealType'],
        properties: {
          planId: { type: 'string' },
          dayOfWeek: { type: 'string' },
          mealType: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          isAvailable: { type: 'boolean' },
          price: { type: 'number', minimum: 0 },
          startTime: { type: 'string' },
          endTime: { type: 'string' },
          orderDeadline: { type: 'string' },
          deliveryStart: { type: 'string' },
          deliveryEnd: { type: 'string' },
          maxOrders: { type: 'number', minimum: 1 },
          menuItems: { type: 'object' }
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
      const { planId, dayOfWeek, mealType } = request.params;
      const dayOfWeekNum = parseInt(dayOfWeek);

      if (isNaN(dayOfWeekNum) || dayOfWeekNum < 0 || dayOfWeekNum > 6) {
        return reply.code(400).send({ error: 'dayOfWeek must be between 0 and 6' });
      }

      if (!['breakfast', 'lunch', 'dinner'].includes(mealType)) {
        return reply.code(400).send({ error: 'mealType must be "breakfast", "lunch", or "dinner"' });
      }

      const mealPlan = await server.prisma.mealPlan.findUnique({
        where: { id: planId },
        include: { kitchen: true }
      });
      if (!mealPlan) return reply.code(404).send({ error: 'Meal plan not found' });

      if (request.user.role !== 'admin' && mealPlan.kitchen.ownerId !== request.user.id) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const data = request.body;
      if (data.orderDeadline && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(data.orderDeadline)) {
        return reply.code(400).send({ error: 'orderDeadline must be in HH:MM format (24-hour)' });
      }

      const updateData = {};
      if (data.isAvailable !== undefined) updateData.isAvailable = data.isAvailable;
      if (data.price !== undefined) updateData.price = data.price;
      if (data.startTime !== undefined) updateData.startTime = data.startTime;
      if (data.endTime !== undefined) updateData.endTime = data.endTime;
      if (data.orderDeadline !== undefined) updateData.orderDeadline = data.orderDeadline;
      if (data.deliveryStart !== undefined) updateData.deliveryStart = data.deliveryStart;
      if (data.deliveryEnd !== undefined) updateData.deliveryEnd = data.deliveryEnd;
      if (data.maxOrders !== undefined) updateData.maxOrders = data.maxOrders;
      if (data.menuItems !== undefined) {
        updateData.menuItems = data.menuItems ? JSON.parse(JSON.stringify(data.menuItems)) : null;
      }

      const schedule = await server.prisma.mealPlanSchedule.upsert({
        where: {
          mealPlanId_dayOfWeek_mealType: {
            mealPlanId: planId,
            dayOfWeek: dayOfWeekNum,
            mealType
          }
        },
        update: updateData,
        create: {
          mealPlanId: planId,
          dayOfWeek: dayOfWeekNum,
          mealType,
          orderDeadline: data.orderDeadline || '10:00',
          ...updateData
        }
      });

      return schedule;
    } catch (err) {
      server.log.error('Error updating schedule:', err);
      return reply.code(400).send({ error: err.message || 'Failed to update schedule' });
    }
  });

  server.get('/:planId/deadlines', {
    schema: {
      tags: ['schedules'],
      description: 'Get order deadlines for upcoming days',
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
          days: { type: 'number', default: 7, minimum: 1, maximum: 30 }
        }
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string' },
              dayOfWeek: { type: 'number' },
              mealType: { type: 'string' },
              orderDeadline: { type: 'string' },
              isAvailable: { type: 'boolean' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { planId } = request.params;
    const { days = 7 } = request.query;
    const mealPlan = await server.prisma.mealPlan.findUnique({ where: { id: planId } });
    if (!mealPlan) return reply.code(404).send({ error: 'Meal plan not found' });

    const today = new Date();
    const deadlines = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dayOfWeek = date.getDay();

      const schedules = await server.prisma.mealPlanSchedule.findMany({
        where: {
          mealPlanId: planId,
          dayOfWeek,
          isAvailable: true
        }
      });

      for (const schedule of schedules) {
        deadlines.push({
          date: date.toISOString().split('T')[0],
          dayOfWeek,
          mealType: schedule.mealType,
          orderDeadline: schedule.orderDeadline,
          isAvailable: schedule.isAvailable
        });
      }
    }

    return deadlines;
  });
}

