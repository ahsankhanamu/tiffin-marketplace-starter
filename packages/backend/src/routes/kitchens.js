import { createKitchenSchema } from '../schemas/validation.js';

export default async function (server, opts) {
  server.get('/nearby', {
    schema: {
      tags: ['kitchens'],
      description: 'Get nearby tiffin kitchens by location',
      querystring: {
        type: 'object',
        required: ['lng', 'lat'],
        properties: {
          lng: { type: 'number', minimum: -180, maximum: 180 },
          lat: { type: 'number', minimum: -90, maximum: 90 },
          radius: { type: 'number', default: 5000, minimum: 0 }
        }
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              location: { type: 'object' },
              distance_m: { type: 'number' }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { lng, lat, radius = 5000 } = request.query;
    if (!lng || !lat) return reply.code(400).send({ error: 'lng and lat required' });

    // If owner is authenticated, return only their kitchens
    try {
      // Try to verify JWT token (optional - won't fail if missing)
      await request.jwtVerify();
      
      if (request.user && request.user.role === 'owner') {
        const userId = request.user.id;
        const ownerKitchens = await server.prisma.kitchen.findMany({
          where: { ownerId: userId },
          select: {
            id: true,
            title: true,
            description: true,
            ownerId: true,
            location: true
          },
          orderBy: { createdAt: 'desc' }
        });

        return ownerKitchens.map(kitchen => {
          let location = kitchen.location;
          if (typeof location === 'string' && location) {
            try {
              location = JSON.parse(location);
            } catch {
              location = null;
            }
          }
          return { ...kitchen, location, distance_m: null };
        });
      }
    } catch (authErr) {
      // If auth check fails (no token or invalid token), continue with normal flow (public access)
      // This is expected for non-authenticated users
    }

    try {
      // Check if PostGIS is available and install if needed
      const availableCheck = await server.prisma.$queryRawUnsafe(`
        SELECT EXISTS(
          SELECT 1 FROM pg_available_extensions WHERE name = 'postgis'
        ) AS postgis_available;
      `);
      const postgisAvailable = availableCheck[0]?.postgis_available || false;
      
      let postgisInstalled = false;
      if (postgisAvailable) {
        // Check if PostGIS is installed
        const installedCheck = await server.prisma.$queryRawUnsafe(`
          SELECT EXISTS(
            SELECT 1 FROM pg_extension WHERE extname = 'postgis'
          ) AS postgis_installed;
        `);
        postgisInstalled = installedCheck[0]?.postgis_installed || false;
        
        // Install PostGIS if available but not installed
        if (!postgisInstalled) {
          try {
            await server.prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS postgis');
            postgisInstalled = true;
            server.log.info('PostGIS extension installed successfully');
          } catch (installError) {
            server.log.warn('Failed to install PostGIS:', installError.message);
            postgisInstalled = false;
          }
        }
      }

      let res;
      if (postgisInstalled) {
        // Use PostGIS query
        const sql = `
          SELECT id, title, description, "ownerId", ST_AsGeoJSON(location)::json AS location,
                 ST_Distance(location::geography, ST_SetSRID(ST_MakePoint($1, $2),4326)::geography) AS distance_m
          FROM "Kitchen"
          WHERE location IS NOT NULL
            AND ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint($1, $2),4326)::geography, $3)
          ORDER BY distance_m
          LIMIT 50;
        `;
        const params = [parseFloat(lng), parseFloat(lat), parseInt(radius)];
        res = await server.prisma.$queryRawUnsafe(sql.replace(/\n/g,' '), ...params);
      } else {
        // Fallback: Use Haversine formula for TEXT location (stored as JSON)
        // Location format: {"lng": 54.4, "lat": 24.4} or similar
        const sql = `
          SELECT 
            id, 
            title, 
            description,
            "ownerId",
            location::json AS location,
            (
              6371000 * acos(
                cos(radians($2)) * 
                cos(radians((location::json->>'lat')::float)) * 
                cos(radians((location::json->>'lng')::float) - radians($1)) + 
                sin(radians($2)) * 
                sin(radians((location::json->>'lat')::float))
              )
            ) AS distance_m
          FROM "Kitchen"
          WHERE location IS NOT NULL
            AND location::text != 'null'
            AND (
              6371000 * acos(
                cos(radians($2)) * 
                cos(radians((location::json->>'lat')::float)) * 
                cos(radians((location::json->>'lng')::float) - radians($1)) + 
                sin(radians($2)) * 
                sin(radians((location::json->>'lat')::float))
              )
            ) <= $3
          ORDER BY distance_m
          LIMIT 50;
        `;
        const params = [parseFloat(lng), parseFloat(lat), parseInt(radius)];
        res = await server.prisma.$queryRawUnsafe(sql.replace(/\n/g,' '), ...params);
      }
      
      return res;
    } catch (err) {
      server.log.error('Error fetching nearby kitchens:', err);
      // Fallback: return all kitchens without distance calculation
      if (!server.prisma || !server.prisma.kitchen) {
        server.log.error('Prisma client or Kitchen model not available');
        return reply.code(500).send({ error: 'Database connection error' });
      }
      const kitchens = await server.prisma.kitchen.findMany({
        select: {
          id: true,
          title: true,
          description: true,
          ownerId: true,
          location: true
        },
        take: 50
      });
      
      // Transform location if it's a string
      return kitchens.map(kitchen => ({
        ...kitchen,
        location: typeof kitchen.location === 'string' 
          ? (() => {
              try {
                return JSON.parse(kitchen.location);
              } catch {
                return null;
              }
            })()
          : kitchen.location,
        distance_m: null
      }));
    }
  });

  server.get('/my', {
    schema: {
      tags: ['kitchens'],
      description: 'Get kitchens owned by the authenticated owner',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              ownerId: { type: 'string' },
              location: { type: 'object' },
              images: { type: 'array', items: { type: 'string' } },
              coverImage: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' }
            }
          }
        },
        401: {
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
      const userId = request.user.id;
      const kitchens = await server.prisma.kitchen.findMany({
        where: {
          ownerId: userId
        },
        include: {
          mealPlans: true
        },
        orderBy: { createdAt: 'desc' }
      });

      return kitchens.map(kitchen => {
        let location = kitchen.location;
        if (typeof location === 'string' && location) {
          try {
            location = JSON.parse(location);
          } catch {
            location = null;
          }
        }
        return { ...kitchen, location };
      });
    } catch (err) {
      server.log.error('Error fetching owner kitchens:', err);
      return reply.code(400).send({ error: err.message || 'Failed to fetch kitchens' });
    }
  });

  server.get('/:id', {
    schema: {
      tags: ['kitchens'],
      description: 'Get kitchen details by ID',
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
            title: { type: 'string' },
            description: { type: 'string' },
            ownerId: { type: 'string' },
            location: { type: 'object' },
            images: { type: 'array', items: { type: 'string' } },
            coverImage: { type: 'string' },
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
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const kitchen = await server.prisma.kitchen.findUnique({
      where: { id },
      include: {
        mealPlans: true,
        owner: {
          select: { id: true, name: true, email: true }
        }
      }
    });
    if (!kitchen) return reply.code(404).send({ error: 'Kitchen not found' });
    
    // Parse location if it's a string (JSON format when PostGIS is not available)
    if (typeof kitchen.location === 'string' && kitchen.location) {
      try {
        kitchen.location = JSON.parse(kitchen.location);
      } catch {
        // If parsing fails, keep as is or set to null
        kitchen.location = null;
      }
    }
    
    return kitchen;
  });

  server.post('/', {
    schema: {
      tags: ['kitchens'],
      description: 'Create a new tiffin kitchen (owner only)',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['title', 'lng', 'lat'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          lng: { type: 'number', minimum: -180, maximum: 180 },
          lat: { type: 'number', minimum: -90, maximum: 90 }
        }
      },
      response: {
        201: {
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
        400: {
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
      const data = createKitchenSchema.parse(request.body);
      const ownerId = request.user.role === 'admin' ? (request.body.ownerId || request.user.id) : request.user.id;

      // Check if PostGIS is available and install if needed
      const availableCheck = await server.prisma.$queryRawUnsafe(`
        SELECT EXISTS(
          SELECT 1 FROM pg_available_extensions WHERE name = 'postgis'
        ) AS postgis_available;
      `);
      const postgisAvailable = availableCheck[0]?.postgis_available || false;
      
      let postgisInstalled = false;
      if (postgisAvailable) {
        // Check if PostGIS is installed
        const installedCheck = await server.prisma.$queryRawUnsafe(`
          SELECT EXISTS(
            SELECT 1 FROM pg_extension WHERE extname = 'postgis'
          ) AS postgis_installed;
        `);
        postgisInstalled = installedCheck[0]?.postgis_installed || false;
        
        // Install PostGIS if available but not installed
        if (!postgisInstalled) {
          try {
            await server.prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS postgis');
            postgisInstalled = true;
            server.log.info('PostGIS extension installed successfully');
          } catch (installError) {
            server.log.warn('Failed to install PostGIS:', installError.message);
            postgisInstalled = false;
          }
        }
      }

      let created;
      if (postgisInstalled) {
        // Use PostGIS geometry
        const insertSql = `
          INSERT INTO "Kitchen" (id, "ownerId", title, description, location, "createdAt")
          VALUES (gen_random_uuid()::text, $1, $2, $3, ST_SetSRID(ST_MakePoint($4,$5),4326), now())
          RETURNING id, title, description, "ownerId", "createdAt";
        `;
        [created] = await server.prisma.$queryRawUnsafe(
          insertSql, ownerId, data.title, data.description || '', parseFloat(data.lng), parseFloat(data.lat)
        );
      } else {
        // Store as JSON text
        const locationJson = JSON.stringify({ lng: parseFloat(data.lng), lat: parseFloat(data.lat) });
        const insertSql = `
          INSERT INTO "Kitchen" (id, "ownerId", title, description, location, "createdAt")
          VALUES (gen_random_uuid()::text, $1, $2, $3, $4, now())
          RETURNING id, title, description, "ownerId", "createdAt";
        `;
        [created] = await server.prisma.$queryRawUnsafe(
          insertSql, ownerId, data.title, data.description || '', locationJson
        );
      }
      
      return reply.code(201).send(created);
    } catch (err) {
      if (err.errors) {
        return reply.code(400).send({ error: 'Validation error', details: err.errors });
      }
      return reply.code(400).send({ error: err.message || 'Failed to create kitchen' });
    }
  });

  server.put('/:id', {
    schema: {
      tags: ['kitchens'],
      description: 'Update kitchen details (owner only)',
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
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          coverImage: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            images: { type: 'array', items: { type: 'string' } },
            coverImage: { type: 'string' }
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
      const { id } = request.params;
      const kitchen = await server.prisma.kitchen.findUnique({ where: { id } });
      
      if (!kitchen) {
        return reply.code(404).send({ error: 'Kitchen not found' });
      }
      
      if (request.user.role !== 'admin' && kitchen.ownerId !== request.user.id) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      
      const updateData = {};
      if (request.body.title) updateData.title = request.body.title;
      if (request.body.description !== undefined) updateData.description = request.body.description;
      if (request.body.coverImage !== undefined) updateData.coverImage = request.body.coverImage;
      
      const updated = await server.prisma.kitchen.update({
        where: { id },
        data: updateData
      });
      
      return updated;
    } catch (err) {
      server.log.error('Error updating kitchen:', err);
      return reply.code(400).send({ error: err.message || 'Failed to update kitchen' });
    }
  });

  server.delete('/:id', {
    schema: {
      tags: ['kitchens'],
      description: 'Delete kitchen (owner only)',
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
      const { id } = request.params;
      const kitchen = await server.prisma.kitchen.findUnique({ where: { id } });
      
      if (!kitchen) {
        return reply.code(404).send({ error: 'Kitchen not found' });
      }
      
      if (request.user.role !== 'admin' && kitchen.ownerId !== request.user.id) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      
      await server.prisma.kitchen.delete({ where: { id } });
      
      return { message: 'Kitchen deleted successfully' };
    } catch (err) {
      server.log.error('Error deleting kitchen:', err);
      return reply.code(400).send({ error: err.message || 'Failed to delete kitchen' });
    }
  });

  server.post('/:id/images', {
    schema: {
      tags: ['kitchens'],
      description: 'Upload kitchen images (owner only)',
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
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
            images: { type: 'array', items: { type: 'string' } },
            message: { type: 'string' }
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
      const { id } = request.params;
      const kitchen = await server.prisma.kitchen.findUnique({ where: { id } });
      
      if (!kitchen) {
        return reply.code(404).send({ error: 'Kitchen not found' });
      }
      
      if (request.user.role !== 'admin' && kitchen.ownerId !== request.user.id) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      
      if (kitchen.images.length >= 10) {
        return reply.code(400).send({ error: 'Maximum 10 images allowed per kitchen' });
      }
      
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }
      
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.code(400).send({ error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed' });
      }
      
      const buffer = await data.toBuffer();
      const filename = `${id}_${Date.now()}.${data.mimetype.split('/')[1]}`;
      const filepath = `uploads/kitchens/${filename}`;
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const uploadDir = path.join(process.cwd(), 'uploads', 'kitchens');
      await fs.mkdir(uploadDir, { recursive: true });
      await fs.writeFile(path.join(uploadDir, filename), buffer);
      
      const imageUrl = `/uploads/kitchens/${filename}`;
      const updatedImages = [...kitchen.images, imageUrl];
      
      const updated = await server.prisma.kitchen.update({
        where: { id },
        data: { images: updatedImages }
      });
      
      return { images: updated.images, message: 'Image uploaded successfully' };
    } catch (err) {
      server.log.error('Error uploading image:', err);
      return reply.code(400).send({ error: err.message || 'Failed to upload image' });
    }
  });

  server.delete('/:id/images/:imageIndex', {
    schema: {
      tags: ['kitchens'],
      description: 'Delete kitchen image (owner only)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id', 'imageIndex'],
        properties: {
          id: { type: 'string' },
          imageIndex: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            images: { type: 'array', items: { type: 'string' } },
            message: { type: 'string' }
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
      const { id, imageIndex } = request.params;
      const kitchen = await server.prisma.kitchen.findUnique({ where: { id } });
      
      if (!kitchen) {
        return reply.code(404).send({ error: 'Kitchen not found' });
      }
      
      if (request.user.role !== 'admin' && kitchen.ownerId !== request.user.id) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      
      const index = parseInt(imageIndex);
      if (isNaN(index) || index < 0 || index >= kitchen.images.length) {
        return reply.code(400).send({ error: 'Invalid image index' });
      }
      
      const imageUrl = kitchen.images[index];
      const fs = await import('fs/promises');
      const path = await import('path');
      
      try {
        const filepath = path.join(process.cwd(), imageUrl);
        await fs.unlink(filepath);
      } catch (fileErr) {
        server.log.warn('Failed to delete file:', fileErr.message);
      }
      
      const updatedImages = kitchen.images.filter((_, i) => i !== index);
      let updateData = { images: updatedImages };
      
      if (kitchen.coverImage === imageUrl) {
        updateData.coverImage = updatedImages[0] || null;
      }
      
      const updated = await server.prisma.kitchen.update({
        where: { id },
        data: updateData
      });
      
      return { images: updated.images, message: 'Image deleted successfully' };
    } catch (err) {
      server.log.error('Error deleting image:', err);
      return reply.code(400).send({ error: err.message || 'Failed to delete image' });
    }
  });

  server.put('/:id/cover-image', {
    schema: {
      tags: ['kitchens'],
      description: 'Set cover image (owner only)',
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
        required: ['imageUrl'],
        properties: {
          imageUrl: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            coverImage: { type: 'string' },
            message: { type: 'string' }
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
    preHandler: [server.requireRole(['owner', 'admin'])]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { imageUrl } = request.body;
      const kitchen = await server.prisma.kitchen.findUnique({ where: { id } });
      
      if (!kitchen) {
        return reply.code(404).send({ error: 'Kitchen not found' });
      }
      
      if (request.user.role !== 'admin' && kitchen.ownerId !== request.user.id) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      
      if (!kitchen.images.includes(imageUrl)) {
        return reply.code(400).send({ error: 'Image not found in kitchen images' });
      }
      
      const updated = await server.prisma.kitchen.update({
        where: { id },
        data: { coverImage: imageUrl }
      });
      
      return { coverImage: updated.coverImage, message: 'Cover image updated successfully' };
    } catch (err) {
      server.log.error('Error setting cover image:', err);
      return reply.code(400).send({ error: err.message || 'Failed to set cover image' });
    }
  });

  server.get('/:id/orders', {
    schema: {
      tags: ['kitchens'],
      description: 'Get orders for a specific kitchen (owner only)',
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
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              userId: { type: 'string' },
              kitchenId: { type: 'string' },
              planId: { type: 'string' },
              status: { type: 'string' },
              amount: { type: 'number' },
              createdAt: { type: 'string', format: 'date-time' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  email: { type: 'string' }
                }
              },
              mealPlan: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' }
                }
              }
            }
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
      const { id } = request.params;
      const kitchen = await server.prisma.kitchen.findUnique({ where: { id } });
      
      if (!kitchen) {
        return reply.code(404).send({ error: 'Kitchen not found' });
      }
      
      if (request.user.role !== 'admin' && kitchen.ownerId !== request.user.id) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const orders = await server.prisma.order.findMany({
        where: { kitchenId: id },
        include: {
          user: { select: { id: true, name: true, email: true } },
          mealPlan: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      return orders;
    } catch (err) {
      server.log.error('Error fetching kitchen orders:', err);
      return reply.code(400).send({ error: err.message || 'Failed to fetch orders' });
    }
  });
}
