import { IsString, IsOptional, MaxLength, Matches, IsBoolean } from 'class-validator';

export class CreateAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  label?: string;

  @IsString()
  @MaxLength(255)
  recipientName!: string;

  @IsString()
  @Matches(/^\d{5}-?\d{3}$/, { message: 'CEP inválido' })
  zipCode!: string;

  @IsString()
  @MaxLength(255)
  street!: string;

  @IsString()
  @MaxLength(20)
  number!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  complement?: string;

  @IsString()
  @MaxLength(100)
  neighborhood!: string;

  @IsString()
  @MaxLength(100)
  city!: string;

  @IsString()
  @MaxLength(2)
  state!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
