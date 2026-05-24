import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { MailService } from '../mail/mail.service';
import { AdminOrderFilterDto, UpdateOrderStatusDto } from './dto/update-order-status.dto';

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly mailService: MailService,
  ) {}

  async findAll(filter: AdminOrderFilterDto) {
    const { status, paymentMethod, dateFrom, dateTo, q, page = 1, limit = 20 } = filter;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo + 'T23:59:59Z') } : {}),
      };
    }
    if (q) {
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { user: { cpf: { contains: q } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { guestEmail: { contains: q, mode: 'insensitive' } },
        { guestCpf: { contains: q } },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true, cpf: true } },
          payments: { select: { method: true, status: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    const paged = Number(limit);
    return {
      data: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        createdAt: o.createdAt,
        customerName: o.user?.name ?? o.guestName ?? 'Convidado',
        customerEmail: o.user?.email ?? o.guestEmail ?? '',
        total: Number(o.total),
        paymentMethod: o.payments[0]?.method ?? null,
        paymentStatus: o.payments[0]?.status ?? null,
        status: o.status,
      })),
      meta: { total, page: Number(page), limit: paged, pages: Math.ceil(total / paged) },
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true, cpf: true, phone: true } },
        items: {
          include: { variant: { include: { product: { select: { name: true } } } } },
        },
        payments: { orderBy: { createdAt: 'desc' } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        coupon: { select: { code: true } },
      },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');
    return order;
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto, adminId: string) {
    const order = await this.findOne(id);

    const allowed = VALID_TRANSITIONS[order.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Transição inválida: ${order.status} → ${dto.status}`,
      );
    }

    if (dto.status === OrderStatus.SHIPPED && !dto.trackingCode?.trim()) {
      throw new UnprocessableEntityException('Código de rastreamento obrigatório para status SHIPPED');
    }

    if (dto.status === OrderStatus.CANCELLED) {
      const payment = order.payments[0];
      if (payment?.externalId) {
        await this.paymentsService.cancelPayment(payment.externalId, dto.notes ?? 'Cancelado pelo admin');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.trackingCode ? { trackingCode: dto.trackingCode } : {}),
          ...(dto.status === OrderStatus.CANCELLED ? { cancelledAt: new Date(), cancelReason: dto.notes ?? 'Cancelado pelo admin' } : {}),
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: dto.status,
          changedBy: adminId,
          notes: dto.notes ?? null,
        },
      });

      return updated;
    });
  }
}
