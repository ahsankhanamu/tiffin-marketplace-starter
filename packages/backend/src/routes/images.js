export default async function (server, opts) {
  // Get all images for the authenticated owner
  server.get('/', {
    schema: {
      tags: ['images'],
      description: 'Get all images for the authenticated owner',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 50 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            images: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  url: { type: 'string' },
                  filename: { type: 'string' },
                  mimeType: { type: 'string' },
                  size: { type: 'number' },
                  createdAt: { type: 'string', format: 'date-time' }
                }
              }
            },
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' }
          }
        }
      }
    },
    preHandler: [server.authenticate]
  }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const { page = 1, limit = 50 } = request.query;
      const skip = (page - 1) * limit;

      const [images, total] = await Promise.all([
        server.prisma.image.findMany({
          where: { ownerId: userId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        server.prisma.image.count({
          where: { ownerId: userId }
        })
      ]);

      return {
        images,
        total,
        page,
        limit
      };
    } catch (err) {
      server.log.error('Error fetching images:', err);
      return reply.code(400).send({ error: err.message || 'Failed to fetch images' });
    }
  });

  // Upload a new image
  server.post('/', {
    schema: {
      tags: ['images'],
      description: 'Upload a new image',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            url: { type: 'string' },
            filename: { type: 'string' },
            mimeType: { type: 'string' },
            size: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    preHandler: [server.authenticate]
  }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const data = await request.file();
      
      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.code(400).send({ error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed' });
      }

      const maxSize = 5 * 1024 * 1024; // 5MB
      const buffer = await data.toBuffer();
      if (buffer.length > maxSize) {
        return reply.code(400).send({ error: 'File size must be less than 5MB' });
      }

      const fs = await import('fs/promises');
      const path = await import('path');
      const crypto = await import('crypto');

      const fileExtension = data.mimetype.split('/')[1];
      const uniqueId = crypto.randomBytes(8).toString('hex');
      const filename = `${userId}_${uniqueId}_${Date.now()}.${fileExtension}`;
      const uploadDir = path.join(process.cwd(), 'uploads', 'images');
      
      await fs.mkdir(uploadDir, { recursive: true });
      await fs.writeFile(path.join(uploadDir, filename), buffer);

      const imageUrl = `/uploads/images/${filename}`;

      const image = await server.prisma.image.create({
        data: {
          ownerId: userId,
          url: imageUrl,
          filename: filename,
          mimeType: data.mimetype,
          size: buffer.length
        }
      });

      return image;
    } catch (err) {
      server.log.error('Error uploading image:', err);
      return reply.code(400).send({ error: err.message || 'Failed to upload image' });
    }
  });

  // Delete an image
  server.delete('/:id', {
    schema: {
      tags: ['images'],
      description: 'Delete an image',
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
    preHandler: [server.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const userId = request.user.id;

      const image = await server.prisma.image.findUnique({
        where: { id }
      });

      if (!image) {
        return reply.code(404).send({ error: 'Image not found' });
      }

      if (image.ownerId !== userId && request.user.role !== 'admin') {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      // Delete the file from filesystem
      const fs = await import('fs/promises');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'uploads', 'images', image.filename);
      
      try {
        await fs.unlink(filePath);
      } catch (fileErr) {
        server.log.warn('Failed to delete image file:', fileErr);
        // Continue with database deletion even if file deletion fails
      }

      await server.prisma.image.delete({
        where: { id }
      });

      return { message: 'Image deleted successfully' };
    } catch (err) {
      server.log.error('Error deleting image:', err);
      return reply.code(400).send({ error: err.message || 'Failed to delete image' });
    }
  });
}

