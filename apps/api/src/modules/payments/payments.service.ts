import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { createHmac, timingSafeEqual } from 'crypto';
import { MercadoPagoConfig, Payment as MpPayment } from 'mercadopago';
import { PaymentMethod, PaymentStatus, OrderStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ProcessPaymentDto } from './dto/process-payment.dto';

export interface PaymentResult {
  externalId: string;
  status: string;
  qrCode?: string;
  qrCodeBase64?: string;
  barcode?: string;
  boletoUrl?: string;
  expiresAt?: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly mpPayment: MpPayment;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue('emailQueue') private readonly emailQueue: Queue,
  ) {
    const client = new MercadoPagoConfig({
      accessToken: this.config.get<string>('MERCADOPAGO_ACCESS_TOKEN', ''),
      options: { timeout: 10_000 },
    });
    this.mpPayment = new MpPayment(client);
  }

  // ─────────────────────────────────────────────────────────
  //  Cria pagamento no MP e atualiza o registro no banco
  // ─────────────────────────────────────────────────────────

  async createPayment(dto: ProcessPaymentDto): Promise<PaymentResult> {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: dto.orderId },
      include: { payments: { take: 1 } },
    });

    const amount = Number(order.total);
    const [firstName, ...rest] = dto.payerName.split(' ');
    const lastName = rest.join(' ') || firstName;

    let mpBody: Record<string, unknown>;

    switch (dto.method) {
      case PaymentMethod.PIX:
        mpBody = {
          transaction_amount: amount,
          payment_method_id: 'pix',
          payer: { email: dto.payerEmail },
          date_of_expiration: order.expiresAt?.toISOString(),
        };
        break;

      case PaymentMethod.BOLETO:
        mpBody = {
          transaction_amount: amount,
          payment_method_id: 'bolbradesco',
          payer: {
            email: dto.payerEmail,
            first_name: firstName,
            last_name: lastName,
            identification: { type: 'CPF', number: dto.payerCpf.replace(/\D/g, '') },
          },
          date_of_expiration: order.expiresAt?.toISOString(),
        };
        break;

      case PaymentMethod.CREDIT_CARD:
      case PaymentMethod.DEBIT_CARD:
        if (!dto.cardToken) {
          throw new BadRequestException('Token do cartão obrigatório (RN008)');
        }
        mpBody = {
          transaction_amount: amount,
          token: dto.cardToken,
          installments: dto.installments ?? 1,
          payment_method_id: dto.paymentMethodId,
          payer: {
            email: dto.payerEmail,
            identification: { type: 'CPF', number: dto.payerCpf.replace(/\D/g, '') },
          },
        };
        break;

      default:
        throw new BadRequestException('Método de pagamento inválido');
    }

    const mpResponse = await this.mpPayment.create({ body: mpBody as Parameters<typeof this.mpPayment.create>[0]['body'] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mpAny = mpResponse as any;
    const externalId = String(mpAny.id ?? '');
    const qrCode = mpAny?.point_of_interaction?.transaction_data?.qr_code as string | undefined;
    const qrCodeBase64 = mpAny?.point_of_interaction?.transaction_data?.qr_code_base64 as string | undefined;
    const barcode = mpAny?.barcode?.content as string | undefined;
    const boletoUrl = mpAny?.external_resource_url as string | undefined;

    // Atualiza o placeholder de payment no banco
    const existingPayment = order.payments[0];
    if (existingPayment) {
      await this.prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          externalId,
          qrCode: qrCode ?? null,
          qrCodeBase64: qrCodeBase64 ?? null,
          barcode: barcode ?? null,
          gatewayResponse: mpResponse as object,
        },
      });
    }

    return {
      externalId,
      status: mpResponse.status ?? 'pending',
      qrCode,
      qrCodeBase64,
      barcode,
      boletoUrl,
      expiresAt: order.expiresAt?.toISOString(),
    };
  }

  // ─────────────────────────────────────────────────────────
  //  POST /payments/webhook — Mercado Pago
  // ─────────────────────────────────────────────────────────

  async handleWebhook(
    body: Record<string, unknown>,
    xSignature: string | undefined,
    xRequestId: string | undefined,
  ): Promise<void> {
    this.validateHmac(body, xSignature, xRequestId);

    const action = body['action'] as string | undefined;
    const dataObj = body['data'] as Record<string, unknown> | undefined;
    const paymentId = String(dataObj?.['id'] ?? '');

    if (!paymentId) return;

    if (action === 'payment.updated' || action === 'payment.created') {
      const mpData = await this.mpPayment.get({ id: paymentId });
      const status = mpData.status;

      if (status === 'approved') {
        await this.approvePayment(paymentId);
      } else if (status === 'cancelled' || status === 'expired') {
        await this.cancelPayment(paymentId, 'PIX/Boleto cancelado ou expirado');
      } else if (status === 'rejected') {
        await this.rejectPayment(paymentId);
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  //  Transação atômica — pagamento aprovado (RN004)
  // ─────────────────────────────────────────────────────────

  async approvePayment(externalId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { externalId },
      include: { order: { include: { items: true } } },
    });

    if (!payment) {
      this.logger.warn(`Webhook: payment ${externalId} não encontrado`);
      return;
    }

    // Idempotência: já aprovado, ignorar (T-PAG-06)
    if (payment.status === PaymentStatus.APPROVED) {
      this.logger.log(`Webhook: payment ${externalId} já APPROVED — ignorado`);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          status: OrderStatus.PAID,
          statusHistory: {
            create: { toStatus: 'PAID', notes: 'Pagamento confirmado via webhook' },
          },
        },
      });

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.APPROVED,
          paidAt: new Date(),
        },
      });

      for (const item of payment.order.items) {
        const variant = await tx.productVariant.findUniqueOrThrow({
          where: { id: item.variantId },
          select: { stock: true },
        });

        const newStock = variant.stock - item.quantity;

        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: newStock },
        });

        await tx.inventoryMovement.create({
          data: {
            variantId: item.variantId,
            orderId: payment.orderId,
            type: 'SALE',
            quantity: -item.quantity,
            stockBefore: variant.stock,
            stockAfter: newStock,
            reason: `Venda confirmada — pedido ${payment.order.orderNumber}`,
          },
        });
      }
    });

    await this.emailQueue.add('order-confirmed', {
      orderId: payment.orderId,
      orderNumber: payment.order.orderNumber,
    });

    this.logger.log(`Pagamento ${externalId} aprovado — pedido ${payment.order.orderNumber}`);
  }

  // ─────────────────────────────────────────────────────────
  //  Cancelar pagamento e reverter estoque
  // ─────────────────────────────────────────────────────────

  async cancelPayment(externalId: string, reason: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { externalId },
      include: { order: { include: { items: true } } },
    });

    if (!payment) return;
    if (
      payment.status === PaymentStatus.CANCELLED ||
      payment.order.status === OrderStatus.CANCELLED
    ) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: reason,
          statusHistory: {
            create: { toStatus: 'CANCELLED', notes: reason },
          },
        },
      });

      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.CANCELLED },
      });

      for (const item of payment.order.items) {
        const variant = await tx.productVariant.findUniqueOrThrow({
          where: { id: item.variantId },
          select: { stock: true },
        });

        const newStock = variant.stock + item.quantity;

        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: newStock },
        });

        await tx.inventoryMovement.create({
          data: {
            variantId: item.variantId,
            orderId: payment.orderId,
            type: 'CANCELLATION',
            quantity: item.quantity,
            stockBefore: variant.stock,
            stockAfter: newStock,
            reason,
          },
        });
      }
    });

    this.logger.log(`Pagamento ${externalId} cancelado — pedido ${payment.order.orderNumber}`);
  }

  private async rejectPayment(externalId: string): Promise<void> {
    await this.prisma.payment.updateMany({
      where: { externalId },
      data: { status: PaymentStatus.REJECTED },
    });
  }

  // ─────────────────────────────────────────────────────────
  //  Cancela pedidos expirados sem webhook (D-10)
  // ─────────────────────────────────────────────────────────

  async cancelExpiredOrders(): Promise<void> {
    const expired = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      include: {
        payments: { take: 1 },
        items: true,
      },
    });

    for (const order of expired) {
      const payment = order.payments[0];
      if (!payment) continue;

      await this.cancelPayment(payment.externalId, 'Pedido expirado sem confirmação de pagamento');
    }

    if (expired.length > 0) {
      this.logger.log(`Cron D-10: ${expired.length} pedido(s) expirado(s) cancelado(s)`);
    }
  }

  // ─────────────────────────────────────────────────────────
  //  Busca info do pedido para polling (D-03)
  // ─────────────────────────────────────────────────────────

  async getOrderPaymentStatus(orderId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        payments: {
          select: {
            status: true,
            qrCode: true,
            qrCodeBase64: true,
            barcode: true,
            expiresAt: true,
            method: true,
          },
          take: 1,
        },
      },
    });

    return {
      orderId: order.id,
      orderStatus: order.status,
      expiresAt: order.expiresAt,
      payment: order.payments[0] ?? null,
    };
  }

  // ─────────────────────────────────────────────────────────
  //  Valida assinatura HMAC X-Signature do Mercado Pago
  //  Formato: ts=<timestamp>,v1=<hash>
  //  Manifest: id:<data.id>;request-id:<x-request-id>;ts:<ts>
  // ─────────────────────────────────────────────────────────

  private validateHmac(
    body: Record<string, unknown>,
    xSignature: string | undefined,
    xRequestId: string | undefined,
  ): void {
    const secret = this.config.get<string>('MERCADOPAGO_WEBHOOK_SECRET', '');

    // Em sandbox sem secret configurado, pular validação
    if (!secret || secret.startsWith('your_webhook')) {
      this.logger.warn('MERCADOPAGO_WEBHOOK_SECRET não configurado — pulando validação HMAC');
      return;
    }

    if (!xSignature) {
      throw new BadRequestException('Assinatura ausente');
    }

    const parts = Object.fromEntries(
      xSignature.split(',').map((p) => p.split('=')),
    );
    const ts = parts['ts'];
    const v1 = parts['v1'];

    if (!ts || !v1) {
      throw new BadRequestException('Formato de assinatura inválido');
    }

    const dataId = String((body['data'] as Record<string, unknown>)?.['id'] ?? '');
    const manifest = `id:${dataId};request-id:${xRequestId ?? ''};ts:${ts}`;
    const expected = createHmac('sha256', secret).update(manifest).digest('hex');

    const expectedBuf = Buffer.from(expected, 'hex');
    const receivedBuf = Buffer.from(v1, 'hex');

    if (
      expectedBuf.length !== receivedBuf.length ||
      !timingSafeEqual(expectedBuf, receivedBuf)
    ) {
      this.logger.warn('Assinatura HMAC inválida');
      throw new BadRequestException('Assinatura inválida');
    }
  }
}
