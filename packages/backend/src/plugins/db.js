import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

async function dbPlugin(server, opts) {
  const prisma = new PrismaClient();

  server.decorate('prisma', prisma);

  server.addHook('onClose', async (instance) => {
    await prisma.$disconnect();
  });
}

export default fp(dbPlugin, {
  name: 'plugin-db'
});

