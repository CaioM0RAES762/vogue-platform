import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { PaymentsService } from '../payments/payments.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { OrderFilterDto } from './dto/order-filter.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';

const CANCELLABLE_STATUSES: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.PAID];

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly paymentsService: PaymentsService,
  ) {}

  // ─── Perfil ───────────────────────────────────────────────────────────────

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        cpf: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.phone && { phone: dto.phone }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        cpf: true,
        phone: true,
      },
    });
    return updated;
  }

  // ─── Exclusão LGPD (RN023) ────────────────────────────────────────────────

  async deleteMe(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const now = new Date();
    const anonymized = `deleted_${userId.slice(0, 8)}@removed.invalid`;

    // Anonimizar dados pessoais preservando pedidos (manter 5 anos — RN023)
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          name: 'Usuário Removido',
          email: anonymized,
          cpf: `00000000000_${userId.slice(0, 3)}`,
          phone: '00000000000',
          passwordHash: '',
          isActive: false,
          deletedAt: now,
        },
      }),
      // Revogar todos os refresh tokens
      this.prisma.refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true },
      }),
      // Remover endereços (dados pessoais não necessários)
      this.prisma.userAddress.deleteMany({ where: { userId } }),
    ]);

    this.logger.log(`LGPD: usuário ${userId} anonimizado em ${now.toISOString()}`);
  }

  // ─── Endereços ────────────────────────────────────────────────────────────

  async getAddresses(userId: string) {
    return this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    if (dto.isDefault) {
      await this.prisma.userAddress.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const count = await this.prisma.userAddress.count({ where: { userId } });
    const isFirst = count === 0;

    return this.prisma.userAddress.create({
      data: {
        userId,
        label: dto.label,
        recipientName: dto.recipientName,
        zipCode: dto.zipCode.replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2'),
        street: dto.street,
        number: dto.number,
        complement: dto.complement,
        neighborhood: dto.neighborhood,
        city: dto.city,
        state: dto.state.toUpperCase(),
        isDefault: dto.isDefault ?? isFirst,
      },
    });
  }

  async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto) {
    await this.ensureAddressOwnership(userId, addressId);

    if (dto.isDefault) {
      await this.prisma.userAddress.updateMany({
        where: { userId, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    return this.prisma.userAddress.update({
      where: { id: addressId },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.recipientName && { recipientName: dto.recipientName }),
        ...(dto.zipCode && {
          zipCode: dto.zipCode.replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2'),
        }),
        ...(dto.street && { street: dto.street }),
        ...(dto.number && { number: dto.number }),
        ...(dto.complement !== undefined && { complement: dto.complement }),
        ...(dto.neighborhood && { neighborhood: dto.neighborhood }),
        ...(dto.city && { city: dto.city }),
        ...(dto.state && { state: dto.state.toUpperCase() }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      },
    });
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    await this.ensureAddressOwnership(userId, addressId);
    await this.prisma.userAddress.delete({ where: { id: addressId } });

    // Se o endereço deletado era o padrão, define o mais recente como padrão
    const remaining = await this.prisma.userAddress.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    if (remaining) {
      await this.prisma.userAddress.update({
        where: { id: remaining.id },
        data: { isDefault: true },
      });
    }
  }

  async setDefaultAddress(userId: string, addressId: string) {
    await this.ensureAddressOwnership(userId, addressId);

    await this.prisma.$transaction([
      this.prisma.userAddress.updateMany({
        where: { userId },
        data: { isDefault: false },
      }),
      this.prisma.userAddress.update({
        where: { id: addressId },
        data: { isDefault: true },
      }),
    ]);

    return this.prisma.userAddress.findUnique({ where: { id: addressId } });
  }

  private async ensureAddressOwnership(userId: string, addressId: string) {
    const address = await this.prisma.userAddress.findUnique({ where: { id: addressId } });
    if (!address) throw new NotFoundException('Endereço não encontrado');
    if (address.userId !== userId) throw new ForbiddenException('Acesso negado');
  }

  // ─── Pedidos ──────────────────────────────────────────────────────────────

  async getOrders(userId: string, filter: OrderFilterDto) {
    const page = Math.max(1, Number(filter.page ?? 1));
    const limit = Math.min(50, Math.max(1, Number(filter.limit ?? 10)));
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(filter.status && { status: filter.status }),
      ...(filter.from || filter.to
        ? {
            createdAt: {
              ...(filter.from && { gte: new Date(filter.from) }),
              ...(filter.to && { lte: new Date(filter.to) }),
            },
          }
        : {}),
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          subtotal: true,
          discountAmount: true,
          shippingAmount: true,
          total: true,
          createdAt: true,
          payments: {
            select: { method: true, status: true },
            take: 1,
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getOrderById(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: { images: { where: { isPrimary: true }, take: 1 } },
                },
              },
            },
          },
        },
        payments: { select: { method: true, status: true, paidAt: true } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!order) throw new NotFoundException('Pedido não encontrado');
    if (order.userId !== userId) throw new ForbiddenException('Acesso negado');

    return order;
  }

  // ─── Cancelamento (D-07: apenas PENDING ou PAID) ──────────────────────────

  async cancelOrder(userId: string, orderId: string, dto: CancelOrderDto): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: { take: 1 } },
    });

    if (!order) throw new NotFoundException('Pedido não encontrado');
    if (order.userId !== userId) throw new ForbiddenException('Acesso negado');

    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        'Cancelamento permitido apenas para pedidos com status PENDING ou PAID (D-07)',
      );
    }

    // Reverter estoque via PaymentsService se houver pagamento externo aprovado
    const payment = order.payments[0];
    if (payment && order.status === OrderStatus.PAID) {
      await this.paymentsService.cancelPayment(payment.externalId, dto.reason);
    } else {
      // Pedido PENDING sem pagamento aprovado — apenas atualiza status
      await this.prisma.$transaction([
        this.prisma.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.CANCELLED,
            cancelledAt: new Date(),
            cancelReason: dto.reason,
          },
        }),
        this.prisma.orderStatusHistory.create({
          data: {
            orderId,
            fromStatus: order.status,
            toStatus: 'CANCELLED',
            changedBy: userId,
            notes: `Cancelado pelo cliente: ${dto.reason}`,
          },
        }),
      ]);
    }

    // E-mail de cancelamento
    const email = order.userId
      ? (await this.prisma.user.findUnique({ where: { id: order.userId }, select: { email: true } }))?.email
      : order.guestEmail;

    if (email) {
      await this.mailService.sendOrderCancelled(email, order.orderNumber);
    }
  }
}
