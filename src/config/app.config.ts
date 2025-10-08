import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3001', 10),
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
    port: parseInt(process.env.GRPC_PORT || '50051', 10),
    host: process.env.GRPC_HOST || '0.0.0.0',
  },

  services: {
    messaging: {
      host: process.env.MESSAGING_SERVICE_HOST || 'messaging-service',
      port: parseInt(process.env.MESSAGING_SERVICE_PORT || '50052', 10),
    },
    notification: {
      host: process.env.NOTIFICATION_SERVICE_HOST || 'notification-service',
      port: parseInt(process.env.NOTIFICATION_SERVICE_PORT || '50053', 10),
    },
    media: {
      host: process.env.MEDIA_SERVICE_HOST || 'media-service',
      port: parseInt(process.env.MEDIA_SERVICE_PORT || '50054', 10),
    },
    user: {
      host: process.env.USER_SERVICE_HOST || 'user-service',
      port: parseInt(process.env.USER_SERVICE_PORT || '50055', 10),
    },
    auth: {
      host: process.env.AUTH_SERVICE_HOST || 'auth-service',
      port: parseInt(process.env.AUTH_SERVICE_PORT || '50056', 10),
    },
  },
}));
