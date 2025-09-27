import { PrismaClient, Priority } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with default job categories...');

  const categories = [
    {
      name: 'messaging',
      description: 'Tâches liées aux messages',
      defaultPriority: Priority.HIGH,
      defaultTimeout: 30,
      defaultMaxRetries: 3,
      configuration: {
        queue: 'high-priority',
        service: 'messaging-service'
      }
    },
    {
      name: 'notifications',
      description: 'Tâches de notifications',
      defaultPriority: Priority.HIGH,
      defaultTimeout: 15,
      defaultMaxRetries: 5,
      configuration: {
        queue: 'high-priority',
        service: 'notification-service'
      }
    },
    {
      name: 'maintenance',
      description: 'Tâches de maintenance système',
      defaultPriority: Priority.MEDIUM,
      defaultTimeout: 600,
      defaultMaxRetries: 2,
      configuration: {
        queue: 'medium-priority',
        allowedWindows: ['02:00-06:00']
      }
    },
    {
      name: 'cleanup',
      description: 'Tâches de nettoyage',
      defaultPriority: Priority.LOW,
      defaultTimeout: 300,
      defaultMaxRetries: 2,
      configuration: {
        queue: 'low-priority',
        batchSize: 100
      }
    },
    {
      name: 'reports',
      description: 'Génération de rapports',
      defaultPriority: Priority.MEDIUM,
      defaultTimeout: 120,
      defaultMaxRetries: 1,
      configuration: {
        queue: 'medium-priority',
        service: 'user-service'
      }
    },
    {
      name: 'analytics',
      description: 'Tâches d\'analytics',
      defaultPriority: Priority.LOW,
      defaultTimeout: 300,
      defaultMaxRetries: 1,
      configuration: {
        queue: 'low-priority',
        batchProcessing: true
      }
    }
  ];

  for (const category of categories) {
    await prisma.jobCategory.upsert({
      where: { name: category.name },
      update: category,
      create: category,
    });
    console.log(`✅ Category "${category.name}" created/updated`);
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