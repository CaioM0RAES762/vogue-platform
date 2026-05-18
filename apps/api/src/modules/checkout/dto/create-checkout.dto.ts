import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CustomerDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsString()
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'E-mail inválido' })
  email!: string;

  @IsString()
  @Matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, { message: 'CPF inválido' })
  cpf!: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;
}

export class AddressDto {
  @IsString()
  @Matches(/^\d{5}-?\d{3}$/, { message: 'CEP inválido' })
  zipCode!: string;

  @IsString()
  @MaxLength(255)
  street!: string;

  @IsString()
  @MaxLength(20)
  number!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  complement?: string;

  @IsString()
  @MaxLength(100)
  neighborhood!: string;

  @IsString()
  @MaxLength(100)
  city!: string;

  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'UF inválida' })
  state!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  recipientName?: string;
}

export class ShippingDto {
  @IsString()
  @MaxLength(100)
  carrier!: string;

  @IsString()
  @MaxLength(100)
  service!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsInt()
  @Min(0)
  days!: number;
}

export class PaymentDto {
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsInt()
  @IsOptional()
  @Min(1)
  installments?: number;

  /** Token gerado pelo MP.js no browser — nunca dados brutos do cartão (RN008) */
  @IsString()
  @IsOptional()
  cardToken?: string;

  /** ID do método de pagamento identificado pelo MP.js (ex: visa, master, elo) */
  @IsString()
  @IsOptional()
  paymentMethodId?: string;
}

export class CreateCheckoutDto {
  @ValidateNested()
  @Type(() => CustomerDto)
  customer!: CustomerDto;

  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;

  @ValidateNested()
  @Type(() => ShippingDto)
  shipping!: ShippingDto;

  @ValidateNested()
  @Type(() => PaymentDto)
  payment!: PaymentDto;

  @IsString()
  @IsOptional()
  couponCode?: string;

  @IsString()
  @IsOptional()
  sessionId?: string;
}
