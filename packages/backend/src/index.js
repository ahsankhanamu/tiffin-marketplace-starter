
import Fastify from 'fastify';
import dotenv from 'dotenv';
import fastifyCors from '@fastify/cors';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import fastifyJwt from '@fastify/jwt';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fastifySocket from 'fastify-socket';
import dbPlugin from './plugins/db.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import kitchensRoutes from './routes/kitchens.js';
import authRoutes from './routes/auth.js';
import ordersRoutes from './routes/orders.js';
import mealPlansRoutes from './routes/mealPlans.js';
import schedulesRoutes from './routes/schedules.js';
import trialsRoutes from './routes/trials.js';
import adminRoutes from './routes/admin.js';
import authMiddleware from './middleware/auth.js';
import { swaggerSchemas, securitySchemes } from './schemas/swagger.js';

dotenv.config();

const loggerConfig = process.env.NODE_ENV === 'development' ? {
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
      singleLine: false
    }
  }
} : true;

const server = Fastify({ logger: loggerConfig });

// Check if database is initialized
async function checkDatabaseInitialized() {
  try {
    // Try to query a table to see if database is initialized
    await server.prisma.$queryRaw`SELECT 1 FROM "User" LIMIT 1`;
    return true;
  } catch (error) {
    // If table doesn't exist, database needs initialization
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return false;
    }
    // Other errors (connection issues, etc.) - let it fail normally
    throw error;
  }
}

// Register CORS first to handle preflight requests
server.register(fastifyCors, {
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
});

server.register(fastifyJwt, { 
  secret: process.env.JWT_SECRET || 'devsecret'
});

server.register(fastifyMultipart, {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 10
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
server.register(fastifyStatic, {
  root: join(__dirname, '..', 'uploads'),
  prefix: '/uploads/'
});

server.register(dbPlugin);

server.register(fastifySwagger, {
  mode: 'dynamic',
  openapi: {
    openapi: '3.0.0',
    info: {
      title: 'Tiffin Marketplace API',
      version: '0.1.0',
      description: 'API for Tiffin Marketplace with geospatial discovery and realtime order tracking'
    },
    servers: [{ url: `http://localhost:${process.env.PORT||4000}` }],
    components: {
      schemas: swaggerSchemas,
      securitySchemes
    },
    // No global security - each route defines its own
    tags: [
      { name: 'auth', description: 'Authentication endpoints' },
      { name: 'kitchens', description: 'Tiffin kitchen management' },
      { name: 'meal-plans', description: 'Meal plan management' },
      { name: 'orders', description: 'Order management' },
      { name: 'admin', description: 'Admin operations' }
    ]
  }
});
server.register(fastifySwaggerUI, {
  routePrefix: '/api/docs',
  uiConfig: { docExpansion: 'none' }
});

server.register(authMiddleware);

server.register(kitchensRoutes, { prefix: '/api/kitchens' });
server.register(authRoutes, { prefix: '/api/auth' });
server.register(ordersRoutes, { prefix: '/api/orders' });
server.register(mealPlansRoutes, { prefix: '/api/kitchens' });
server.register(schedulesRoutes, { prefix: '/api/plans' });
server.register(trialsRoutes, { prefix: '/api/plans' });
server.register(adminRoutes, { prefix: '/api/admin' });

server.register(fastifySocket, {
  path: '/socket.io',
  cors: { origin: '*' }
});

server.get('/', async () => ({ ok: true, version: '0.1.0' }));

const start = async () => {
  try {
    await server.ready();
    
    // Check if database is initialized (only in development)
    if (process.env.NODE_ENV === 'development' && process.env.AUTO_INIT_DB === 'true') {
      const isInitialized = await checkDatabaseInitialized();
      if (!isInitialized) {
        server.log.warn('⚠️  Database not initialized. Running auto-initialization...');
        try {
          const { execSync } = await import('child_process');
          execSync('node src/init-db.js', {
            stdio: 'inherit',
            cwd: process.cwd(),
            env: process.env
          });
          server.log.info('✅ Database initialized successfully');
        } catch (initError) {
          server.log.error('❌ Auto-initialization failed:', initError.message);
          server.log.warn('💡 Run manually with: npm run db:init');
        }
      }
    } else if (process.env.NODE_ENV === 'development') {
      // Just check and warn, don't auto-init
      try {
        const isInitialized = await checkDatabaseInitialized();
        if (!isInitialized) {
          server.log.warn('⚠️  Database not initialized!');
          server.log.warn('💡 Run: npm run db:init');
        }
      } catch (checkError) {
        // Ignore check errors, let server start and fail on actual DB operations
      }
    }

    await server.listen({ port: process.env.PORT || 4000, host: '0.0.0.0' });
    server.log.info('Server started');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};
start();
