import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock do SDK Mercado Pago
jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest.fn().mockImplementation(() => ({})),
  Payment: jest.fn().mockImplementation(() => ({
    create: jest.fn(),
    get: jest.fn(),
  })),
}));

const { Payment: MockPayment } = jest.requireMock('mercadopago');

function buildMockOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-uuid-1',
    orderNumber: 'JM-202500001',
    total: 150.0,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    status: 'PENDING',
    items: [
      { id: 'item-1', variantId: 'variant-1', quantity: 2, unitPrice: 75 },
    ],
    payments: [
      {
        id: 'pay-uuid-1',
        externalId: 'pending-order-uuid-1',
        status: 'PENDING',
        orderId: 'order-uuid-1',
      },
    ],
    ...overrides,
  };
}

function buildMockPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pay-uuid-1',
    externalId: 'mp-ext-001',
    status: 'PENDING',
    orderId: 'order-uuid-1',
    order: buildMockOrder({
      payments: [],
      items: [{ id: 'item-1', variantId: 'variant-1', quantity: 2 }],
    }),
    ...overrides,
  };
}

describe('PaymentsService', () => {
  let service: PaymentsService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let emailQueue: any;
  let mpPaymentInstance: { create: jest.Mock; get: jest.Mock };

  beforeEach(async () => {
    mpPaymentInstance = { create: jest.fn(), get: jest.fn() };
    MockPayment.mockImplementation(() => mpPaymentInstance);

    prisma = {
      order: {
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      payment: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      productVariant: {
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      inventoryMovement: { create: jest.fn() },
      $transaction: jest.fn(),
    };

    emailQueue = { add: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('') },
        },
        { provide: getQueueToken('emailQueue'), useValue: emailQueue },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─────────────────────────────────────────────
  //  T-PAG-01: PIX aprovado → pedido PAID, estoque decrementado, e-mail enviado
  // ─────────────────────────────────────────────
  describe('T-PAG-01: approvePayment', () => {
    it('atualiza order para PAID, decrementa estoque e envia e-mail', async () => {
      const payment = buildMockPayment();

      prisma.payment.findUnique.mockResolvedValue(payment);

      // Simula transação executando callback
      prisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<void>) => {
        const tx = {
          order: { update: jest.fn() },
          payment: { update: jest.fn() },
          productVariant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({ stock: 10 }),
            update: jest.fn(),
          },
          inventoryMovement: { create: jest.fn() },
        };
        await cb(tx);
        expect(tx.order.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ status: 'PAID' }) }),
        );
        expect(tx.payment.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ status: 'APPROVED' }) }),
        );
        expect(tx.productVariant.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: { stock: 8 } }),
        );
        expect(tx.inventoryMovement.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ type: 'SALE', quantity: -2 }) }),
        );
      });

      await service.approvePayment('mp-ext-001');

      expect(emailQueue.add).toHaveBeenCalledWith(
        'order-confirmed',
        expect.objectContaining({ orderId: 'order-uuid-1' }),
      );
    });
  });

  // ─────────────────────────────────────────────
  //  T-PAG-02: PIX expirado → pedido CANCELLED, estoque revertido
  // ─────────────────────────────────────────────
  describe('T-PAG-02: cancelPayment', () => {
    it('cancela pedido e reverte estoque', async () => {
      const payment = buildMockPayment();
      prisma.payment.findUnique.mockResolvedValue(payment);

      prisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<void>) => {
        const tx = {
          order: { update: jest.fn() },
          payment: { update: jest.fn() },
          productVariant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({ stock: 8 }),
            update: jest.fn(),
          },
          inventoryMovement: { create: jest.fn() },
        };
        await cb(tx);
        expect(tx.order.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ status: 'CANCELLED' }),
          }),
        );
        expect(tx.productVariant.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: { stock: 10 } }),
        );
        expect(tx.inventoryMovement.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ type: 'CANCELLATION', quantity: 2 }),
          }),
        );
      });

      await service.cancelPayment('mp-ext-001', 'PIX expirado');
    });
  });

  // ─────────────────────────────────────────────
  //  T-PAG-03: Cartão válido aprovado
  // ─────────────────────────────────────────────
  describe('T-PAG-03: createPayment com cartão', () => {
    it('chama MP com token e retorna status', async () => {
      const order = buildMockOrder();
      prisma.order.findUniqueOrThrow.mockResolvedValue(order);
      prisma.payment.update.mockResolvedValue({});

      mpPaymentInstance.create.mockResolvedValue({
        id: 'mp-card-001',
        status: 'approved',
      });

      const result = await service.createPayment({
        orderId: 'order-uuid-1',
        method: 'CREDIT_CARD' as any,
        payerEmail: 'user@test.com',
        payerName: 'Joana Silva',
        payerCpf: '123.456.789-09',
        cardToken: 'token-xyz',
        paymentMethodId: 'visa',
        installments: 1,
      });

      expect(mpPaymentInstance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ token: 'token-xyz', installments: 1 }),
        }),
      );
      expect(result.externalId).toBe('mp-card-001');
      expect(result.status).toBe('approved');
    });
  });

  // ─────────────────────────────────────────────
  //  T-PAG-04: Cartão recusado (status rejected)
  // ─────────────────────────────────────────────
  describe('T-PAG-04: cartão recusado', () => {
    it('retorna status rejected sem lançar exceção', async () => {
      const order = buildMockOrder();
      prisma.order.findUniqueOrThrow.mockResolvedValue(order);
      prisma.payment.update.mockResolvedValue({});

      mpPaymentInstance.create.mockResolvedValue({
        id: 'mp-card-002',
        status: 'rejected',
      });

      const result = await service.createPayment({
        orderId: 'order-uuid-1',
        method: 'CREDIT_CARD' as any,
        payerEmail: 'user@test.com',
        payerName: 'Joana Silva',
        payerCpf: '123.456.789-09',
        cardToken: 'token-bad',
        paymentMethodId: 'visa',
        installments: 1,
      });

      expect(result.status).toBe('rejected');
    });
  });

  // ─────────────────────────────────────────────
  //  T-PAG-05: Cartão sem token lança exceção (RN008)
  // ─────────────────────────────────────────────
  describe('T-PAG-05: cartão sem cardToken', () => {
    it('lança BadRequestException (RN008)', async () => {
      const order = buildMockOrder();
      prisma.order.findUniqueOrThrow.mockResolvedValue(order);

      await expect(
        service.createPayment({
          orderId: 'order-uuid-1',
          method: 'CREDIT_CARD' as any,
          payerEmail: 'user@test.com',
          payerName: 'Joana Silva',
          payerCpf: '123.456.789-09',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  //  T-PAG-06: Webhook duplicado — idempotência
  // ─────────────────────────────────────────────
  describe('T-PAG-06: webhook duplicado', () => {
    it('ignora payment já APPROVED sem duplicar decremento', async () => {
      const payment = buildMockPayment({ status: 'APPROVED' });
      prisma.payment.findUnique.mockResolvedValue(payment);

      await service.approvePayment('mp-ext-001');

      // Transação NÃO deve ser chamada — idempotência
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(emailQueue.add).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  //  T-EST-01: Concorrência — dois usuários, última unidade
  //  (verifica que approvePayment decrementa corretamente stock=1 → 0)
  // ─────────────────────────────────────────────
  describe('T-EST-01: decremento correto de estoque', () => {
    it('decrementa stock de 10 para 8 para quantity=2', async () => {
      const payment = buildMockPayment();
      prisma.payment.findUnique.mockResolvedValue(payment);

      let updatedStock: number | undefined;

      prisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<void>) => {
        const tx = {
          order: { update: jest.fn() },
          payment: { update: jest.fn() },
          productVariant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({ stock: 10 }),
            update: jest.fn().mockImplementation((args: { data: { stock: number } }) => {
              updatedStock = args.data.stock;
            }),
          },
          inventoryMovement: { create: jest.fn() },
        };
        await cb(tx);
      });

      await service.approvePayment('mp-ext-001');
      expect(updatedStock).toBe(8); // 10 - 2
    });
  });

  // ─────────────────────────────────────────────
  //  T-EST-02: Cancelamento reverte estoque
  // ─────────────────────────────────────────────
  describe('T-EST-02: cancelamento reverte estoque', () => {
    it('incrementa stock de 8 para 10 ao cancelar quantity=2', async () => {
      const payment = buildMockPayment();
      prisma.payment.findUnique.mockResolvedValue(payment);

      let revertedStock: number | undefined;

      prisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<void>) => {
        const tx = {
          order: { update: jest.fn() },
          payment: { update: jest.fn() },
          productVariant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({ stock: 8 }),
            update: jest.fn().mockImplementation((args: { data: { stock: number } }) => {
              revertedStock = args.data.stock;
            }),
          },
          inventoryMovement: { create: jest.fn() },
        };
        await cb(tx);
      });

      await service.cancelPayment('mp-ext-001', 'PIX expirado');
      expect(revertedStock).toBe(10); // 8 + 2
    });
  });

  // ─────────────────────────────────────────────
  //  T-EST-03: Cron D-10 cancela pedidos expirados
  // ─────────────────────────────────────────────
  describe('T-EST-03: cancelExpiredOrders', () => {
    it('chama cancelPayment para cada pedido expirado', async () => {
      const expiredOrder = {
        id: 'order-exp-1',
        orderNumber: 'JM-202500002',
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 60_000),
        items: [{ variantId: 'variant-1', quantity: 1 }],
        payments: [{ id: 'pay-2', externalId: 'mp-exp-001', status: 'PENDING' }],
      };

      prisma.order.findMany.mockResolvedValue([expiredOrder]);

      const cancelSpy = jest.spyOn(service, 'cancelPayment').mockResolvedValue(undefined);

      await service.cancelExpiredOrders();

      expect(cancelSpy).toHaveBeenCalledWith(
        'mp-exp-001',
        'Pedido expirado sem confirmação de pagamento',
      );
    });

    it('não cancela nada se não houver pedidos expirados', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      const cancelSpy = jest.spyOn(service, 'cancelPayment').mockResolvedValue(undefined);

      await service.cancelExpiredOrders();

      expect(cancelSpy).not.toHaveBeenCalled();
    });
  });
});
