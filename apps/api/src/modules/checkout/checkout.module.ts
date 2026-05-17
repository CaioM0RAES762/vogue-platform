import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { CheckoutService } from './checkout.service';
import { CheckoutController } from './checkout.controller';
import { CepController } from '../cep/cep.controller';

@Module({
  imports: [PrismaModule, AuthModule, CartModule],
  providers: [CheckoutService],
  controllers: [CheckoutController, CepController],
  exports: [CheckoutService],
})
export class CheckoutModule {}
