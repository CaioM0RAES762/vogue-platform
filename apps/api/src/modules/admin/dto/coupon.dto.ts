import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  IsDateString,
  IsInt,
  Min,
  Max,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CouponType } from '@prisma/client';

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 50)
  code!: string;

  @IsEnum(CouponType)
  type!: CouponType;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  value!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  maxDiscount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  minOrderValue?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  maxUses?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  maxUsesPerUser?: number = 1;

  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @IsDateString()
  @IsOptional()
  validUntil?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}

export class UpdateCouponDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  value?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  maxDiscount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  minOrderValue?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  maxUses?: number;

  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @IsDateString()
  @IsOptional()
  validUntil?: string;
}

export class PatchCouponStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
