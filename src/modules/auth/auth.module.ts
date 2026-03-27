import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { JwksModule } from '../jwks/jwks.module';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
	imports: [JwksModule, JwtModule.register({})],
	providers: [
		JwtAuthGuard,
		{
			provide: APP_GUARD,
			useExisting: JwtAuthGuard,
		},
	],
	exports: [JwtAuthGuard],
})
export class AuthModule {}
