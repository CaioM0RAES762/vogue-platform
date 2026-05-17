import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class ShippingItemDto {
  @IsUUID()
  variantId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class ShippingOptionsDto {
  @IsString()
  @Matches(/^\d{5}-?\d{3}$/, { message: 'CEP inválido' })
  zipCode!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShippingItemDto)
  items!: ShippingItemDto[];
}
