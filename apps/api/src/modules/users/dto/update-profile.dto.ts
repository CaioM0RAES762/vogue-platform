import { IsString, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\(?[1-9]{2}\)?\s?9?[0-9]{4}-?[0-9]{4}$/, {
    message: 'Telefone inválido',
  })
  phone?: string;
}
