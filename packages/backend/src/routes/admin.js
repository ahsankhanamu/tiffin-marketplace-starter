export default async function (server, opts) {
  // Only apply admin authentication to routes in this plugin (not globally)
  server.addHook('onRequest', async (request, reply) => {
    // Only apply to routes under /api/admin
    if (request.url.startsWith('/api/admin')) {
      try {
        await request.jwtVerify();
      } catch (err) {
        server.log.warn('JWT verification failed for admin route:', err.message);
        return reply.code(401).send({ error: 'Unauthorized' });
      }
      
      if (!request.user || !['admin'].includes(request.user.role)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
    }
  });

  server.get('/users', {
    schema: {
      tags: ['admin'],
      description: 'Get all users',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['user', 'owner', 'admin'] },
          limit: { type: 'number', default: 50 },
          offset: { type: 'number', default: 0 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            users: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string' },
                  createdAt: { type: 'string', format: 'date-time' }
                }
              }
            },
            total: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { role, limit = 50, offset = 0 } = request.query;
    const where = role ? { role } : {};
    const [users, total] = await Promise.all([
      server.prisma.user.findMany({
        where,
        select: { id: true, email: true, name: true, role: true, createdAt: true },
        take: parseInt(limit),
        skip: parseInt(offset),
        orderBy: { createdAt: 'desc' }
      }),
      server.prisma.user.count({ where })
    ]);
    return { users, total };
  });

  server.get('/kitchens', {
    schema: {
      tags: ['admin'],
      description: 'Get all kitchens',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 50 },
          offset: { type: 'number', default: 0 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            kitchens: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  ownerId: { type: 'string' },
                  location: { type: 'object' },
                  createdAt: { type: 'string', format: 'date-time' }
                }
              }
            },
            total: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { limit = 50, offset = 0 } = request.query;
      const [kitchens, total] = await Promise.all([
      server.prisma.kitchen.findMany({
        include: {
          owner: { select: { id: true, name: true, email: true } },
          mealPlans: true
        },
        take: parseInt(limit),
        skip: parseInt(offset),
        orderBy: { createdAt: 'desc' }
      }),
      server.prisma.kitchen.count()
    ]);
    return { kitchens, total };
  });

  server.get('/orders', {
    schema: {
      tags: ['admin'],
      description: 'Get all orders',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['created', 'preparing', 'out-for-delivery', 'delivered'] },
          limit: { type: 'number', default: 50 },
          offset: { type: 'number', default: 0 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            orders: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  userId: { type: 'string' },
                  houseId: { type: 'string' },
                  planId: { type: 'string' },
                  status: { type: 'string', enum: ['created', 'preparing', 'out-for-delivery', 'delivered'] },
                  amount: { type: 'number' },
                  createdAt: { type: 'string', format: 'date-time' }
                }
              }
            },
            total: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { status, limit = 50, offset = 0 } = request.query;
    const where = status ? { status } : {};
    const [orders, total] = await Promise.all([
      server.prisma.order.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          kitchen: { select: { id: true, title: true } }
        },
        take: parseInt(limit),
        skip: parseInt(offset),
        orderBy: { createdAt: 'desc' }
      }),
      server.prisma.order.count({ where })
    ]);
    return { orders, total };
  });

  server.delete('/users/:id', {
    schema: {
      tags: ['admin'],
      description: 'Delete a user',
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
    const { id } = request.params;
    if (id === request.user.id) {
      return reply.code(400).send({ error: 'Cannot delete yourself' });
    }
    await server.prisma.user.delete({ where: { id } });
    return { success: true };
  });

  server.delete('/kitchens/:id', {
    schema: {
      tags: ['admin'],
      description: 'Delete a kitchen',
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
    const { id } = request.params;
    await server.prisma.kitchen.delete({ where: { id } });
    return { success: true };
  });
}

