import { IsEnum, IsOptional, IsString, IsInt, Min, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ProductStatus } from '@prisma/client';

export class AdminProductFilterDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  lowStock?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  onSale?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

export class BulkProductActionDto {
  @IsString({ each: true })
  ids!: string[];

  @IsEnum(['activate', 'deactivate', 'delete'])
  action!: 'activate' | 'deactivate' | 'delete';
}
