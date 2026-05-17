import { IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(1)
  token!: string;

  @IsString()
  @MinLength(8, { message: 'Senha deve ter no mínimo 8 caracteres' })
  @Matches(/^(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Senha deve conter ao menos 1 letra maiúscula e 1 número',
  })
  password!: string;
}
