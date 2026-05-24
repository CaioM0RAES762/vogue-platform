import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, Role } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { AuditLogService } from './audit-log.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminProductsService } from './admin-products.service';
import { AdminInventoryService } from './admin-inventory.service';
import { AdminOrdersService } from './admin-orders.service';
import { AdminCouponsService } from './admin-coupons.service';
import { AdminProductFilterDto, BulkProductActionDto } from './dto/admin-product-filter.dto';
import { AdminOrderFilterDto, UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateInventoryDto, CreateInventoryMovementDto } from './dto/inventory.dto';
import { CreateCouponDto, PatchCouponStatusDto, UpdateCouponDto } from './dto/coupon.dto';
import { CreateProductDto } from '../products/dto/create-product.dto';
import { UpdateProductDto } from '../products/dto/update-product.dto';
import { ProductStatus } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly audit: AuditLogService,
    private readonly dashboardSvc: AdminDashboardService,
    private readonly productsSvc: AdminProductsService,
    private readonly inventorySvc: AdminInventoryService,
    private readonly ordersSvc: AdminOrdersService,
    private readonly couponsSvc: AdminCouponsService,
  ) {}

  private auditCtx(req: Request, user: AuthUser) {
    return {
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  // ─── Dashboard ──────────────────────────────────────────────
  @Get('dashboard')
  dashboard() {
    return this.dashboardSvc.getDashboard();
  }

  // ─── Products ───────────────────────────────────────────────
  @Get('products')
  listProducts(@Query() filter: AdminProductFilterDto) {
    return this.productsSvc.findAll(filter);
  }

  @Get('products/:id')
  getProduct(@Param('id') id: string) {
    return this.productsSvc.findOne(id);
  }

  @Post('products')
  async createProduct(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const product = await this.productsSvc.create(dto, user.id);
    await this.audit.log(this.auditCtx(req, user), 'CREATE', 'product', product.id, undefined, { name: product.name });
    return product;
  }

  @Put('products/:id')
  async updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const before = await this.productsSvc.findOne(id);
    const updated = await this.productsSvc.update(id, dto);
    await this.audit.log(this.auditCtx(req, user), 'UPDATE', 'product', id, { name: before.name }, { name: updated.name });
    return updated;
  }

  @Delete('products/:id')
  async deleteProduct(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const before = await this.productsSvc.findOne(id);
    const result = await this.productsSvc.remove(id);
    await this.audit.log(this.auditCtx(req, user), 'DELETE', 'product', id, { name: before.name }, null);
    return result;
  }

  @Patch('products/:id/status')
  async patchProductStatus(
    @Param('id') id: string,
    @Body('status') status: ProductStatus,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const result = await this.productsSvc.updateStatus(id, status);
    await this.audit.log(this.auditCtx(req, user), 'PATCH_STATUS', 'product', id, null, { status });
    return result;
  }

  @Post('products/:id/images')
  @UseInterceptors(FilesInterceptor('images', 10))
  async uploadProductImages(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const result = await this.productsSvc.uploadImages(id, files);
    await this.audit.log(this.auditCtx(req, user), 'UPLOAD_IMAGES', 'product', id, null, { count: result.length });
    return result;
  }

  @Post('products/bulk')
  async bulkProducts(
    @Body() dto: BulkProductActionDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const result = await this.productsSvc.bulkAction(dto);
    await this.audit.log(this.auditCtx(req, user), 'BULK_ACTION', 'product', undefined, undefined, dto);
    return result;
  }

  // ─── Inventory ──────────────────────────────────────────────
  @Get('inventory')
  listInventory() {
    return this.inventorySvc.findAll();
  }

  @Put('inventory/:variantId')
  async updateInventory(
    @Param('variantId') variantId: string,
    @Body() dto: UpdateInventoryDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const result = await this.inventorySvc.updateVariant(variantId, dto, user.id);
    await this.audit.log(this.auditCtx(req, user), 'UPDATE_STOCK', 'variant', variantId, undefined, dto);
    return result;
  }

  @Post('inventory/movements')
  async createMovement(
    @Body() dto: CreateInventoryMovementDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const result = await this.inventorySvc.createMovement(dto, user.id);
    await this.audit.log(this.auditCtx(req, user), 'INVENTORY_MOVEMENT', 'variant', dto.variantId, undefined, dto);
    return result;
  }

  @Get('inventory/:variantId/movements')
  getMovements(@Param('variantId') variantId: string) {
    return this.inventorySvc.getMovements(variantId);
  }

  // ─── Orders ─────────────────────────────────────────────────
  @Get('orders')
  listOrders(@Query() filter: AdminOrderFilterDto) {
    return this.ordersSvc.findAll(filter);
  }

  @Get('orders/:id')
  getOrder(@Param('id') id: string) {
    return this.ordersSvc.findOne(id);
  }

  @Put('orders/:id/status')
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const order = await this.ordersSvc.findOne(id);
    const result = await this.ordersSvc.updateStatus(id, dto, user.id);
    await this.audit.log(
      this.auditCtx(req, user),
      'UPDATE_ORDER_STATUS',
      'order',
      id,
      { status: order.status },
      { status: dto.status, trackingCode: dto.trackingCode },
    );
    return result;
  }

  // ─── Coupons ─────────────────────────────────────────────────
  @Get('coupons')
  listCoupons() {
    return this.couponsSvc.findAll();
  }

  @Get('coupons/:id')
  getCoupon(@Param('id') id: string) {
    return this.couponsSvc.findOne(id);
  }

  @Post('coupons')
  async createCoupon(
    @Body() dto: CreateCouponDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const coupon = await this.couponsSvc.create(dto);
    await this.audit.log(this.auditCtx(req, user), 'CREATE', 'coupon', coupon.id, null, { code: coupon.code });
    return coupon;
  }

  @Put('coupons/:id')
  async updateCoupon(
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const coupon = await this.couponsSvc.update(id, dto);
    await this.audit.log(this.auditCtx(req, user), 'UPDATE', 'coupon', id, undefined, dto);
    return coupon;
  }

  @Delete('coupons/:id')
  async deleteCoupon(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const result = await this.couponsSvc.remove(id);
    await this.audit.log(this.auditCtx(req, user), 'DELETE', 'coupon', id, undefined, undefined);
    return result;
  }

  @Patch('coupons/:id/status')
  async patchCouponStatus(
    @Param('id') id: string,
    @Body() dto: PatchCouponStatusDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const result = await this.couponsSvc.patchStatus(id, dto);
    await this.audit.log(this.auditCtx(req, user), 'PATCH_STATUS', 'coupon', id, undefined, dto);
    return result;
  }
}
