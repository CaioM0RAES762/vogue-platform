import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateVariantDto } from './create-variant.dto';

export enum ProductStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DRAFT = 'DRAFT',
}

export enum Gender {
  FEMININO = 'FEMININO',
  MASCULINO = 'MASCULINO',
  UNISSEX = 'UNISSEX',
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  name!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsUUID()
  categoryId!: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  promotionalPrice?: number;

  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus = ProductStatus.DRAFT;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean = false;

  @IsBoolean()
  @IsOptional()
  isOnSale?: boolean = false;

  @IsString()
  @IsOptional()
  @Length(1, 100)
  sku?: string;

  @IsString()
  @IsOptional()
  @Length(1, 100)
  brand?: string;

  @IsString()
  @IsOptional()
  @Length(1, 100)
  collection?: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsString()
  @IsOptional()
  composition?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  weight?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  width?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  height?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  depth?: number;

  @IsString()
  @IsOptional()
  @Length(1, 70)
  seoTitle?: string;

  @IsString()
  @IsOptional()
  @Length(1, 160)
  seoDescription?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[] = [];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants!: CreateVariantDto[];

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  imageIds?: string[] = [];
}
