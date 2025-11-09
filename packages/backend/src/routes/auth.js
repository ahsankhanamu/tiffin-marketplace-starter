import bcrypt from 'bcrypt';
import { registerSchema, loginSchema, forgotPasswordSchema, verifyOtpSchema, resetPasswordSchema } from '../schemas/validation.js';
import { sendForgotPassword } from '../lib/email.js';

export default async function (server, opts) {
  // Register route - explicitly public, no authentication
  server.post('/register', {
    schema: {
      tags: ['auth'],
      description: 'Register a new user',
      security: [], // Public endpoint - no authentication required
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string', minLength: 6 },
          name: { type: 'string' },
          role: { type: 'string', enum: ['user', 'owner', 'admin'], default: 'user' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                role: { type: 'string' }
              }
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
    try {
      const data = registerSchema.parse(request.body);
      const normalizedEmail = data.email.toLowerCase().trim();
      
      // Check if user already exists
      const existing = await server.prisma.user.findUnique({ 
        where: { email: normalizedEmail },
        include: { auth: true }
      });
      
      // Hash password
      const hash = await bcrypt.hash(data.password, 10);
      
      let user;
      
      if (existing) {
        // User exists - check if they have auth record
        if (existing.auth) {
          // User exists with auth - email already registered
          return reply.code(400).send({ error: 'Email already exists' });
        } else {
          // User exists but no auth record - create auth record
          // Useful in case user was invited by admin and didn't register yet
          await server.prisma.auth.create({
            data: {
              userId: existing.id,
              password: hash
            }
          });
          
          // Update user info if provided
          user = await server.prisma.user.update({
            where: { id: existing.id },
            data: {
              name: data.name || existing.name,
              role: data.role || existing.role || 'user'
            }
          });
        }
      } else {
        // User doesn't exist - create user with auth
        user = await server.prisma.user.create({ 
          data: { 
            email: normalizedEmail, 
            name: data.name, 
            role: data.role || 'user',
            auth: {
              create: {
                password: hash
              }
            }
          }
        });
      }
      
      // Generate JWT token
      const token = server.jwt.sign({ id: user.id, role: user.role });
      
      return { 
        user: { 
          id: user.id, 
          email: user.email, 
          name: user.name, 
          role: user.role 
        }, 
        token 
      };
    } catch (err) {
      server.log.error('Registration error:', err);
      if (err.errors) {
        return reply.code(400).send({ error: 'Validation error', details: err.errors });
      }
      if (err.code === 'P2002') {
        return reply.code(400).send({ error: 'Email already exists' });
      }
      return reply.code(400).send({ error: err.message || 'Registration failed' });
    }
  });

  server.post('/login', {
    schema: {
      tags: ['auth'],
      description: 'Login with email and password',
      security: [], // Public endpoint - no authentication required
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                role: { type: 'string' }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const data = loginSchema.parse(request.body);
      const user = await server.prisma.user.findUnique({ 
        where: { email: data.email },
        include: { auth: true }
      });
      if (!user || !user.auth) return reply.code(401).send({ error: 'Invalid credentials' });
      const ok = await bcrypt.compare(data.password, user.auth.password);
      if (!ok) return reply.code(401).send({ error: 'Invalid credentials' });
      const token = server.jwt.sign({ id: user.id, role: user.role });
      return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role }};
    } catch (err) {
      if (err.errors) {
        return reply.code(400).send({ error: 'Validation error', details: err.errors });
      }
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
  });

  server.post('/forgot-password', {
    schema: {
      tags: ['auth'],
      description: 'Request password reset - sends OTP via email',
      security: [], // Public endpoint - no authentication required
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const data = forgotPasswordSchema.parse(request.body);
      const normalizedEmail = data.email.trim().toLowerCase();

      const user = await server.prisma.user.findUnique({
        where: { email: normalizedEmail }
      });

      // Don't reveal if user exists or not (security best practice)
      if (!user) {
        return reply.code(200).send({
          success: true,
          message: 'If an account with this email exists, an OTP has been sent.'
        });
      }

      // Generate 6-digit OTP
      function generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
      }

      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

      // Store OTP in auth table
      if (user.auth) {
        await server.prisma.auth.update({
          where: { userId: user.id },
          data: {
            resetOtp: otp,
            resetOtpExpiry: otpExpiry
          }
        });
      } else {
        // Create auth record if it doesn't exist (shouldn't happen, but safety check)
        await server.prisma.auth.create({
          data: {
            userId: user.id,
            password: '', // Will be set on password reset
            resetOtp: otp,
            resetOtpExpiry: otpExpiry
          }
        });
      }

      // Send OTP via email
      const emailResult = await sendForgotPassword(
        normalizedEmail,
        user.name || normalizedEmail.split('@')[0],
        otp // Pass OTP instead of password
      );

      return reply.code(200).send({
        success: true,
        message: 'OTP sent to your email. Please check your inbox.'
      });
    } catch (err) {
      if (err.errors) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          details: err.errors
        });
      }
      server.log.error('Forgot password error:', err);
      return reply.code(500).send({
        success: false,
        message: 'An error occurred while processing your request'
      });
    }
  });

  server.post('/verify-otp', {
    schema: {
      tags: ['auth'],
      description: 'Verify OTP for password reset',
      security: [], // Public endpoint
      body: {
        type: 'object',
        required: ['email', 'otp'],
        properties: {
          email: { type: 'string' },
          otp: { type: 'string', pattern: '^\\d{6}$' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const data = verifyOtpSchema.parse(request.body);
      const normalizedEmail = data.email.trim().toLowerCase();

      const user = await server.prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: { auth: true }
      });

      if (!user || !user.auth || !user.auth.resetOtp || !user.auth.resetOtpExpiry) {
        return reply.code(400).send({
          success: false,
          message: 'Invalid or expired OTP'
        });
      }

      // Check if OTP is expired
      if (new Date() > user.auth.resetOtpExpiry) {
        await server.prisma.auth.update({
          where: { userId: user.id },
          data: { resetOtp: null, resetOtpExpiry: null }
        });
        return reply.code(400).send({
          success: false,
          message: 'OTP has expired. Please request a new one.'
        });
      }

      // Verify OTP
      if (user.auth.resetOtp !== data.otp) {
        return reply.code(400).send({
          success: false,
          message: 'Invalid OTP'
        });
      }

      return reply.code(200).send({
        success: true,
        message: 'OTP verified successfully'
      });
    } catch (err) {
      if (err.errors) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          details: err.errors
        });
      }
      server.log.error('Verify OTP error:', err);
      return reply.code(400).send({
        success: false,
        message: 'An error occurred while verifying OTP'
      });
    }
  });

  server.post('/reset-password', {
    schema: {
      tags: ['auth'],
      description: 'Reset password with verified OTP',
      security: [], // Public endpoint
      body: {
        type: 'object',
        required: ['email', 'otp', 'newPassword'],
        properties: {
          email: { type: 'string' },
          otp: { type: 'string', pattern: '^\\d{6}$' },
          newPassword: { type: 'string', minLength: 6 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const data = resetPasswordSchema.parse(request.body);
      const normalizedEmail = data.email.trim().toLowerCase();

      const user = await server.prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: { auth: true }
      });

      if (!user || !user.auth || !user.auth.resetOtp || !user.auth.resetOtpExpiry) {
        return reply.code(400).send({
          success: false,
          message: 'Invalid or expired OTP'
        });
      }

      // Check if OTP is expired
      if (new Date() > user.auth.resetOtpExpiry) {
        await server.prisma.auth.update({
          where: { userId: user.id },
          data: { resetOtp: null, resetOtpExpiry: null }
        });
        return reply.code(400).send({
          success: false,
          message: 'OTP has expired. Please request a new one.'
        });
      }

      // Verify OTP
      if (user.auth.resetOtp !== data.otp) {
        return reply.code(400).send({
          success: false,
          message: 'Invalid OTP'
        });
      }

      // Hash new password and update
      const hashedPassword = await bcrypt.hash(data.newPassword, 12);

      await server.prisma.auth.update({
        where: { userId: user.id },
        data: {
          password: hashedPassword,
          resetOtp: null,
          resetOtpExpiry: null
        }
      });

      return reply.code(200).send({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (err) {
      if (err.errors) {
        return reply.code(400).send({
          success: false,
          message: 'Validation error',
          details: err.errors
        });
      }
      server.log.error('Reset password error:', err);
      return reply.code(400).send({
        success: false,
        message: 'An error occurred while resetting password'
      });
    }
  });
}
