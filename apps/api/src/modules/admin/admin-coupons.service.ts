import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCouponDto, PatchCouponStatusDto, UpdateCouponDto } from './dto/coupon.dto';

@Injectable()
export class AdminCouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const coupons = await this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { usages: true } } },
    });
    return coupons.map((c) => ({ ...c, usageCount: c._count.usages }));
  }

  async findOne(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: { usages: { take: 50, orderBy: { createdAt: 'desc' } } },
    });
    if (!coupon) throw new NotFoundException('Cupom não encontrado');
    return coupon;
  }

  async create(dto: CreateCouponDto) {
    const code = dto.code.toUpperCase().trim();
    const exists = await this.prisma.coupon.findUnique({ where: { code } });
    if (exists) throw new ConflictException('Código de cupom já existe');

    return this.prisma.coupon.create({
      data: {
        code,
        type: dto.type,
        value: dto.value,
        maxDiscount: dto.maxDiscount ?? null,
        minOrderValue: dto.minOrderValue ?? null,
        maxUses: dto.maxUses ?? null,
        maxUsesPerUser: dto.maxUsesPerUser ?? 1,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateCouponDto) {
    await this.findOne(id);
    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...(dto.value !== undefined ? { value: dto.value } : {}),
        ...(dto.maxDiscount !== undefined ? { maxDiscount: dto.maxDiscount } : {}),
        ...(dto.minOrderValue !== undefined ? { minOrderValue: dto.minOrderValue } : {}),
        ...(dto.maxUses !== undefined ? { maxUses: dto.maxUses } : {}),
        ...(dto.validFrom !== undefined ? { validFrom: new Date(dto.validFrom) } : {}),
        ...(dto.validUntil !== undefined ? { validUntil: new Date(dto.validUntil) } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    const usages = await this.prisma.couponUsage.count({ where: { couponId: id } });
    if (usages > 0) throw new BadRequestException('Cupom com usos registrados não pode ser excluído');
    await this.prisma.coupon.delete({ where: { id } });
    return { message: 'Cupom removido com sucesso' };
  }

  async patchStatus(id: string, dto: PatchCouponStatusDto) {
    await this.findOne(id);
    await this.prisma.coupon.update({ where: { id }, data: { isActive: dto.isActive } });
    return { message: `Cupom ${dto.isActive ? 'ativado' : 'desativado'} com sucesso` };
  }
}
