import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateInventoryDto, CreateInventoryMovementDto } from './dto/inventory.dto';

type StockStatus = 'AVAILABLE' | 'LOW' | 'OUT_OF_STOCK';

function getStockStatus(stock: number, minStock: number): StockStatus {
  if (stock === 0) return 'OUT_OF_STOCK';
  if (stock <= minStock) return 'LOW';
  return 'AVAILABLE';
}

@Injectable()
export class AdminInventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const variants = await this.prisma.productVariant.findMany({
      include: {
        product: { select: { name: true, category: { select: { name: true } } } },
        inventoryMovements: {
          where: {
            type: InventoryMovementType.SALE,
            createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          },
          select: { quantity: true },
        },
      },
      orderBy: [{ product: { name: 'asc' } }, { size: 'asc' }],
    });

    return variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      productName: v.product.name,
      category: v.product.category.name,
      size: v.size,
      colorName: v.colorName,
      colorHex: v.colorHex,
      stock: v.stock,
      minStock: v.minStock,
      soldThisMonth: v.inventoryMovements.reduce((s, m) => s + m.quantity, 0),
      status: getStockStatus(v.stock, v.minStock),
    }));
  }

  async updateVariant(variantId: string, dto: UpdateInventoryDto, adminId: string) {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) throw new NotFoundException('Variante não encontrada');

    const stockBefore = variant.stock;
    const newStock = dto.stock;
    const diff = newStock - stockBefore;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.productVariant.update({
        where: { id: variantId },
        data: {
          stock: newStock,
          ...(dto.minStock !== undefined ? { minStock: dto.minStock } : {}),
        },
      });

      if (diff !== 0) {
        await tx.inventoryMovement.create({
          data: {
            variantId,
            userId: adminId,
            type: diff > 0 ? InventoryMovementType.ENTRY : InventoryMovementType.MANUAL_EXIT,
            quantity: Math.abs(diff),
            stockBefore,
            stockAfter: newStock,
            reason: 'Ajuste manual via painel admin',
          },
        });
      }

      return { ...updated, status: getStockStatus(updated.stock, updated.minStock) };
    });
  }

  async createMovement(dto: CreateInventoryMovementDto, adminId: string) {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: dto.variantId } });
    if (!variant) throw new NotFoundException('Variante não encontrada');

    const isEntry = dto.type === InventoryMovementType.ENTRY;
    if (!isEntry && variant.stock < dto.quantity) {
      throw new BadRequestException('Estoque insuficiente para realizar saída');
    }

    const stockBefore = variant.stock;
    const stockAfter = isEntry ? stockBefore + dto.quantity : stockBefore - dto.quantity;

    return this.prisma.$transaction(async (tx) => {
      await tx.productVariant.update({
        where: { id: dto.variantId },
        data: { stock: stockAfter },
      });

      return tx.inventoryMovement.create({
        data: {
          variantId: dto.variantId,
          userId: adminId,
          type: dto.type,
          quantity: dto.quantity,
          stockBefore,
          stockAfter,
          reason: dto.reason,
          notes: dto.notes ?? null,
        },
      });
    });
  }

  async getMovements(variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) throw new NotFoundException('Variante não encontrada');

    return this.prisma.inventoryMovement.findMany({
      where: { variantId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
