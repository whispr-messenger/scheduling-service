import { Module } from '@nestjs/common';
import { JwksService } from './jwks.service';

@Module({
	providers: [JwksService],
	exports: [JwksService],
})
export class JwksModule {}
