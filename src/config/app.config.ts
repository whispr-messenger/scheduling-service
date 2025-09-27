import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT, 10) || 3001,
  environment: process.env.NODE_ENV || 'development',
  serviceName: 'whispr-scheduling-service',
  version: process.env.npm_package_version || '1.0.0',

  cors: {
    enabled: process.env.CORS_ENABLED !== 'false',
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },

  swagger: {
    enabled: process.env.SWAGGER_ENABLED !== 'false',
    title: 'Whispr Scheduling Service API',
    description: 'Central task orchestration service for Whispr messenger',
    version: process.env.npm_package_version || '1.0.0',
    path: '/api/docs',
  },

  grpc: {
    port: parseInt(process.env.GRPC_PORT, 10) || 50051,
    host: process.env.GRPC_HOST || '0.0.0.0',
  },

  services: {
    messaging: {
      host: process.env.MESSAGING_SERVICE_HOST || 'messaging-service',
      port: parseInt(process.env.MESSAGING_SERVICE_PORT, 10) || 50052,
    },
    notification: {
      host: process.env.NOTIFICATION_SERVICE_HOST || 'notification-service',
      port: parseInt(process.env.NOTIFICATION_SERVICE_PORT, 10) || 50053,
    },
    media: {
      host: process.env.MEDIA_SERVICE_HOST || 'media-service',
      port: parseInt(process.env.MEDIA_SERVICE_PORT, 10) || 50054,
    },
    user: {
      host: process.env.USER_SERVICE_HOST || 'user-service',
      port: parseInt(process.env.USER_SERVICE_PORT, 10) || 50055,
    },
    auth: {
      host: process.env.AUTH_SERVICE_HOST || 'auth-service',
      port: parseInt(process.env.AUTH_SERVICE_PORT, 10) || 50056,
    },
  },
}));