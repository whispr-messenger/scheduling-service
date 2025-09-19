import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding development database...');

  // Créer des catégories de base
  const messagingCategory = await prisma.jobCategory.create({
    data: {
      name: 'messaging',
      description: 'Tâches liées à la messagerie',
      defaultMaxRetries: 3,
      configuration: JSON.stringify({
        queue: 'messaging-queue',
        service: 'messaging-service',
        allowedMethods: ['sendMessage', 'processScheduledMessage'],
        rateLimiting: {
          maxPerHour: 1000,
          maxConcurrent: 10,
        },
      }),
    },
  });

  const notificationCategory = await prisma.jobCategory.create({
    data: {
      name: 'notifications',
      description: 'Tâches de notification',
      defaultMaxRetries: 5,
      configuration: JSON.stringify({
        queue: 'notification-queue',
        service: 'notification-service',
        allowedMethods: ['sendPushNotification', 'sendEmail'],
        rateLimiting: {
          maxPerHour: 5000,
          maxConcurrent: 20,
        },
      }),
    },
  });

  // Créer quelques jobs de test
  const testJob = await prisma.job.create({
    data: {
      name: 'Test Message Delivery',
      description: 'Job de test pour la livraison de messages',
      categoryId: messagingCategory.id,
      targetService: 'messaging-service',
      targetMethod: 'processScheduledMessage',
      payload: JSON.stringify({
        messageId: 'test-message-123',
        conversationId: 'test-conversation-456',
      }),
      priority: 'MEDIUM',
      createdBy: 'system',
    },
  });

  // Créer une planification de test
  await prisma.schedule.create({
    data: {
      jobId: testJob.id,
      scheduleType: 'INTERVAL',
      intervalSeconds: 300, // 5 minutes
      timezone: 'UTC',
    },
  });

  console.log('✅ Development database seeded successfully!');
  console.log(`📊 Created:`);
  console.log(`   - ${2} job categories`);
  console.log(`   - ${1} test job`);
  console.log(`   - ${1} schedule`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });