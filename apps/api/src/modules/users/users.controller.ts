import {
  Controller,
  Get,
  Put,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { OrderFilterDto } from './dto/order-filter.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';

interface JwtUser {
  sub: string;
  email: string;
  role: string;
}

@UseGuards(JwtAuthGuard)
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── Perfil ─────────────────────────────────────────────────────────────

  @Get('users/me')
  getMe(@CurrentUser() user: JwtUser) {
    return this.usersService.getMe(user.sub);
  }

  @Put('users/me')
  updateMe(@CurrentUser() user: JwtUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateMe(user.sub, dto);
  }

  @Delete('users/me')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMe(@CurrentUser() user: JwtUser) {
    return this.usersService.deleteMe(user.sub);
  }

  // ─── Endereços ───────────────────────────────────────────────────────────

  @Get('users/me/addresses')
  getAddresses(@CurrentUser() user: JwtUser) {
    return this.usersService.getAddresses(user.sub);
  }

  @Post('users/me/addresses')
  @HttpCode(HttpStatus.CREATED)
  createAddress(@CurrentUser() user: JwtUser, @Body() dto: CreateAddressDto) {
    return this.usersService.createAddress(user.sub, dto);
  }

  @Put('users/me/addresses/:id')
  updateAddress(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.usersService.updateAddress(user.sub, id, dto);
  }

  @Delete('users/me/addresses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAddress(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.usersService.deleteAddress(user.sub, id);
  }

  @Patch('users/me/addresses/:id/default')
  setDefaultAddress(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.usersService.setDefaultAddress(user.sub, id);
  }

  // ─── Pedidos (listagem pertencente ao usuário) ───────────────────────────

  @Get('users/me/orders')
  getOrders(@CurrentUser() user: JwtUser, @Query() filter: OrderFilterDto) {
    return this.usersService.getOrders(user.sub, filter);
  }

  // ─── Pedido individual (orders/:id) ─────────────────────────────────────

  @Get('orders/:id')
  getOrderById(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.usersService.getOrderById(user.sub, id);
  }

  @Post('orders/:id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelOrder(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.usersService.cancelOrder(user.sub, id, dto);
  }
}
