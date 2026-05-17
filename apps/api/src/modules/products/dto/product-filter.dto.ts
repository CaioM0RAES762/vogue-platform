import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum ProductSortOption {
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  NEWEST = 'newest',
  BEST_SELLERS = 'best_sellers',
  RELEVANCE = 'relevance',
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === 'string') return value.split(',').map((v) => v.trim()).filter(Boolean);
  return [];
}

function toBoolean(value: unknown): boolean | undefined {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
}

export class ProductFilterDto {
  @IsString()
  @IsOptional()
  cursor?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 20;

  @IsString()
  @IsOptional()
  category?: string;

  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  sizes?: string[];

  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  colors?: string[];

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  min_price?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  max_price?: number;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  @IsOptional()
  on_sale?: boolean;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  @IsOptional()
  is_new?: boolean;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  @IsOptional()
  in_stock?: boolean;

  @IsEnum(ProductSortOption)
  @IsOptional()
  sort?: ProductSortOption;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  q?: string;
}
