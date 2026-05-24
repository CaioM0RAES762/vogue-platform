import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { InventoryMovementType } from '@prisma/client';

export class UpdateInventoryDto {
  @IsInt()
  @Min(0)
  @Type(() => Number)
  stock!: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  minStock?: number;
}

export class CreateInventoryMovementDto {
  @IsUUID()
  variantId!: string;

  @IsEnum(InventoryMovementType)
  type!: InventoryMovementType;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
