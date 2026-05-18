import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

/** Registra o job repetível D-10 no Bull na inicialização da aplicação. */
@Injectable()
export class CronSchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CronSchedulerService.name);

  constructor(
    @InjectQueue('cancelExpiredOrders') private readonly queue: Queue,
  ) {}

  async onApplicationBootstrap() {
    // Remove jobs antigos para evitar duplicatas em restart
    await this.queue.removeRepeatable({ cron: '*/5 * * * *', jobId: 'cancel-expired' });
    await this.queue.add(
      {},
      { repeat: { cron: '*/5 * * * *' }, jobId: 'cancel-expired' },
    );
    this.logger.log('Cron D-10 registrado: cancelar pedidos expirados a cada 5 minutos');
  }
}
