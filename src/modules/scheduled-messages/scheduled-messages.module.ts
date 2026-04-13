import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduledMessagesController } from './controllers/scheduled-messages.controller';
import { ScheduledMessagesService } from './services/scheduled-messages.service';
import { ScheduledMessage } from './entities/scheduled-message.entity';
import { GrpcModule } from '@/modules/grpc/grpc.module';

@Module({
	imports: [ConfigModule, TypeOrmModule.forFeature([ScheduledMessage]), forwardRef(() => GrpcModule)],
	controllers: [ScheduledMessagesController],
	providers: [ScheduledMessagesService],
	exports: [ScheduledMessagesService],
})
export class ScheduledMessagesModule {}
