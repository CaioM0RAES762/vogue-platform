import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min, validateSync } from 'class-validator';

enum NodeEnvironment {
  Development = 'development',
  Staging = 'staging',
  Production = 'production',
}

class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  @IsOptional()
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  @IsNumber()
  @Min(1)
  @IsOptional()
  APP_PORT: number = 3001;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  @IsOptional()
  REDIS_URL: string = 'redis://localhost:6379';

  @IsString()
  JWT_SECRET!: string;

  @IsString()
  REFRESH_TOKEN_SECRET!: string;

  @IsString()
  COOKIE_SECRET!: string;

  @IsString()
  @IsOptional()
  RESEND_API_KEY: string = '';

  @IsString()
  @IsOptional()
  FRONTEND_URL: string = 'http://localhost:3000';

  @IsString()
  @IsOptional()
  CLOUDINARY_CLOUD_NAME: string = '';

  @IsString()
  @IsOptional()
  CLOUDINARY_API_KEY: string = '';

  @IsString()
  @IsOptional()
  CLOUDINARY_API_SECRET: string = '';

  @IsString()
  @IsOptional()
  MELHOR_ENVIO_TOKEN: string = '';

  @IsString()
  @IsOptional()
  STORE_CEP: string = '01310100';

  @IsString()
  @IsOptional()
  FALLBACK_SHIPPING_PRICE: string = '15.00';

  @IsString()
  @IsOptional()
  MERCADOPAGO_ACCESS_TOKEN: string = '';

  @IsString()
  @IsOptional()
  MERCADOPAGO_PUBLIC_KEY: string = '';

  @IsString()
  @IsOptional()
  MERCADOPAGO_WEBHOOK_SECRET: string = '';
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const messages = errors.map((e) => Object.values(e.constraints ?? {}).join(', ')).join('\n');
    throw new Error(`Variáveis de ambiente inválidas:\n${messages}`);
  }

  return validated;
}
