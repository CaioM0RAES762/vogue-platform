import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod } from '@prisma/client';

import { CheckoutService } from './checkout.service';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

const VARIANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ORDER_ID   = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function mockCartItem(stock = 10, quantity = 2) {
  return {
    variant: {
      id: VARIANT_ID,
      size: 'M',
      colorName: 'Preto',
      colorHex: '#000000',
      priceOverride: null,
      stock,
      reservedStock: 0,
      product: {
        id: 'prod-id',
        name: 'Blusa Teste',
        sku: 'JM-001',
        price: 149.9,
        images: [{ thumbnailUrl: 'https://res.cloudinary.com/test/image.webp' }],
      },
    },
    quantity,
    unitPrice: 149.9,
  };
}

function buildCheckoutDto(method: PaymentMethod = 'PIX') {
  return {
    customer: {
      name: 'Maria Silva',
      email: 'maria@teste.com',
      cpf: '123.456.789-09',
      phone: '(11) 99999-9999',
    },
    address: {
      zipCode: '01310-100',
      street: 'Av. Paulista',
      number: '1578',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    },
    shipping: { carrier: 'Correios', service: 'SEDEX', price: 25.9, days: 2 },
    payment: { method },
  };
}

// ──────────────────────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────────────────────

function buildPrismaMock(overrides?: object) {
  return {
    $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
      fn(buildTxMock()),
    ),
    payment: {
      create: jest.fn().mockResolvedValue({
        id: 'payment-id',
        orderId: ORDER_ID,
        method: 'PIX',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      }),
    },
    productVariant: { findMany: jest.fn() },
    ...overrides,
  };
}

function buildTxMock(stockOverride?: number) {
  const stock = stockOverride ?? 10;
  return {
    $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    productVariant: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: VARIANT_ID,
          sku: 'JM-001-M-PRETO',
          size: 'M',
          colorName: 'Preto',
          colorHex: '#000000',
          priceOverride: null,
          stock,
          reservedStock: 0,
          isActive: true,
          product: {
            id: 'prod-id',
            name: 'Blusa Teste',
            sku: 'JM-001',
            price: 149.9,
            images: [{ thumbnailUrl: 'https://res.cloudinary.com/test/image.webp' }],
          },
        },
      ]),
    },
    order: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: ORDER_ID,
        orderNumber: `JM-${new Date().getFullYear()}00001`,
        total: 325.8,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        items: [],
      }),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ cpf: '123.456.789-09' }) },
    couponUsage: { create: jest.fn().mockResolvedValue({}) },
    coupon: { update: jest.fn().mockResolvedValue({}) },
  };
}

function buildCartMock(items?: unknown[], coupon?: unknown) {
  return {
    getCart: jest.fn().mockResolvedValue({
      items: items ?? [mockCartItem()],
      coupon: coupon ?? null,
    }),
    clearCart: jest.fn().mockResolvedValue(undefined),
  };
}

function buildConfigMock(overrides?: Record<string, string>) {
  const defaults: Record<string, string> = {
    FALLBACK_SHIPPING_PRICE: '15.00',
    MELHOR_ENVIO_TOKEN: '',
    STORE_CEP: '01310100',
    ...overrides,
  };
  return { get: jest.fn((key: string, def?: string) => defaults[key] ?? def ?? '') };
}

async function buildService(
  prismaMock: unknown,
  cartMock: unknown,
  configMock: unknown,
): Promise<CheckoutService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      CheckoutService,
      { provide: PrismaService, useValue: prismaMock },
      { provide: CartService, useValue: cartMock },
      { provide: ConfigService, useValue: configMock },
    ],
  }).compile();

  return module.get<CheckoutService>(CheckoutService);
}

