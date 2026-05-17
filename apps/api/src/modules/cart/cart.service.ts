import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, CouponType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AddItemDto } from './dto/add-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ApplyCouponDto } from './dto/apply-coupon.dto';

const CART_TTL = 60; // Redis cache: 60s
const CART_EXPIRY_DAYS = 7;
const INACTIVITY_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour (RN021)

type CartWithRelations = Prisma.CartGetPayload<{
  include: {
    items: {
      include: {
        variant: {
          include: {
            product: {
              include: { images: { where: { isPrimary: true } } };
            };
          };
        };
      };
    };
    coupon: true;
  };
}>;

function buildExpiresAt(): Date {
  return new Date(Date.now() + CART_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ──────────────────────────────────────────────────────
  // Internal helpers
  // ──────────────────────────────────────────────────────

  private cacheKey(userId?: string, sessionId?: string): string {
    return userId ? `cart:user:${userId}` : `cart:session:${sessionId}`;
  }

  private async invalidateCache(userId?: string, sessionId?: string) {
    await this.redis.del(this.cacheKey(userId, sessionId));
  }

  private buildCartWhere(
    userId?: string,
    sessionId?: string,
  ): Prisma.CartWhereInput {
    if (userId) return { userId };
    if (sessionId) return { sessionId };
    throw new BadRequestException('Identificação de carrinho ausente');
  }

  private async findActiveCart(userId?: string, sessionId?: string) {
    return this.prisma.cart.findFirst({
      where: {
        ...this.buildCartWhere(userId, sessionId),
        expiresAt: { gt: new Date() },
      },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: { images: { where: { isPrimary: true } } },
                },
              },
            },
          },
        },
        coupon: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async getOrCreateCart(
    userId?: string,
    sessionId?: string,
  ): Promise<CartWithRelations> {
    const existing = await this.findActiveCart(userId, sessionId);
    if (existing) return existing;

    return this.prisma.cart.create({
      data: {
        userId: userId ?? null,
        sessionId: sessionId ?? null,
        expiresAt: buildExpiresAt(),
      },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: { images: { where: { isPrimary: true } } },
                },
              },
            },
          },
        },
        coupon: true,
      },
    });
  }

  /** RN021: revalidate stock when cart was idle > 1h */
  private async revalidateIfStale(cart: CartWithRelations): Promise<void> {
    const idleMs = Date.now() - cart.updatedAt.getTime();
    if (idleMs < INACTIVITY_THRESHOLD_MS) return;

    for (const item of cart.items) {
      const v = item.variant;
      const available = v.stock - v.reservedStock;

      if (available <= 0) {
        await this.prisma.cartItem.delete({ where: { id: item.id } });
      } else if (item.quantity > available) {
        await this.prisma.cartItem.update({
          where: { id: item.id },
          data: { quantity: available },
        });
      }
    }

    // Touch updatedAt to reset the inactivity timer
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() },
    });
  }

  private buildResponse(cart: CartWithRelations) {
    const subtotal = cart.items.reduce(
      (sum, i) => sum + Number(i.unitPrice) * i.quantity,
      0,
    );

    let discount = 0;
    if (cart.coupon) {
      if (cart.coupon.type === CouponType.FIXED) {
        discount = Math.min(Number(cart.coupon.value), subtotal);
      } else {
        discount = (subtotal * Number(cart.coupon.value)) / 100;
        if (cart.coupon.maxDiscount) {
          discount = Math.min(discount, Number(cart.coupon.maxDiscount));
        }
      }
    }

    discount = Number(discount.toFixed(2));

    return {
      id: cart.id,
      items: cart.items.map((i) => ({
        id: i.id,
        variant: {
          id: i.variant.id,
          size: i.variant.size,
          colorName: i.variant.colorName,
          colorHex: i.variant.colorHex ?? null,
          stock: i.variant.stock,
          reservedStock: i.variant.reservedStock,
        },
        product: {
          name: i.variant.product.name,
          slug: i.variant.product.slug,
          primaryImage: i.variant.product.images[0]?.thumbnailUrl ?? null,
        },
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        subtotal: Number((Number(i.unitPrice) * i.quantity).toFixed(2)),
      })),
      coupon: cart.coupon
        ? {
            code: cart.coupon.code,
            type: cart.coupon.type,
            value: Number(cart.coupon.value),
          }
        : null,
      subtotal: Number(subtotal.toFixed(2)),
      discount,
      total: Number((subtotal - discount).toFixed(2)),
    };
  }

  private buildEmptyResponse() {
    return {
      id: null,
      items: [],
      coupon: null,
      subtotal: 0,
      discount: 0,
      total: 0,
    };
  }

  // ──────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────

  async getCart(userId?: string, sessionId?: string) {
    const raw = await this.redis.get(this.cacheKey(userId, sessionId));
    if (raw) {
      try {
        return JSON.parse(raw) as ReturnType<CartService['buildResponse']>;
      } catch {
        // stale / corrupt cache — fall through
      }
    }

    const cart = await this.findActiveCart(userId, sessionId);
    if (!cart) return this.buildEmptyResponse();

    // RN021: revalidate stock after 1h inactivity
    await this.revalidateIfStale(cart);

    // Re-fetch after potential mutations from revalidation
    const fresh = await this.findActiveCart(userId, sessionId);
    const response = fresh ? this.buildResponse(fresh) : this.buildEmptyResponse();

    await this.redis.set(this.cacheKey(userId, sessionId), JSON.stringify(response), CART_TTL);
    return response;
  }

  async addItem(userId?: string, sessionId?: string, dto?: AddItemDto) {
    if (!dto) throw new BadRequestException('Dados inválidos');

    const variant = await this.prisma.productVariant.findFirst({
      where: { id: dto.variantId, isActive: true },
      include: {
        product: {
          include: { images: { where: { isPrimary: true } } },
        },
      },
    });

    if (!variant) throw new NotFoundException('Variante não encontrada');
    if (variant.product.status !== 'ACTIVE') {
      throw new BadRequestException('Produto indisponível');
    }

    // RN001, RN002: validate stock
    const available = variant.stock - variant.reservedStock;
    if (available <= 0) {
      throw new UnprocessableEntityException('Produto sem estoque disponível');
    }

    const cart = await this.getOrCreateCart(userId, sessionId);

    const existingItem = cart.items.find((i) => i.variantId === dto.variantId);

    if (existingItem) {
      const newQty = existingItem.quantity + dto.quantity;
      if (newQty > available) {
        throw new UnprocessableEntityException(
          `Estoque insuficiente. Disponível: ${available}`,
        );
      }
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQty },
      });
    } else {
      if (dto.quantity > available) {
        throw new UnprocessableEntityException(
          `Estoque insuficiente. Disponível: ${available}`,
        );
      }
      const unitPrice = variant.priceOverride ?? variant.product.price;
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          variantId: dto.variantId,
          quantity: dto.quantity,
          unitPrice,
        },
      });
    }

    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { expiresAt: buildExpiresAt() },
    });

    await this.invalidateCache(userId, sessionId);
    return this.getCart(userId, sessionId);
  }

  async updateItem(
    itemId: string,
    dto: UpdateItemDto,
    userId?: string,
    sessionId?: string,
  ) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: {
        cart: true,
        variant: true,
      },
    });

    if (!item) throw new NotFoundException('Item não encontrado');

    // Ownership check
    const ownedByUser = userId && item.cart.userId === userId;
    const ownedBySession = sessionId && item.cart.sessionId === sessionId;
    if (!ownedByUser && !ownedBySession) {
      throw new NotFoundException('Item não encontrado');
    }

    // RN002: validate stock
    const available = item.variant.stock - item.variant.reservedStock;
    if (dto.quantity > available) {
      throw new UnprocessableEntityException(
        `Estoque insuficiente. Disponível: ${available}`,
      );
    }

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity },
    });

    await this.invalidateCache(userId, sessionId);
    return this.getCart(userId, sessionId);
  }

  async removeItem(itemId: string, userId?: string, sessionId?: string) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });

    if (!item) throw new NotFoundException('Item não encontrado');

    const ownedByUser = userId && item.cart.userId === userId;
    const ownedBySession = sessionId && item.cart.sessionId === sessionId;
    if (!ownedByUser && !ownedBySession) {
      throw new NotFoundException('Item não encontrado');
    }

    await this.prisma.cartItem.delete({ where: { id: itemId } });

    await this.invalidateCache(userId, sessionId);
    return this.getCart(userId, sessionId);
  }

  async clearCart(userId?: string, sessionId?: string) {
    const cart = await this.findActiveCart(userId, sessionId);
    if (!cart) return this.buildEmptyResponse();

    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { couponId: null },
    });

    await this.invalidateCache(userId, sessionId);
    return this.buildEmptyResponse();
  }

  async applyCoupon(dto: ApplyCouponDto, userId: string) {
    // Fetch user CPF for RN014 check
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { cpf: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const coupon = await this.prisma.coupon.findUnique({
      where: { code: dto.code },
    });

    if (!coupon || !coupon.isActive) {
      throw new BadRequestException('Cupom inválido');
    }

    const now = new Date();

    // RN015: not expired
    if (coupon.validUntil && coupon.validUntil < now) {
      throw new BadRequestException('Cupom expirado');
    }

    // RN015: valid_from
    if (coupon.validFrom && coupon.validFrom > now) {
      throw new BadRequestException('Cupom ainda não está disponível');
    }

    // RN015: max_uses reached
    if (coupon.maxUses !== null && coupon.usesCount >= coupon.maxUses) {
      throw new BadRequestException('Cupom esgotado');
    }

    // RN014: CPF usage check
    const usedByCpf = await this.prisma.couponUsage.findUnique({
      where: { couponId_userCpf: { couponId: coupon.id, userCpf: user.cpf } },
    });
    if (usedByCpf) {
      throw new BadRequestException('Você já utilizou este cupom');
    }

    // Get cart and calculate subtotal
    const cart = await this.findActiveCart(userId, undefined);
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Carrinho está vazio');
    }

    const subtotal = cart.items.reduce(
      (sum, i) => sum + Number(i.unitPrice) * i.quantity,
      0,
    );

    // RN016: min_order_value
    if (coupon.minOrderValue && subtotal < Number(coupon.minOrderValue)) {
      throw new BadRequestException(
        `Pedido mínimo de R$ ${Number(coupon.minOrderValue).toFixed(2).replace('.', ',')} para usar este cupom`,
      );
    }

    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { couponId: coupon.id },
    });

    await this.invalidateCache(userId, undefined);
    return this.getCart(userId, undefined);
  }

  async removeCoupon(userId?: string, sessionId?: string) {
    const cart = await this.findActiveCart(userId, sessionId);
    if (!cart) return this.buildEmptyResponse();

    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { couponId: null },
    });

    await this.invalidateCache(userId, sessionId);
    return this.getCart(userId, sessionId);
  }
}
