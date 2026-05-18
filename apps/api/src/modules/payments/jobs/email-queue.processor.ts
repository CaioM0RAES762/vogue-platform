import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';

@Processor('emailQueue')
export class EmailQueueProcessor {
  private readonly logger = new Logger(EmailQueueProcessor.name);

  constructor(
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
  ) {}

  @Process('order-confirmed')
  async handleOrderConfirmed(job: Job<{ orderId: string; orderNumber: string }>) {
    const { orderId, orderNumber } = job.data;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { select: { email: true } } },
    });

    if (!order) {
      this.logger.warn(`order-confirmed: pedido ${orderId} não encontrado`);
      return;
    }

    const email = order.user?.email ?? order.guestEmail;
    if (!email) {
      this.logger.warn(`order-confirmed: e-mail não encontrado para pedido ${orderNumber}`);
      return;
    }

    await this.mail.sendOrderConfirmed(email, orderNumber, Number(order.total));
    this.logger.log(`E-mail de confirmação enviado para ${email} — pedido ${orderNumber}`);
  }
}