// ──────────────────────────────────────────────────────────────
// T-CHECKOUT-01: Criação de pedido com dados válidos (PIX)
// ──────────────────────────────────────────────────────────────
describe('T-CHECKOUT-01 — Criação de pedido PIX com dados válidos', () => {
  it('deve criar pedido e retornar orderId + orderNumber', async () => {
    const prismaMock = buildPrismaMock();
    const cartMock = buildCartMock();
    const service = await buildService(prismaMock, cartMock, buildConfigMock());

    const result = await service.createOrder(buildCheckoutDto(), 'user-id');

    expect(result.orderId).toBe(ORDER_ID);
    expect(result.orderNumber).toMatch(/^JM-\d{9}$/);
    expect(result.payment.method).toBe('PIX');
    expect(result.payment.expiresAt).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────
// T-CHECKOUT-02: Carrinho vazio → BadRequestException
// ──────────────────────────────────────────────────────────────
describe('T-CHECKOUT-02 — Carrinho vazio', () => {
  it('deve lançar BadRequestException se carrinho vazio', async () => {
    const prismaMock = buildPrismaMock();
    const cartMock = buildCartMock([]);
    const service = await buildService(prismaMock, cartMock, buildConfigMock());

    await expect(service.createOrder(buildCheckoutDto(), 'user-id')).rejects.toThrow(
      BadRequestException,
    );
  });
});

// ──────────────────────────────────────────────────────────────
// T-CHECKOUT-03: Concorrência — estoque insuficiente (RN026)
// ──────────────────────────────────────────────────────────────
describe('T-CHECKOUT-03 — Concorrência de estoque (RN026)', () => {
  it('deve lançar UnprocessableEntityException quando estoque < quantidade', async () => {
    // Simula que outro request já comprou: stock=1 mas quantity=2
    const txMock = buildTxMock(1);
    const prismaMock = {
      ...buildPrismaMock(),
      $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
        fn(txMock),
      ),
      payment: { create: jest.fn() },
    };
    const cartMock = buildCartMock([mockCartItem(1, 2)]);
    const service = await buildService(prismaMock, cartMock, buildConfigMock());

    await expect(service.createOrder(buildCheckoutDto(), 'user-id')).rejects.toThrow(
      UnprocessableEntityException,
    );
  });
});

// ──────────────────────────────────────────────────────────────
// T-CHECKOUT-04: Snapshot de produto imutável no order_item
// ──────────────────────────────────────────────────────────────
describe('T-CHECKOUT-04 — Snapshot do produto no order_item', () => {
  it('deve incluir productSnapshot com nome, sku, size, colorName, imageUrl', async () => {
    let capturedSnapshot: unknown;
    const txMock = buildTxMock();
    txMock.order.create = jest.fn().mockImplementation(async ({ data }: { data: { items: { create: Array<{ productSnapshot: unknown }> } } }) => {
      capturedSnapshot = data.items.create[0].productSnapshot;
      return {
        id: ORDER_ID,
        orderNumber: `JM-${new Date().getFullYear()}00001`,
        total: 325.8,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      };
    });

    const prismaMock = {
      ...buildPrismaMock(),
      $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
        fn(txMock),
      ),
      payment: {
        create: jest.fn().mockResolvedValue({
          id: 'payment-id',
          orderId: ORDER_ID,
          expiresAt: new Date(),
        }),
      },
    };
    const cartMock = buildCartMock();
    const service = await buildService(prismaMock, cartMock, buildConfigMock());

    await service.createOrder(buildCheckoutDto(), 'user-id');

    expect(capturedSnapshot).toMatchObject({
      name: 'Blusa Teste',
      sku: expect.any(String),
      size: 'M',
      colorName: 'Preto',
      imageUrl: expect.stringContaining('cloudinary'),
    });
  });
});

// ──────────────────────────────────────────────────────────────
// T-CHECKOUT-05: Order number gerado no formato JM-{ANO}{SEQ5}
// ──────────────────────────────────────────────────────────────
describe('T-CHECKOUT-05 — Formato do número do pedido (D-05)', () => {
  it('deve gerar JM-{ANO}00001 para o primeiro pedido do ano', async () => {
    const prismaMock = buildPrismaMock();
    const cartMock = buildCartMock();
    const service = await buildService(prismaMock, cartMock, buildConfigMock());

    const result = await service.createOrder(buildCheckoutDto(), 'user-id');

    const year = new Date().getFullYear();
    expect(result.orderNumber).toBe(`JM-${year}00001`);
  });
});

// ──────────────────────────────────────────────────────────────
// T-CHECKOUT-06: Guest checkout (RF067) — sem userId
// ──────────────────────────────────────────────────────────────
describe('T-CHECKOUT-06 — Guest checkout (RF067)', () => {
  it('deve criar pedido sem userId preenchendo guestName/guestEmail/guestCpf', async () => {
    let capturedData: unknown;
    const txMock = buildTxMock();
    txMock.order.create = jest.fn().mockImplementation(async ({ data }: { data: unknown }) => {
      capturedData = data;
      return {
        id: ORDER_ID,
        orderNumber: `JM-${new Date().getFullYear()}00001`,
        total: 325.8,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      };
    });

    const prismaMock = {
      ...buildPrismaMock(),
      $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
        fn(txMock),
      ),
      payment: {
        create: jest.fn().mockResolvedValue({
          id: 'payment-id',
          orderId: ORDER_ID,
          expiresAt: new Date(),
        }),
      },
    };
    const cartMock = buildCartMock();
    const service = await buildService(prismaMock, cartMock, buildConfigMock());

    // userId = undefined → guest
    await service.createOrder({ ...buildCheckoutDto(), sessionId: 'sess-abc' }, undefined);

    expect(capturedData).toMatchObject({
      userId: null,
      guestName: 'Maria Silva',
      guestEmail: 'maria@teste.com',
      guestCpf: '123.456.789-09',
    });
  });
});

// ──────────────────────────────────────────────────────────────
// T-CHECKOUT-07: Estoque NÃO decrementado na criação (RN004)
// ──────────────────────────────────────────────────────────────
describe('T-CHECKOUT-07 — Estoque não decrementado na criação do pedido (RN004)', () => {
  it('não deve chamar update em productVariant durante createOrder', async () => {
    const txMock = buildTxMock();
    const updateSpy = jest.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (txMock.productVariant as any).update = updateSpy;

    const prismaMock = {
      ...buildPrismaMock(),
      $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
        fn(txMock),
      ),
      payment: {
        create: jest.fn().mockResolvedValue({
          id: 'payment-id',
          orderId: ORDER_ID,
          expiresAt: new Date(),
        }),
      },
    };
    const cartMock = buildCartMock();
    const service = await buildService(prismaMock, cartMock, buildConfigMock());

    await service.createOrder(buildCheckoutDto(), 'user-id');

    expect(updateSpy).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────
// T-CHECKOUT-08: Fallback de frete quando Melhor Envio indisponível (D-08)
// ──────────────────────────────────────────────────────────────
describe('T-CHECKOUT-08 — Fallback de frete (D-08)', () => {
  it('deve retornar frete fallback quando Melhor Envio indisponível', async () => {
    const prismaMock = {
      productVariant: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: VARIANT_ID,
            priceOverride: null,
            product: { price: 149.9, weight: 0.5, width: 15, height: 5, depth: 25 },
          },
        ]),
      },
    };
    const cartMock = buildCartMock();
    const configMock = buildConfigMock({ FALLBACK_SHIPPING_PRICE: '25.00', MELHOR_ENVIO_TOKEN: '' });
    const service = await buildService(prismaMock, cartMock, configMock);

    const options = await service.getShippingOptions({
      zipCode: '01310-100',
      items: [{ variantId: VARIANT_ID, quantity: 1 }],
    });

    expect(options).toHaveLength(1);
    expect(options[0].price).toBe(25);
    expect(options[0].carrier).toBe('Correios');
  });
});
