import fp from 'fastify-plugin';

export default fp(async (server) => {
  server.decorate('authenticate', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      server.log.warn('JWT verification failed:', err.message);
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  server.decorate('requireRole', (roles) => {
    return async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        server.log.warn('JWT verification failed:', err.message);
        return reply.code(401).send({ error: 'Unauthorized' });
      }
      
      if (!request.user || !roles.includes(request.user.role)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
    };
  });
});

