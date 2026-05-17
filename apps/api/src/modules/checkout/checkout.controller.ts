import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CheckoutService } from './checkout.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { ShippingOptionsDto } from './dto/shipping-options.dto';

interface JwtUser {
  id: string;
  email: string;
  role: string;
}

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('shipping-options')
  @UseGuards(OptionalJwtGuard)
  getShippingOptions(@Body() dto: ShippingOptionsDto) {
    return this.checkoutService.getShippingOptions(dto);
  }

  @Post()
  @UseGuards(OptionalJwtGuard)
  createOrder(
    @Body() dto: CreateCheckoutDto,
    @CurrentUser() user: JwtUser | null,
    @Req() req: Request,
  ) {
    // Pega session_id do cookie para guest checkout
    const sessionId =
      dto.sessionId ??
      (req.cookies as Record<string, string | undefined>)['session_id'];

    if (sessionId && !dto.sessionId) {
      dto.sessionId = sessionId;
    }

    return this.checkoutService.createOrder(dto, user?.id);
  }
}
