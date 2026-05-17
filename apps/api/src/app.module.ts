import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { WinstonModule } from 'nest-winston';

import { appConfig } from './config/app.config';
import { validateEnv } from './config/env.validation';
import { winstonConfig } from './common/logger/winston.logger';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { AppController } from './app.controller';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validate: validateEnv,
      envFilePath: ['.env'],
    }),
    WinstonModule.forRoot(winstonConfig),
    // Rate limiting — store em memória para dev; configurar Redis store em produção
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 100 },
    ]),
    PrismaModule,
    AuthModule,
  ],
})
export class AppModule {}
