import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class ProcessPaymentDto {
  @IsString()
  orderId!: string;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsString()
  payerEmail!: string;

  @IsString()
  payerName!: string;

  @IsString()
  payerCpf!: string;

  /** Token gerado pelo MP.js no frontend — apenas para cartão (RN008) */
  @IsString()
  @IsOptional()
  cardToken?: string;

  /** ID do método de pagamento identificado pelo MP.js (visa, master, elo...) */
  @IsString()
  @IsOptional()
  paymentMethodId?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  installments?: number;
}
