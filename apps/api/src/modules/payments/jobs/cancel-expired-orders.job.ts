import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PaymentsService } from '../payments.service';

/** D-10: cancela pedidos PIX/Boleto expirados sem webhook, a cada 5 minutos */
@Processor('cancelExpiredOrders')
export class CancelExpiredOrdersJob {
  private readonly logger = new Logger(CancelExpiredOrdersJob.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Process()
  async handle(job: Job) {
    this.logger.debug('Cron D-10: verificando pedidos expirados...');
    await this.paymentsService.cancelExpiredOrders();
  }
}
