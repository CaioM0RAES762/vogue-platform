import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { PaymentsService } from '../payments/payments.service';

const mockPrisma = {
  user: { findUnique: jest.fn(), update: jest.fn() },
  userAddress: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  order: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
  orderStatusHistory: { create: jest.fn() },
  refreshToken: { updateMany: jest.fn() },
  $transaction: jest.fn(),
};

const mockMail = { sendOrderCancelled: jest.fn(), sendOrderConfirmed: jest.fn() };
const mockPayments = { cancelPayment: jest.fn() };

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: mockMail },
        { provide: PaymentsService, useValue: mockPayments },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  // T-USER-01: getMe retorna dados do usuário autenticado
  describe('getMe', () => {
    it('retorna dados sem senha', async () => {
      const user = { id: 'u1', name: 'Joana', email: 'j@j.com', cpf: '123', phone: '11999', role: 'USER', createdAt: new Date() };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      const result = await service.getMe('u1');
      expect(result).toEqual(user);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'u1' },
        select: expect.objectContaining({ id: true, name: true }),
      });
    });

    it('lança NotFoundException se usuário não existir', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getMe('inexistente')).rejects.toThrow(NotFoundException);
    });
  });

  // T-USER-02: updateMe aceita apenas name e phone
  describe('updateMe', () => {
    it('atualiza name e phone, CPF não alterável', async () => {
      const updated = { id: 'u1', name: 'Novo Nome', email: 'j@j.com', cpf: '123', phone: '99' };
      mockPrisma.user.update.mockResolvedValue(updated);
      const result = await service.updateMe('u1', { name: 'Novo Nome', phone: '99' });
      expect(result).toEqual(updated);
      const callData = mockPrisma.user.update.mock.calls[0][0].data;
      expect(callData).not.toHaveProperty('cpf');
      expect(callData).not.toHaveProperty('email');
    });
  });

  // T-USER-03: createAddress define primeiro como padrão automaticamente
  describe('createAddress', () => {
    it('primeiro endereço é definido como padrão', async () => {
      mockPrisma.userAddress.count.mockResolvedValue(0);
      mockPrisma.userAddress.updateMany.mockResolvedValue({ count: 0 });
      const addr = { id: 'a1', isDefault: true };
      mockPrisma.userAddress.create.mockResolvedValue(addr);
      const result = await service.createAddress('u1', {
        recipientName: 'Joana',
        zipCode: '01310-100',
        street: 'Av. Paulista',
        number: '1000',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
      });
      expect(result.isDefault).toBe(true);
    });
  });

  // T-USER-04: ensureAddressOwnership bloqueia outro usuário
  describe('deleteAddress', () => {
    it('lança ForbiddenException se endereço não pertence ao usuário', async () => {
      mockPrisma.userAddress.findUnique.mockResolvedValue({ id: 'a1', userId: 'outro' });
      await expect(service.deleteAddress('u1', 'a1')).rejects.toThrow(ForbiddenException);
    });

    it('lança NotFoundException se endereço não existe', async () => {
      mockPrisma.userAddress.findUnique.mockResolvedValue(null);
      await expect(service.deleteAddress('u1', 'inexistente')).rejects.toThrow(NotFoundException);
    });
  });

  // T-USER-05: getOrders retorna paginação correta
  describe('getOrders', () => {
    it('retorna data + meta com paginação', async () => {
      const orders = [{ id: 'o1', orderNumber: 'JM-2025001', status: 'PAID', total: 100, createdAt: new Date(), payments: [] }];
      mockPrisma.order.findMany.mockResolvedValue(orders);
      mockPrisma.order.count.mockResolvedValue(1);
      const result = await service.getOrders('u1', { page: '1', limit: '10' });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  // T-USER-06: getOrderById bloqueia acesso de outro usuário
  describe('getOrderById', () => {
    it('lança ForbiddenException se pedido é de outro usuário', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({ id: 'o1', userId: 'outro', items: [], payments: [], statusHistory: [] });
      await expect(service.getOrderById('u1', 'o1')).rejects.toThrow(ForbiddenException);
    });
  });

  // T-USER-07: cancelOrder — D-07, apenas PENDING ou PAID
  describe('cancelOrder', () => {
    it('lança BadRequestException para pedido SHIPPED', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'u1',
        status: OrderStatus.SHIPPED,
        payments: [],
      });
      await expect(service.cancelOrder('u1', 'o1', { reason: 'Não quero mais' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('cancela pedido PENDING sem reversão de estoque', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'u1',
        status: OrderStatus.PENDING,
        orderNumber: 'JM-2025001',
        payments: [],
      });
      mockPrisma.$transaction.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValue({ email: 'j@j.com' });
      await service.cancelOrder('u1', 'o1', { reason: 'Desisti da compra' });
      expect(mockPayments.cancelPayment).not.toHaveBeenCalled();
      expect(mockMail.sendOrderCancelled).toHaveBeenCalledWith('j@j.com', 'JM-2025001');
    });

    it('cancela pedido PAID chamando cancelPayment (reversão de estoque)', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'u1',
        status: OrderStatus.PAID,
        orderNumber: 'JM-2025002',
        payments: [{ externalId: 'ext123' }],
      });
      mockPayments.cancelPayment.mockResolvedValue(undefined);
      mockPrisma.user.findUnique.mockResolvedValue({ email: 'j@j.com' });
      await service.cancelOrder('u1', 'o1', { reason: 'Produto errado' });
      expect(mockPayments.cancelPayment).toHaveBeenCalledWith('ext123', 'Produto errado');
    });
  });

  // T-USER-08: deleteMe — LGPD anonimização
  describe('deleteMe', () => {
    it('anonimiza dados pessoais e revoga tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', name: 'Joana' });
      mockPrisma.$transaction.mockResolvedValue([]);
      await service.deleteMe('u1');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      const ops = mockPrisma.$transaction.mock.calls[0][0];
      expect(ops).toHaveLength(3); // update user + updateMany tokens + deleteMany addresses
    });
  });
});
