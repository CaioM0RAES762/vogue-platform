import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { PaymentsModule } from '../payments/payments.module';
import { MailModule } from '../mail/mail.module';
import { AuditLogService } from './audit-log.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminProductsService } from './admin-products.service';
import { AdminInventoryService } from './admin-inventory.service';
import { AdminOrdersService } from './admin-orders.service';
import { AdminCouponsService } from './admin-coupons.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CloudinaryModule,
    PaymentsModule,
    MailModule,
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [AdminController],
  providers: [
    AuditLogService,
    AdminDashboardService,
    AdminProductsService,
    AdminInventoryService,
    AdminOrdersService,
    AdminCouponsService,
  ],
})
export class AdminModule {}
