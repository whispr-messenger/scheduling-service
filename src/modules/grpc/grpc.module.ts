import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { GrpcSchedulerService } from './services/grpc-scheduler.service';
// import { MessagingGrpcClient } from './clients/messaging.client';
import { SchedulerModule } from '@/modules/scheduler/scheduler.module';
import { MonitoringModule } from '@/modules/monitoring/monitoring.module';

@Module({
	imports: [
		ConfigModule,
		ClientsModule.registerAsync([
			{
				name: 'MESSAGING_SERVICE',
				imports: [ConfigModule],
				useFactory: async (configService: ConfigService) => ({
					transport: Transport.GRPC,
					options: {
						package: 'whispr.messaging',
						protoPath: join(__dirname, 'proto/messaging.proto'),
						url: `${configService.get('MESSAGING_SERVICE_HOST', 'localhost')}:${configService.get('MESSAGING_SERVICE_PORT', '4001')}`,
						loader: {
							keepCase: true,
							longs: String,
							enums: String,
							defaults: true,
							oneofs: true,
						},
					},
				}),
				inject: [ConfigService],
			},
		]),
		forwardRef(() => SchedulerModule),
		forwardRef(() => MonitoringModule),
	],
	providers: [GrpcSchedulerService], // MessagingGrpcClient removed
	exports: [GrpcSchedulerService], // MessagingGrpcClient removed
})
export class GrpcModule {}
