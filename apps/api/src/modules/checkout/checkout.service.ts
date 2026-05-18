import {
  BadRequestException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { ShippingOptionsDto } from './dto/shipping-options.dto';

export interface ShippingOption {
  carrier: string;
  service: string;
  price: number;
  days: number;
}

export interface CheckoutResult {
  orderId: string;
  orderNumber: string;
  payment: {
    method: PaymentMethod;
    externalId?: string;
    qrCode?: string;
    qrCodeBase64?: string;
    barcode?: string;
    boletoUrl?: string;
    expiresAt?: string;
  };
}

const MELHOR_ENVIO_API = 'https://melhorenvio.com.br/api/v2/me/shipment/calculate';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly config: ConfigService,
    private readonly payments: PaymentsService,
  ) {}

  // ─────────────────────────────────────────────
  //  POST /checkout/shipping-options
  // ─────────────────────────────────────────────

  async getShippingOptions(dto: ShippingOptionsDto): Promise<ShippingOption[]> {
    try {
      const token = this.config.get<string>('MELHOR_ENVIO_TOKEN');
      if (!token) throw new Error('MELHOR_ENVIO_TOKEN não configurado');

      const variantIds = dto.items.map((i) => i.variantId);
      const variants = await this.prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
        include: { product: true },
      });

      const products = dto.items.map((item) => {
        const variant = variants.find((v) => v.id === item.variantId);
        if (!variant) throw new BadRequestException(`Variante ${item.variantId} não encontrada`);
        return {
          id: variant.id,
          width: Number(variant.product.width ?? 15),
          height: Number(variant.product.height ?? 5),
          length: Number(variant.product.depth ?? 25),
          weight: Number(variant.product.weight ?? 0.5),
          insurance_value: Number(variant.priceOverride ?? variant.product.price),
          quantity: item.quantity,
        };
      });

      const originCep = this.config.get<string>('STORE_CEP', '01310100');
      const destinyCep = dto.zipCode.replace('-', '');

      const response = await fetch(MELHOR_ENVIO_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'JanainaModas/1.0 caio.moraes@metalsider.com.br',
        },
        body: JSON.stringify({
          from: { postal_code: originCep },
          to: { postal_code: destinyCep },
          products,
        }),
      });

      if (!response.ok) throw new Error(`Melhor Envio retornou ${response.status}`);

      const data = (await response.json()) as Array<{
        name: string;
        id: number;
        price?: string;
        custom_price?: string;
        delivery_time?: number;
        error?: string;
      }>;

      const options: ShippingOption[] = data
        .filter((s) => !s.error && (s.price || s.custom_price))
        .map((s) => ({
          carrier: s.name,
          service: s.name,
          price: parseFloat(s.custom_price ?? s.price ?? '0'),
          days: s.delivery_time ?? 7,
        }));

      if (options.length === 0) throw new Error('Nenhuma opção disponível');

      return options;
    } catch (err) {
      // D-08: fallback quando Melhor Envio indisponível
      this.logger.warn(`Melhor Envio indisponível, usando fallback: ${(err as Error).message}`);
      const fallback = parseFloat(
        this.config.get<string>('FALLBACK_SHIPPING_PRICE', '15.00'),
      );
      return [
        { carrier: 'Correios', service: 'PAC', price: fallback, days: 10 },
      ];
    }
  }

  // ─────────────────────────────────────────────
  //  POST /checkout  (RN026 SELECT FOR UPDATE)
  // ─────────────────────────────────────────────

  async createOrder(
    dto: CreateCheckoutDto,
    userId?: string,
  ): Promise<CheckoutResult> {
    // 1. Buscar carrinho (autenticado ou guest)
    const cartData = await this.cart.getCart(userId, dto.sessionId);
    if (!cartData.items || cartData.items.length === 0) {
      throw new BadRequestException('Carrinho vazio');
    }

    const variantIds = cartData.items.map((i: { variant: { id: string } }) => i.variant.id);

    // Tipos alinhados ao que CartService.buildResponse() retorna
    type CartItemShape = {
      id: string;
      variant: { id: string; size: string; colorName: string; colorHex: string | null; stock: number; reservedStock: number; product: { name: string; slug: string; primaryImage: string | null } };
      quantity: number;
      unitPrice: number;
    };
    type CartCouponShape = { code: string; type: string; value: number } | null;

    const cartItems = cartData.items as CartItemShape[];
    const cartCoupon = cartData.coupon as CartCouponShape;

    // 2. Transação Prisma com SELECT FOR UPDATE (RN026)
    const order = await this.prisma.$transaction(async (tx) => {
      // SELECT FOR UPDATE — bloqueia as variantes para esta transação
      await tx.$executeRawUnsafe(
        `SELECT id FROM product_variants WHERE id = ANY($1::uuid[]) FOR UPDATE`,
        variantIds,
      );

      // 3. Verificar estoque novamente dentro da transação + buscar dados completos para snapshot
      const variants = await tx.productVariant.findMany({
        where: { id: { in: variantIds }, isActive: true },
        include: {
          product: {
            include: { images: { where: { isPrimary: true }, take: 1 } },
          },
        },
      });

      for (const item of cartItems) {
        const fresh = variants.find((v) => v.id === item.variant.id);
        if (!fresh) {
          throw new UnprocessableEntityException(
            `Produto não disponível: ${item.variant.id}`,
          );
        }
        const available = fresh.stock - fresh.reservedStock;
        if (available < item.quantity) {
          throw new UnprocessableEntityException(
            `Estoque insuficiente para o produto ${fresh.id}`,
          );
        }
      }

      // 4. Gerar número do pedido JM-{ANO}{SEQ5DIGITOS} (D-05)
      const year = new Date().getFullYear();
      const lastOrder = await tx.order.findFirst({
        where: { orderNumber: { startsWith: `JM-${year}` } },
        orderBy: { createdAt: 'desc' },
      });

      let seq = 1;
      if (lastOrder) {
        const lastSeq = parseInt(lastOrder.orderNumber.slice(7), 10);
        seq = lastSeq + 1;
      }
      const orderNumber = `JM-${year}${String(seq).padStart(5, '0')}`;

      // 5. Calcular totais usando dados frescos das variantes
      let subtotal = 0;
      const orderItemsData: Array<{
        variantId: string;
        productSnapshot: object;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }> = [];

      for (const item of cartItems) {
        const fresh = variants.find((v) => v.id === item.variant.id)!;
        const unitPrice = Number(fresh.priceOverride ?? fresh.product.price);
        const totalPrice = unitPrice * item.quantity;
        subtotal += totalPrice;

        orderItemsData.push({
          variantId: item.variant.id,
          productSnapshot: {
            productId: fresh.product.id,
            name: fresh.product.name,
            sku: fresh.sku,
            size: fresh.size,
            colorName: fresh.colorName,
            colorHex: fresh.colorHex,
            imageUrl: fresh.product.images[0]?.thumbnailUrl ?? null,
            unitPrice,
          },
          quantity: item.quantity,
          unitPrice,
          totalPrice,
        });
      }

      // 6. Desconto do cupom — buscar dados completos do cupom (code presente no cart)
      let discountAmount = 0;
      let couponId: string | undefined;

      if (cartCoupon) {
        const fullCoupon = await tx.coupon.findUnique({
          where: { code: cartCoupon.code },
          select: { id: true, type: true, value: true, maxDiscount: true },
        });
        if (fullCoupon) {
          couponId = fullCoupon.id;
          if (fullCoupon.type === 'PERCENTAGE') {
            discountAmount = subtotal * (Number(fullCoupon.value) / 100);
            if (fullCoupon.maxDiscount && discountAmount > Number(fullCoupon.maxDiscount)) {
              discountAmount = Number(fullCoupon.maxDiscount);
            }
          } else {
            discountAmount = Math.min(Number(fullCoupon.value), subtotal);
          }
        }
      }

      const shippingAmount = dto.shipping.price;
      const total = subtotal - discountAmount + shippingAmount;

      // 7. Expiração do pedido (30 min para PIX, 3 dias úteis para boleto)
      const expiresAt = this.calcExpiresAt(dto.payment.method);

      // 8. Criar pedido
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId: userId ?? null,
          couponId: couponId ?? null,
          status: 'PENDING',
          subtotal,
          discountAmount,
          shippingAmount,
          total,
          shippingAddress: {
            zipCode: dto.address.zipCode,
            street: dto.address.street,
            number: dto.address.number,
            complement: dto.address.complement ?? null,
            neighborhood: dto.address.neighborhood,
            city: dto.address.city,
            state: dto.address.state,
            recipientName: dto.address.recipientName ?? dto.customer.name,
          },
          shippingMethod: `${dto.shipping.carrier} — ${dto.shipping.service}`,
          estimatedDelivery: new Date(
            Date.now() + dto.shipping.days * 24 * 60 * 60 * 1000,
          ),
          expiresAt,
          // Guest checkout (RF067)
          guestName: !userId ? dto.customer.name : null,
          guestEmail: !userId ? dto.customer.email : null,
          guestCpf: !userId ? dto.customer.cpf : null,
          items: {
            create: orderItemsData.map((i) => ({
              variantId: i.variantId,
              productSnapshot: i.productSnapshot,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              totalPrice: i.totalPrice,
            })),
          },
          statusHistory: {
            create: {
              toStatus: 'PENDING',
              notes: 'Pedido criado',
            },
          },
        },
      });

      // 9. Registrar uso do cupom e incrementar usesCount
      if (couponId) {
        const cpf = userId
          ? (await tx.user.findUnique({ where: { id: userId }, select: { cpf: true } }))?.cpf
          : dto.customer.cpf;

        if (cpf) {
          await tx.couponUsage.create({
            data: {
              couponId,
              userCpf: cpf,
              orderId: newOrder.id,
            },
          });
          await tx.coupon.update({
            where: { id: couponId },
            data: { usesCount: { increment: 1 } },
          });
        }
      }

      // 10. Limpar carrinho após criação do pedido (RN004 — NÃO decrementar estoque ainda)
      if (userId) {
        await this.cart.clearCart(userId, undefined);
      } else if (dto.sessionId) {
        await this.cart.clearCart(undefined, dto.sessionId);
      }

      return newOrder;
    });

    // 11. Criar registro de pagamento placeholder (será atualizado pelo PaymentsService)
    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        externalId: `pending-${order.id}`,
        method: dto.payment.method,
        status: 'PENDING',
        amount: Number(order.total),
        installments: dto.payment.installments ?? null,
        expiresAt: order.expiresAt,
      },
    });

    // 12. Criar pagamento no Mercado Pago e atualizar o registro
    const payerName = userId
      ? (await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } }))?.name ?? dto.customer.name
      : dto.customer.name;

    const mpResult = await this.payments.createPayment({
      orderId: order.id,
      method: dto.payment.method,
      payerEmail: dto.customer.email,
      payerName,
      payerCpf: dto.customer.cpf,
      cardToken: dto.payment.cardToken,
      paymentMethodId: dto.payment.paymentMethodId,
      installments: dto.payment.installments,
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      payment: {
        method: dto.payment.method,
        externalId: mpResult.externalId,
        qrCode: mpResult.qrCode,
        qrCodeBase64: mpResult.qrCodeBase64,
        barcode: mpResult.barcode,
        boletoUrl: mpResult.boletoUrl,
        expiresAt: mpResult.expiresAt,
      },
    };
  }

  // ─────────────────────────────────────────────
  //  Proxy ViaCEP
  // ─────────────────────────────────────────────

  async lookupCep(zipCode: string) {
    const clean = zipCode.replace(/\D/g, '');
    if (clean.length !== 8) {
      throw new BadRequestException('CEP deve ter 8 dígitos');
    }

    const response = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    if (!response.ok) {
      throw new BadRequestException('Serviço ViaCEP indisponível');
    }

    const data = (await response.json()) as { erro?: boolean; logradouro?: string };
    if (data.erro) {
      throw new BadRequestException('CEP não encontrado. Verifique e tente novamente.');
    }

    return data;
  }

  // ─────────────────────────────────────────────
  //  Helpers
  // ─────────────────────────────────────────────

  private calcExpiresAt(method: PaymentMethod): Date {
    const now = Date.now();
    switch (method) {
      case 'PIX':
        return new Date(now + 30 * 60 * 1000); // 30 minutos (RN006)
      case 'BOLETO':
        return new Date(now + 3 * 24 * 60 * 60 * 1000); // 3 dias úteis (RN007)
      default:
        return new Date(now + 30 * 60 * 1000);
    }
  }
}
