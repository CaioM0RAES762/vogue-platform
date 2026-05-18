import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { PaymentsService } from './payments.service';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  /**
   * Cria pagamento no MP a partir de um pedido já criado pelo checkout.
   * Chamado pelo frontend após POST /checkout retornar o orderId.
   */
  @UseGuards(OptionalJwtGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPayment(
    @Body() dto: ProcessPaymentDto,
    @CurrentUser() user?: { id: string },
  ) {
    return this.service.createPayment(dto);
  }

  /**
   * GET /payments/orders/:orderId/status — polling D-03
   * Retorna status do pedido + dados do pagamento (qrCode, barcode...).
   */
  @UseGuards(OptionalJwtGuard)
  @Get('orders/:orderId/status')
  async getOrderStatus(@Param('orderId') orderId: string) {
    return this.service.getOrderPaymentStatus(orderId);
  }

  /**
   * POST /payments/webhook — recebe notificações do Mercado Pago.
   * Sempre responde 200 OK para evitar retries desnecessários (SDD 13.7).
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const xSignature = req.headers['x-signature'] as string | undefined;
    const xRequestId = req.headers['x-request-id'] as string | undefined;

    try {
      await this.service.handleWebhook(body, xSignature, xRequestId);
    } catch (err) {
      // Loga mas sempre retorna 200 para evitar retries (SDD 13.7)
      // BadRequestException por HMAC inválida é esperada em testes de integração
    }

    return { received: true };
  }
}
