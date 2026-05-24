import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { WinstonModule } from 'nest-winston';
import { BullModule } from '@nestjs/bull';

import { appConfig } from './config/app.config';
import { validateEnv } from './config/env.validation';
import { winstonConfig } from './common/logger/winston.logger';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { RedisModule } from './modules/redis/redis.module';
import { CloudinaryModule } from './modules/cloudinary/cloudinary.module';
import { ProductsModule } from './modules/products/products.module';
import { CartModule } from './modules/cart/cart.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { UsersModule } from './modules/users/users.module';
import { AdminModule } from './modules/admin/admin.module';
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
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 100 },
    ]),
    // Bull com Redis para filas (emailQueue, cancelExpiredOrders)
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: config.get<string>('REDIS_URL', 'redis://localhost:6379'),
      }),
    }),
    PrismaModule,
    RedisModule,
    CloudinaryModule,
    AuthModule,
    ProductsModule,
    CartModule,
    CheckoutModule,
    PaymentsModule,
    UsersModule,
    AdminModule,
  ],
})
export class AppModule {}
