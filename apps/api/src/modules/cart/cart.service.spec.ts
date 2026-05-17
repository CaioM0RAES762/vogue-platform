import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CouponType, ProductStatus } from '@prisma/client';

import { CartService } from './cart.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

// ─── Factories ───────────────────────────────────────────────────────────────

function makeVariant(overrides: Partial<{
  id: string;
  stock: number;
  reservedStock: number;
  priceOverride: number | null;
  isActive: boolean;
  productStatus: ProductStatus;
}> = {}) {
  const {
    id = 'variant-1',
    stock = 10,
    reservedStock = 0,
    priceOverride = null,
    isActive = true,
    productStatus = ProductStatus.ACTIVE,
  } = overrides;
  return {
    id,
    productId: 'product-1',
    sku: 'SKU-001',
    size: 'M',
    colorName: 'Preto',
    colorHex: '#000000',
    stock,
    reservedStock,
    minStock: 5,
    priceOverride: priceOverride ? { toNumber: () => priceOverride } as unknown as import('@prisma/client').Prisma.Decimal : null,
    isActive,
    createdAt: new Date(),
    updatedAt: new Date(),
    product: {
      id: 'product-1',
      name: 'Vestido Floral',
      slug: 'vestido-floral',
      price: { toNumber: () => 149.9 } as unknown as import('@prisma/client').Prisma.Decimal,
      status: productStatus,
      images: [
        { thumbnailUrl: 'https://cdn.example.com/thumb.jpg', isPrimary: true },
      ],
    },
  };
}

function makeCart(overrides: Partial<{
  id: string;
  userId: string | null;
  sessionId: string | null;
  couponId: string | null;
  coupon: ReturnType<typeof makeCoupon> | null;
  items: ReturnType<typeof makeCartItem>[];
  updatedAt: Date;
}> = {}) {
  return {
    id: 'cart-1',
    userId: overrides.userId ?? 'user-1',
    sessionId: overrides.sessionId ?? null,
    couponId: overrides.couponId ?? null,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
    items: overrides.items ?? [],
    coupon: overrides.coupon ?? null,
    ...overrides,
  };
}

function makeCartItem(overrides: Partial<{
  id: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
  variant: ReturnType<typeof makeVariant>;
}> = {}) {
  const unitPrice = overrides.unitPrice ?? 149.9;
  return {
    id: overrides.id ?? 'item-1',
    cartId: 'cart-1',
    variantId: overrides.variantId ?? 'variant-1',
    quantity: overrides.quantity ?? 2,
    unitPrice: { toNumber: () => unitPrice } as unknown as import('@prisma/client').Prisma.Decimal,
    createdAt: new Date(),
    variant: overrides.variant ?? makeVariant(),
  };
}

function makeCoupon(overrides: Partial<{
  id: string;
  code: string;
  type: CouponType;
  value: number;
  maxDiscount: number | null;
  minOrderValue: number | null;
  maxUses: number | null;
  usesCount: number;
  validFrom: Date | null;
  validUntil: Date | null;
  isActive: boolean;
}> = {}) {
  return {
    id: overrides.id ?? 'coupon-1',
    code: overrides.code ?? 'VERAO20',
    type: overrides.type ?? CouponType.PERCENTAGE,
    value: { toNumber: () => overrides.value ?? 20 } as unknown as import('@prisma/client').Prisma.Decimal,
    maxDiscount: overrides.maxDiscount != null
      ? { toNumber: () => overrides.maxDiscount } as unknown as import('@prisma/client').Prisma.Decimal
      : null,
    minOrderValue: overrides.minOrderValue != null
      ? { toNumber: () => overrides.minOrderValue } as unknown as import('@prisma/client').Prisma.Decimal
      : null,
    maxUses: overrides.maxUses ?? null,
    usesCount: overrides.usesCount ?? 0,
    maxUsesPerUser: 1,
    validFrom: overrides.validFrom ?? null,
    validUntil: overrides.validUntil ?? null,
    isActive: overrides.isActive ?? true,
    createdAt: new Date(),
  };
}

// ─── Mock PrismaService ───────────────────────────────────────────────────────

function makePrismaMock() {
  return {
    cart: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    cartItem: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    productVariant: {
      findFirst: jest.fn(),
    },
    coupon: {
      findUnique: jest.fn(),
    },
    couponUsage: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };
}

