import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { CancelExpiredOrdersJob } from './jobs/cancel-expired-orders.job';
import { CronSchedulerService } from './jobs/cron-scheduler.service';
import { EmailQueueProcessor } from './jobs/email-queue.processor';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    MailModule,
    // Fila de e-mails transacionais (order-confirmed)
    BullModule.registerQueue({ name: 'emailQueue' }),
    // Fila cron D-10: cancelar pedidos expirados a cada 5 minutos
    BullModule.registerQueue({
      name: 'cancelExpiredOrders',
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  providers: [PaymentsService, CancelExpiredOrdersJob, CronSchedulerService, EmailQueueProcessor],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
