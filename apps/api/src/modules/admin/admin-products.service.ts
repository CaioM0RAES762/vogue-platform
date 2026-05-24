import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { AdminProductFilterDto, BulkProductActionDto } from './dto/admin-product-filter.dto';
import { CreateProductDto } from '../products/dto/create-product.dto';
import { UpdateProductDto } from '../products/dto/update-product.dto';

function generateSku(categoryName: string): string {
  const prefix = (categoryName ?? 'JM').toUpperCase().slice(0, 4).replace(/\s/g, '');
  return `${prefix}-${Date.now()}`;
}

@Injectable()
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async findAll(filter: AdminProductFilterDto) {
    const { q, categoryId, status, lowStock, onSale, page = 1, limit = 20 } = filter;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;
    if (onSale) where.isOnSale = true;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { name: true } },
          images: { where: { isPrimary: true }, take: 1, orderBy: { sortOrder: 'asc' } },
          variants: { select: { stock: true, minStock: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const mapped = products
      .map((p) => ({
        ...p,
        totalStock: p.variants.reduce((s, v) => s + v.stock, 0),
        isLowStock: p.variants.some((v) => v.stock <= v.minStock),
        primaryImage: p.images[0]?.url ?? null,
      }))
      .filter((p) => !lowStock || p.isLowStock);

    return {
      data: mapped,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        images: { orderBy: { sortOrder: 'asc' } },
        variants: { orderBy: [{ size: 'asc' }, { colorName: 'asc' }] },
      },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');
    return product;
  }

  async create(dto: CreateProductDto, adminId: string) {
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new NotFoundException('Categoria não encontrada');

    if (!dto.variants || dto.variants.length === 0) {
      throw new BadRequestException('Adicione ao menos uma variante');
    }

    const sku = dto.sku ?? generateSku(category.name);

    const slug = dto.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim() + `-${Date.now()}`;

    return this.prisma.product.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        categoryId: dto.categoryId,
        price: dto.price,
        promotionalPrice: dto.promotionalPrice ?? null,
        status: dto.status ?? ProductStatus.DRAFT,
        isFeatured: dto.isFeatured ?? false,
        isOnSale: dto.isOnSale ?? false,
        sku,
        brand: dto.brand ?? null,
        collection: dto.collection ?? null,
        gender: dto.gender ?? null,
        composition: dto.composition ?? null,
        weight: dto.weight ?? null,
        width: dto.width ?? null,
        height: dto.height ?? null,
        depth: dto.depth ?? null,
        seoTitle: dto.seoTitle ?? null,
        seoDescription: dto.seoDescription ?? null,
        tags: dto.tags ?? [],
        variants: {
          create: dto.variants.map((v) => ({
            sku: v.sku ?? `${sku}-${v.size}-${v.colorName?.replace(/\s/g, '').toUpperCase()}`,
            size: v.size,
            colorName: v.colorName,
            colorHex: v.colorHex ?? '#000000',
            stock: v.stock,
            minStock: v.minStock ?? 5,
            priceOverride: v.priceOverride ?? null,
          })),
        },
        images: dto.imageIds?.length
          ? {
              connect: dto.imageIds.map((imgId) => ({ id: imgId })),
            }
          : undefined,
      },
      include: { variants: true, images: true },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);

    const { variants, imageIds, ...rest } = dto as UpdateProductDto & { imageIds?: string[] };

    return this.prisma.product.update({
      where: { id },
      data: {
        ...rest,
        ...(imageIds
          ? { images: { set: imageIds.map((imgId) => ({ id: imgId })) } }
          : {}),
      },
      include: { variants: true, images: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });
    return { message: 'Produto removido com sucesso' };
  }

  async updateStatus(id: string, status: ProductStatus) {
    await this.findOne(id);
    await this.prisma.product.update({ where: { id }, data: { status } });
    return { message: 'Status atualizado com sucesso' };
  }

  async uploadImages(id: string, files: Express.Multer.File[]) {
    await this.findOne(id);

    if (!files.length) throw new BadRequestException('Nenhum arquivo enviado');

    for (const file of files) {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowed.includes(file.mimetype)) {
        throw new BadRequestException('Formato inválido. Use JPEG, PNG ou WebP.');
      }
    }

    const existing = await this.prisma.productImage.count({ where: { productId: id } });

    const uploaded = await Promise.all(
      files.map((file, idx) =>
        this.cloudinary.uploadBuffer(file.buffer, `products/${id}`).then((result) =>
          this.prisma.productImage.create({
            data: {
              productId: id,
              url: result.url,
              thumbnailUrl: result.thumbnailUrl,
              cloudinaryId: result.publicId,
              isPrimary: existing === 0 && idx === 0,
              sortOrder: existing + idx,
            },
          }),
        ),
      ),
    );

    return uploaded;
  }

  async bulkAction(dto: BulkProductActionDto) {
    const { ids, action } = dto;
    if (!ids.length) throw new BadRequestException('Selecione ao menos um produto');

    if (action === 'delete') {
      await this.prisma.product.deleteMany({ where: { id: { in: ids } } });
      return { affected: ids.length, action };
    }

    const status = action === 'activate' ? ProductStatus.ACTIVE : ProductStatus.INACTIVE;
    await this.prisma.product.updateMany({ where: { id: { in: ids } }, data: { status } });
    return { affected: ids.length, action };
  }
}