function makeRedisMock() {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CartService', () => {
  let service: CartService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let redis: ReturnType<typeof makeRedisMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    redis = makeRedisMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── T-CART-01: Adicionar item sem variante (tamanho não selecionado) ─────

  describe('T-CART-01 — addItem com variante inválida', () => {
    it('lança NotFoundException se variante não existir', async () => {
      prisma.productVariant.findFirst.mockResolvedValue(null);

      await expect(
        service.addItem('user-1', undefined, { variantId: 'invalid', quantity: 1 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── T-CART-02: Adicionar quantidade maior que o estoque ──────────────────

  describe('T-CART-02 — addItem com estoque insuficiente', () => {
    it('lança UnprocessableEntityException quando quantity > available', async () => {
      const variant = makeVariant({ stock: 3, reservedStock: 0 });
      prisma.productVariant.findFirst.mockResolvedValue(variant);

      const cart = makeCart({ items: [] });
      prisma.cart.findFirst.mockResolvedValue(cart);
      prisma.cart.create.mockResolvedValue(cart);

      await expect(
        service.addItem('user-1', undefined, { variantId: 'variant-1', quantity: 5 }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('não permite acumular itens além do disponível', async () => {
      const variant = makeVariant({ stock: 3, reservedStock: 0 });
      prisma.productVariant.findFirst.mockResolvedValue(variant);

      const existingItem = makeCartItem({ quantity: 2 });
      const cart = makeCart({ items: [existingItem] });
      prisma.cart.findFirst.mockResolvedValue(cart);

      await expect(
        service.addItem('user-1', undefined, { variantId: 'variant-1', quantity: 2 }),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ─── T-CART-03: Remover item do carrinho ──────────────────────────────────

  describe('T-CART-03 — removeItem', () => {
    it('remove o item e retorna o carrinho atualizado', async () => {
      const item = makeCartItem();
      prisma.cartItem.findUnique.mockResolvedValue({
        ...item,
        cart: makeCart(),
      });
      prisma.cartItem.delete.mockResolvedValue(item);

      // After remove, getCart returns empty cart
      const emptyCart = makeCart({ items: [] });
      prisma.cart.findFirst.mockResolvedValue(emptyCart);

      const result = await service.removeItem('item-1', 'user-1', undefined);

      expect(prisma.cartItem.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } });
      expect(result.items).toHaveLength(0);
    });

    it('lança NotFoundException para item que não existe', async () => {
      prisma.cartItem.findUnique.mockResolvedValue(null);

      await expect(service.removeItem('non-existent', 'user-1', undefined))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ─── T-CART-04: Aplicar cupom válido ──────────────────────────────────────

  describe('T-CART-04 — applyCoupon cupom válido', () => {
    it('aplica cupom de percentual e calcula desconto corretamente', async () => {
      prisma.user.findUnique.mockResolvedValue({ cpf: '123.456.789-09' });
      prisma.coupon.findUnique.mockResolvedValue(makeCoupon({ code: 'VERAO20', value: 20 }));
      prisma.couponUsage.findUnique.mockResolvedValue(null); // CPF não usou

      const item = makeCartItem({ quantity: 2, unitPrice: 149.9 }); // subtotal=299.80
      const cart = makeCart({ items: [item] });
      prisma.cart.findFirst.mockResolvedValue(cart);
      prisma.cart.update.mockResolvedValue({ ...cart, couponId: 'coupon-1' });

      // After applying coupon, re-fetch returns cart with coupon
      const cartWithCoupon = makeCart({
        items: [item],
        coupon: makeCoupon({ value: 20 }),
      });
      prisma.cart.findFirst
        .mockResolvedValueOnce(cart)      // primeira chamada no applyCoupon
        .mockResolvedValueOnce(cartWithCoupon); // segunda chamada no getCart

      const result = await service.applyCoupon({ code: 'VERAO20' }, 'user-1');

      expect(result.discount).toBeCloseTo(59.96, 1); // 20% de 299.80
      expect(result.coupon?.code).toBe('VERAO20');
    });
  });

  // ─── T-CART-05: Aplicar cupom inválido (não existe) ───────────────────────

  describe('T-CART-05 — applyCoupon cupom inexistente', () => {
    it('lança BadRequestException com "Cupom inválido"', async () => {
      prisma.user.findUnique.mockResolvedValue({ cpf: '123.456.789-09' });
      prisma.coupon.findUnique.mockResolvedValue(null);

      await expect(
        service.applyCoupon({ code: 'INVALIDO' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança BadRequestException para cupom inativo', async () => {
      prisma.user.findUnique.mockResolvedValue({ cpf: '123.456.789-09' });
      prisma.coupon.findUnique.mockResolvedValue(makeCoupon({ isActive: false }));

      await expect(
        service.applyCoupon({ code: 'VERAO20' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── T-CART-06: Aplicar cupom expirado ────────────────────────────────────

  describe('T-CART-06 — applyCoupon cupom expirado', () => {
    it('lança BadRequestException com "Cupom expirado"', async () => {
      prisma.user.findUnique.mockResolvedValue({ cpf: '123.456.789-09' });
      prisma.coupon.findUnique.mockResolvedValue(
        makeCoupon({ validUntil: new Date(Date.now() - 1000) }), // expirado
      );

      await expect(
        service.applyCoupon({ code: 'VERAO20' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── T-CART-07: Aplicar cupom já usado pelo mesmo CPF ─────────────────────

  describe('T-CART-07 — applyCoupon RN014 uso único por CPF', () => {
    it('lança BadRequestException com "Você já utilizou este cupom"', async () => {
      prisma.user.findUnique.mockResolvedValue({ cpf: '123.456.789-09' });
      prisma.coupon.findUnique.mockResolvedValue(makeCoupon());
      prisma.couponUsage.findUnique.mockResolvedValue({
        id: 'usage-1',
        couponId: 'coupon-1',
        userCpf: '123.456.789-09',
        orderId: 'order-1',
        createdAt: new Date(),
      });

      await expect(
        service.applyCoupon({ code: 'VERAO20' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      const error = await service.applyCoupon({ code: 'VERAO20' }, 'user-1').catch((e: Error) => e);
      expect((error as Error).message).toContain('já utilizou');
    });
  });

  // ─── T-CART-08: Aplicar cupom com pedido abaixo do mínimo ────────────────

  describe('T-CART-08 — applyCoupon RN016 valor mínimo', () => {
    it('lança BadRequestException com o valor mínimo exibido', async () => {
      prisma.user.findUnique.mockResolvedValue({ cpf: '123.456.789-09' });
      prisma.coupon.findUnique.mockResolvedValue(
        makeCoupon({ minOrderValue: 500 }),
      );
      prisma.couponUsage.findUnique.mockResolvedValue(null);

      const item = makeCartItem({ quantity: 1, unitPrice: 149.9 }); // subtotal=149.90 < 500
      const cart = makeCart({ items: [item] });
      prisma.cart.findFirst.mockResolvedValue(cart);

      await expect(
        service.applyCoupon({ code: 'VERAO20' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      const error = await service.applyCoupon({ code: 'VERAO20' }, 'user-1').catch((e: Error) => e);
      expect((error as Error).message).toContain('500');
    });
  });

  // ─── Extras: clearCart e revalidação (RN021) ──────────────────────────────

  describe('clearCart', () => {
    it('remove todos os itens e retorna carrinho vazio', async () => {
      const cart = makeCart({ items: [makeCartItem()] });
      prisma.cart.findFirst.mockResolvedValue(cart);
      prisma.cartItem.deleteMany.mockResolvedValue({ count: 1 });
      prisma.cart.update.mockResolvedValue(cart);

      const result = await service.clearCart('user-1', undefined);

      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart-1' },
      });
      expect(result.items).toHaveLength(0);
    });
  });

  describe('RN021 — revalidação após 1h de inatividade', () => {
    it('remove item quando estoque zera após inatividade', async () => {
      // Cart was updated 2 hours ago
      const staleDate = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const variant = makeVariant({ stock: 0, reservedStock: 0 }); // esgotado
      const item = makeCartItem({ variant });
      const cart = makeCart({ items: [item], updatedAt: staleDate });

      prisma.cart.findFirst.mockResolvedValue(cart);
      prisma.cartItem.delete.mockResolvedValue(item);
      prisma.cart.update.mockResolvedValue(cart);

      // After revalidation re-fetch returns empty cart
      const emptyCart = makeCart({ items: [], updatedAt: new Date() });
      prisma.cart.findFirst.mockResolvedValueOnce(cart).mockResolvedValueOnce(emptyCart);

      await service.getCart('user-1', undefined);

      expect(prisma.cartItem.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } });
    });
  });
});
