import { Controller, Get, Param } from '@nestjs/common';
import { CheckoutService } from '../checkout/checkout.service';

@Controller('cep')
export class CepController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Get(':zipCode')
  lookup(@Param('zipCode') zipCode: string) {
    return this.checkoutService.lookupCep(zipCode);
  }
}
