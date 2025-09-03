import { PrismaClient, Priority } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Créer les catégories de tâches par défaut
  const categories = [
    {
      name: 'messaging',
      description: 'Tâches liées aux messages programmés et au nettoyage',
      defaultPriority: Priority.HIGH,
      defaultTimeout: 30,
      defaultMaxRetries: 3,
      configuration: {
        queue: 'high-priority',
        service: 'messaging-service',
        allowedMethods: ['SendScheduledMessage', 'CleanupExpiredMessages', 'BulkMessageDelivery'],
        rateLimiting: {
          maxPerHour: 1000,
          maxConcurrent: 10,
        },
      },
    },
    {
      name: 'notifications',
      description: 'Tâches de notifications différées et rappels',
      defaultPriority: Priority.HIGH,
      defaultTimeout: 15,
      defaultMaxRetries: 5,
      configuration: {
        queue: 'high-priority',
        service: 'notification-service',
        allowedMethods: ['SendDelayedNotification', 'CleanupNotificationHistory', 'SendBulkNotifications', 'ProcessScheduledReminders'],
        rateLimiting: {
          maxPerHour: 2000,
          maxConcurrent: 15,
        },
      },
    },
    {
      name: 'maintenance',
      description: 'Tâches de maintenance système et base de données',
      defaultPriority: Priority.MEDIUM,
      defaultTimeout: 600,
      defaultMaxRetries: 2,
      configuration: {
        queue: 'medium-priority',
        allowedWindows: ['02:00-06:00'],
        allowedMethods: ['VacuumDatabase', 'ReindexTables', 'UpdateStatistics', 'RotateLogs'],
        rateLimiting: {
          maxPerHour: 20,
          maxConcurrent: 2,
        },
      },
    },
    {
      name: 'cleanup',
      description: 'Tâches de nettoyage automatique des données expirées',
      defaultPriority: Priority.LOW,
      defaultTimeout: 300,
      defaultMaxRetries: 2,
      configuration: {
        queue: 'low-priority',
        batchSize: 100,
        allowedMethods: ['CleanupTempFiles', 'CleanupExpiredSessions', 'CleanupOldLogs', 'ArchiveOldData'],
        rateLimiting: {
          maxPerHour: 50,
          maxConcurrent: 3,
        },
      },
    },
    {
      name: 'reports',
      description: 'Génération de rapports automatisés',
      defaultPriority: Priority.MEDIUM,
      defaultTimeout: 120,
      defaultMaxRetries: 1,
      configuration: {
        queue: 'medium-priority',
        service: 'user-service',
        allowedMethods: ['GenerateActivityReport', 'GenerateUsageReport', 'GenerateSecurityReport'],
        outputFormats: ['json', 'csv', 'pdf'],
        rateLimiting: {
          maxPerHour: 100,
          maxConcurrent: 5,
        },
      },
    },
    {
      name: 'analytics',
      description: 'Tâches d\'analytics et traitement de données',
      defaultPriority: Priority.LOW,
      defaultTimeout: 300,
      defaultMaxRetries: 1,
      configuration: {
        queue: 'low-priority',
        batchProcessing: true,
        allowedMethods: ['ProcessAnalytics', 'UpdateMetrics', 'GenerateInsights'],
        rateLimiting: {
          maxPerHour: 30,
          maxConcurrent: 2,
        },
      },
    },
  ];

  console.log('Creating job categories...');
  for (const category of categories) {
    const existingCategory = await prisma.jobCategory.findUnique({
      where: { name: category.name },
    });

    if (!existingCategory) {
      const createdCategory = await prisma.jobCategory.create({
        data: category,
      });
      console.log(`✅ Created category: ${createdCategory.name}`);
    } else {
      console.log(`⏭️ Category already exists: ${category.name}`);
    }
  }

  // Créer quelques tâches d'exemple pour les tests
  console.log('Creating example jobs...');

  const messagingCategory = await prisma.jobCategory.findUnique({
    where: { name: 'messaging' },
  });

  const notificationCategory = await prisma.jobCategory.findUnique({
    where: { name: 'notifications' },
  });

  const maintenanceCategory = await prisma.jobCategory.findUnique({
    where: { name: 'maintenance' },
  });

  if (messagingCategory) {
    const exampleJob = await prisma.job.findFirst({
      where: { name: 'Daily Message Cleanup' },
    });

    if (!exampleJob) {
      await prisma.job.create({
        data: {
          name: 'Daily Message Cleanup',
          description: 'Nettoie automatiquement les messages expirés tous les jours',
          categoryId: messagingCategory.id,
          targetService: 'messaging-service',
          targetMethod: 'CleanupExpiredMessages',
          payload: {
            olderThanDays: 30,
            batchSize: 1000,
          },
          priority: Priority.MEDIUM,
          maxRetries: 2,
          timeoutSeconds: 300,
        },
      });
      console.log('✅ Created example messaging job');
    }
  }

  if (notificationCategory) {
    const exampleJob = await prisma.job.findFirst({
      where: { name: 'Weekly User Activity Reminder' },
    });

    if (!exampleJob) {
      await prisma.job.create({
        data: {
          name: 'Weekly User Activity Reminder',
          description: 'Envoie des rappels d\'activité aux utilisateurs inactifs',
          categoryId: notificationCategory.id,
          targetService: 'notification-service',
          targetMethod: 'ProcessScheduledReminders',
          payload: {
            reminderType: 'activity',
            inactiveDays: 7,
            channels: ['email', 'push'],
          },
          priority: Priority.MEDIUM,
          maxRetries: 3,
          timeoutSeconds: 120,
        },
      });
      console.log('✅ Created example notification job');
    }
  }

  if (maintenanceCategory) {
    const exampleJob = await prisma.job.findFirst({
      where: { name: 'Database Vacuum' },
    });

    if (!exampleJob) {
      await prisma.job.create({
        data: {
          name: 'Database Vacuum',
          description: 'Optimise les performances de la base de données',
          categoryId: maintenanceCategory.id,
          targetService: 'maintenance-service',
          targetMethod: 'VacuumDatabase',
          payload: {
            databases: ['scheduling_service', 'messaging_service', 'user_service'],
            analyze: true,
          },
          priority: Priority.LOW,
          maxRetries: 1,
          timeoutSeconds: 1800, // 30 minutes
        },
      });
      console.log('✅ Created example maintenance job');
    }
  }

  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });