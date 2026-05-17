import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ProductSize {
  PP = 'PP',
  P = 'P',
  M = 'M',
  G = 'G',
  GG = 'GG',
  XG = 'XG',
  UNICO = 'UNICO',
}

export class CreateVariantDto {
  @IsEnum(ProductSize)
  size!: ProductSize;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  colorName!: string;

  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'colorHex deve ser hexadecimal válido (#RRGGBB)' })
  colorHex?: string;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  stock!: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  minStock?: number = 5;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  priceOverride?: number;

  @IsString()
  @IsOptional()
  @Length(1, 150)
  sku?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}
