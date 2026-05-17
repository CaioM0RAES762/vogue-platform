import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

import { CartService } from './cart.service';
import { AddItemDto } from './dto/add-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ApplyCouponDto } from './dto/apply-coupon.dto';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';

const SESSION_COOKIE = 'session_id';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

function resolveSession(
  req: Request,
  res: Response,
): { userId?: string; sessionId?: string } {
  const user = (req as Request & { user?: AuthUser }).user;
  if (user?.id) return { userId: user.id };

  let sessionId = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!sessionId) {
    sessionId = randomUUID();
    res.cookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE,
    });
  }
  return { sessionId };
}

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @UseGuards(OptionalJwtGuard)
  async getCart(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { userId, sessionId } = resolveSession(req, res);
    return this.cartService.getCart(userId, sessionId);
  }

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OptionalJwtGuard)
  async addItem(
    @Body() dto: AddItemDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { userId, sessionId } = resolveSession(req, res);
    return this.cartService.addItem(userId, sessionId, dto);
  }

  @Put('items/:id')
  @UseGuards(OptionalJwtGuard)
  async updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateItemDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { userId, sessionId } = resolveSession(req, res);
    return this.cartService.updateItem(id, dto, userId, sessionId);
  }

  @Delete('items/:id')
  @UseGuards(OptionalJwtGuard)
  async removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { userId, sessionId } = resolveSession(req, res);
    return this.cartService.removeItem(id, userId, sessionId);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtGuard)
  async clearCart(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { userId, sessionId } = resolveSession(req, res);
    return this.cartService.clearCart(userId, sessionId);
  }

  @Post('coupon')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async applyCoupon(
    @Body() dto: ApplyCouponDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.cartService.applyCoupon(dto, user.id);
  }

  @Delete('coupon')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtGuard)
  async removeCoupon(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { userId, sessionId } = resolveSession(req, res);
    return this.cartService.removeCoupon(userId, sessionId);
  }
}
