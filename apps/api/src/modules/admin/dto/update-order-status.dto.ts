import { IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @ValidateIf((o) => o.status === 'SHIPPED')
  @IsString()
  trackingCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdminOrderFilterDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  page?: number = 1;

  @IsOptional()
  limit?: number = 20;
}
