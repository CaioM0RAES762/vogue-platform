import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { IsCpf } from '../validators/is-cpf.validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  name!: string;

  @IsEmail({}, { message: 'E-mail inválido' })
  email!: string;

  @IsString()
  @IsCpf()
  cpf!: string;

  @IsString()
  @IsNotEmpty({ message: 'Telefone é obrigatório' })
  @Matches(/^(\+55)?[\s-]?\(?[1-9]{2}\)?[\s-]?9[\s-]?\d{4}[\s-]?\d{4}$/, {
    message: 'Telefone inválido (formato: DDD + 9 dígitos)',
  })
  phone!: string;

  @IsString()
  @MinLength(8, { message: 'Senha deve ter no mínimo 8 caracteres' })
  @Matches(/^(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Senha deve conter ao menos 1 letra maiúscula e 1 número',
  })
  password!: string;

  @IsBoolean({ message: 'Aceite dos termos é obrigatório' })
  acceptTerms!: boolean;
}
