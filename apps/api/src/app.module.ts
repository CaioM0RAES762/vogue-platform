import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { appConfig } from './config/app.config';
import { validateEnv } from './config/env.validation';
import { winstonConfig } from './common/logger/winston.logger';
import { PrismaModule } from './modules/prisma/prisma.module';
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
    PrismaModule,
  ],
})
export class AppModule {}
