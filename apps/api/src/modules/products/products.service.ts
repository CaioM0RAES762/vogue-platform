import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma, Gender, ProductStatus, ProductSize } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductFilterDto, ProductSortOption } from './dto/product-filter.dto';

const TTL = {
  CATALOG: 120,     // 2 min
  POPULAR: 300,     // 5 min
  CATEGORIES: 3600, // 1h
  PRODUCT: 600,     // 10 min
};

const NEW_PRODUCT_DAYS = 30;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function filterHash(dto: object): string {
  return createHash('md5').update(JSON.stringify(dto)).digest('hex').slice(0, 16);
}

function generateSku(categorySlug: string): string {
  return `JM-${categorySlug.toUpperCase().slice(0, 6)}-${Date.now()}`;
}

function buildOrderBy(sort?: ProductSortOption): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case ProductSortOption.PRICE_ASC:
      return [{ price: 'asc' }];
    case ProductSortOption.PRICE_DESC:
      return [{ price: 'desc' }];
    case ProductSortOption.NEWEST:
      return [{ createdAt: 'desc' }];
    case ProductSortOption.BEST_SELLERS:
      // Proxy: isOnSale + recentes. Contador denormalizado pode ser adicionado na Sprint 10.
      return [{ isOnSale: 'desc' }, { createdAt: 'desc' }];
    case ProductSortOption.RELEVANCE:
    default:
      return [{ isFeatured: 'desc' }, { createdAt: 'desc' }];
  }
}

function decimalToNumber(v: Prisma.Decimal | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  return Number(v.toString());
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  // ─── Catálogo Público ──────────────────────────────────────────────────────

  async findAll(dto: ProductFilterDto) {
    const cacheKey = `products:catalog:${filterHash(dto)}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const limit = Math.min(dto.limit ?? 20, 50);
    const take = limit + 1;

    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.ACTIVE,
      ...(dto.category && { category: { slug: dto.category } }),
      ...(dto.on_sale === true && { isOnSale: true }),
      ...(dto.is_new === true && {
        createdAt: { gte: new Date(Date.now() - NEW_PRODUCT_DAYS * 86400_000) },
      }),
      ...(dto.min_price !== undefined || dto.max_price !== undefined
        ? {
            price: {
              ...(dto.min_price !== undefined && { gte: new Prisma.Decimal(dto.min_price) }),
              ...(dto.max_price !== undefined && { lte: new Prisma.Decimal(dto.max_price) }),
            },
          }
        : {}),
      ...(dto.q && {
        OR: [
          { name: { contains: dto.q, mode: 'insensitive' } },
          { tags: { has: dto.q } },
        ],
      }),
      ...(dto.sizes?.length && {
        variants: {
          some: {
            size: { in: dto.sizes as ProductSize[] },
            isActive: true,
            stock: { gt: 0 },
          },
        },
      }),
      ...(dto.colors?.length && {
        variants: {
          some: { colorName: { in: dto.colors }, isActive: true },
        },
      }),
      ...(dto.in_stock === true && {
        variants: { some: { isActive: true, stock: { gt: 0 } } },
      }),
    };

    const orderBy = buildOrderBy(dto.sort);

    const products = await this.prisma.product.findMany({
      take,
      ...(dto.cursor ? { skip: 1, cursor: { id: dto.cursor } } : {}),
      where,
      orderBy,
      include: {
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { url: true, thumbnailUrl: true, altText: true },
        },
        variants: {
          where: { isActive: true },
          select: { size: true, colorName: true, colorHex: true, stock: true },
        },
        category: { select: { name: true, slug: true } },
      },
    });

    const hasNextPage = products.length > limit;
    if (hasNextPage) products.pop();

    const newThreshold = new Date(Date.now() - NEW_PRODUCT_DAYS * 86400_000);

    const data = products.map((p) => {
      const primaryImage = p.images[0];
      const price = decimalToNumber(p.price)!;
      const promoPrice = decimalToNumber(p.promotionalPrice);
      const discountPct = promoPrice ? Math.round((1 - promoPrice / price) * 100) : null;

      const availableSizes = [...new Set(
        p.variants.filter((v) => v.stock > 0).map((v) => v.size as string),
      )];
      const availableColors = [...new Set(
        p.variants.filter((v) => v.stock > 0).map((v) => v.colorName),
      )];

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        price,
        promotionalPrice: promoPrice,
        discountPercentage: discountPct,
        isNew: p.createdAt >= newThreshold,
        isOnSale: p.isOnSale,
        primaryImage: primaryImage?.url ?? null,
        thumbnailImage: primaryImage?.thumbnailUrl ?? null,
        altText: primaryImage?.altText ?? p.name,
        availableSizes,
        availableColors,
        category: p.category,
      };
    });

    const result = {
      data,
      nextCursor: hasNextPage ? products[products.length - 1]?.id ?? null : null,
    };

    await this.redis.set(cacheKey, JSON.stringify(result), TTL.CATALOG);
    return result;
  }

  async findOne(idOrSlug: string) {
    const cacheKey = `product:${idOrSlug}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [
          ...(isUuid ? [{ id: idOrSlug }] : []),
          { slug: idOrSlug },
        ],
        status: ProductStatus.ACTIVE,
      },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        variants: {
          where: { isActive: true },
          orderBy: [{ colorName: 'asc' }],
        },
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!product) throw new NotFoundException('Produto não encontrado');

    const related = await this.prisma.product.findMany({
      where: { categoryId: product.categoryId, status: ProductStatus.ACTIVE, id: { not: product.id } },
      take: 6,
      include: {
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { url: true, thumbnailUrl: true },
        },
        variants: {
          where: { isActive: true },
          select: { size: true, colorName: true, stock: true },
        },
      },
    });

    const result = {
      ...product,
      price: decimalToNumber(product.price)!,
      promotionalPrice: decimalToNumber(product.promotionalPrice),
      variants: product.variants.map((v) => ({
        ...v,
        size: v.size as string,
        priceOverride: decimalToNumber(v.priceOverride),
      })),
      related: related.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        price: decimalToNumber(r.price)!,
        promotionalPrice: decimalToNumber(r.promotionalPrice),
        primaryImage: r.images[0]?.url ?? null,
        availableSizes: [...new Set(r.variants.filter((v) => v.stock > 0).map((v) => v.size as string))],
      })),
    };

    await this.redis.set(cacheKey, JSON.stringify(result), TTL.PRODUCT);
    return result;
  }

  async getCategories() {
    const cacheKey = 'categories:active';
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { products: { where: { status: ProductStatus.ACTIVE } } } },
      },
    });

    const result = categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      imageUrl: c.imageUrl,
      productCount: c._count.products,
    }));

    await this.redis.set(cacheKey, JSON.stringify(result), TTL.CATEGORIES);
    return result;
  }

  // ─── CRUD Admin ────────────────────────────────────────────────────────────

  async create(dto: CreateProductDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
      select: { slug: true },
    });
    if (!category) throw new BadRequestException('Categoria não encontrada');

    if (!dto.variants || dto.variants.length === 0) {
      throw new BadRequestException('Produto deve ter ao menos uma variante');
    }

    const baseSku = dto.sku ?? generateSku(category.slug);
    const slug = await this.uniqueSlug(dto.name);

    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        composition: dto.composition,
        categoryId: dto.categoryId,
        price: dto.price,
        promotionalPrice: dto.promotionalPrice,
        sku: baseSku,
        brand: dto.brand,
        collection: dto.collection,
        gender: dto.gender ? (dto.gender as unknown as Gender) : undefined,
        weight: dto.weight,
        width: dto.width,
        height: dto.height,
        depth: dto.depth,
        status: (dto.status as unknown as ProductStatus) ?? ProductStatus.DRAFT,
        isFeatured: dto.isFeatured ?? false,
        isOnSale: dto.isOnSale ?? false,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
        tags: dto.tags ?? [],
        variants: {
          create: dto.variants.map((v, i) => ({
            size: v.size as unknown as ProductSize,
            colorName: v.colorName,
            colorHex: v.colorHex,
            stock: v.stock,
            reservedStock: 0,
            minStock: v.minStock ?? 5,
            priceOverride: v.priceOverride,
            isActive: v.isActive ?? true,
            sku: v.sku ?? `${baseSku}-${v.size}-${i}`,
          })),
        },
      },
      include: {
        variants: true,
        images: true,
        category: { select: { name: true, slug: true } },
      },
    });

    await this.invalidateCatalogCache();
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.assertExists(id);

    const { variants, imageIds: _imageIds, ...fields } = dto;

    const updateData: Prisma.ProductUpdateInput = {
      ...(fields.name !== undefined && { name: fields.name, slug: await this.uniqueSlug(fields.name, id) }),
      ...(fields.description !== undefined && { description: fields.description }),
      ...(fields.categoryId !== undefined && { category: { connect: { id: fields.categoryId } } }),
      ...(fields.price !== undefined && { price: fields.price }),
      ...(fields.promotionalPrice !== undefined && { promotionalPrice: fields.promotionalPrice }),
      ...(fields.status !== undefined && { status: fields.status as unknown as ProductStatus }),
      ...(fields.isFeatured !== undefined && { isFeatured: fields.isFeatured }),
      ...(fields.isOnSale !== undefined && { isOnSale: fields.isOnSale }),
      ...(fields.brand !== undefined && { brand: fields.brand }),
      ...(fields.collection !== undefined && { collection: fields.collection }),
      ...(fields.gender !== undefined && { gender: fields.gender as unknown as Gender }),
      ...(fields.composition !== undefined && { composition: fields.composition }),
      ...(fields.weight !== undefined && { weight: fields.weight }),
      ...(fields.width !== undefined && { width: fields.width }),
      ...(fields.height !== undefined && { height: fields.height }),
      ...(fields.depth !== undefined && { depth: fields.depth }),
      ...(fields.seoTitle !== undefined && { seoTitle: fields.seoTitle }),
      ...(fields.seoDescription !== undefined && { seoDescription: fields.seoDescription }),
      ...(fields.tags !== undefined && { tags: fields.tags }),
    };

    await this.prisma.product.update({ where: { id }, data: updateData });

    if (variants?.length) {
      const currentProduct = await this.prisma.product.findUnique({
        where: { id },
        select: { sku: true },
      });
      await this.prisma.productVariant.deleteMany({ where: { productId: id } });
      await this.prisma.productVariant.createMany({
        data: variants.map((v, i) => ({
          productId: id,
          size: v.size as unknown as ProductSize,
          colorName: v.colorName,
          colorHex: v.colorHex,
          stock: v.stock,
          reservedStock: 0,
          minStock: v.minStock ?? 5,
          priceOverride: v.priceOverride,
          isActive: v.isActive ?? true,
          sku: v.sku ?? `${currentProduct?.sku ?? 'JM'}-${v.size}-${i}-${Date.now()}`,
        })),
      });
    }

    await this.invalidateCatalogCache();
    await this.redis.del(`product:${id}`);
    return this.findOneAdmin(id);
  }

  async updateStatus(id: string, status: 'ACTIVE' | 'INACTIVE' | 'DRAFT') {
    await this.assertExists(id);
    await this.prisma.product.update({
      where: { id },
      data: { status: status as ProductStatus },
    });
    await this.invalidateCatalogCache();
    await this.redis.del(`product:${id}`);
    return { message: 'Status atualizado com sucesso' };
  }

  async remove(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { images: { select: { cloudinaryId: true } } },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');

    await Promise.allSettled(
      product.images.map((img) => this.cloudinary.deleteImage(img.cloudinaryId)),
    );

    await this.prisma.product.delete({ where: { id } });
    await this.invalidateCatalogCache();
    await this.redis.del(`product:${id}`);
    return { message: 'Produto excluído com sucesso' };
  }

  async uploadImage(productId: string, file: Express.Multer.File, altText?: string) {
    await this.assertExists(productId);

    const existingCount = await this.prisma.productImage.count({ where: { productId } });
    const { publicId, url, thumbnailUrl } = await this.cloudinary.uploadBuffer(file.buffer);

    const image = await this.prisma.productImage.create({
      data: {
        productId,
        cloudinaryId: publicId,
        url,
        thumbnailUrl,
        altText: altText ?? null,
        sortOrder: existingCount,
        isPrimary: existingCount === 0,
      },
    });

    await this.redis.del(`product:${productId}`);
    await this.invalidateCatalogCache();
    return image;
  }

  async deleteImage(productId: string, imageId: string) {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) throw new NotFoundException('Imagem não encontrada');

    await this.cloudinary.deleteImage(image.cloudinaryId);
    await this.prisma.productImage.delete({ where: { id: imageId } });

    if (image.isPrimary) {
      const next = await this.prisma.productImage.findFirst({
        where: { productId },
        orderBy: { sortOrder: 'asc' },
      });
      if (next) {
        await this.prisma.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
      }
    }

    await this.redis.del(`product:${productId}`);
    await this.invalidateCatalogCache();
    return { message: 'Imagem removida' };
  }

  async findAllAdmin(search?: string, status?: string) {
    const where: Prisma.ProductWhereInput = {
      ...(status && { status: status as ProductStatus }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    return this.prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        images: { where: { isPrimary: true }, take: 1, select: { thumbnailUrl: true } },
        variants: { select: { stock: true, isActive: true } },
        category: { select: { name: true } },
        _count: { select: { variants: true } },
      },
    });
  }

  async findOneAdmin(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        variants: { orderBy: [{ colorName: 'asc' }] },
        category: true,
      },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');
    return product;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async uniqueSlug(name: string, excludeId?: string): Promise<string> {
    const base = slugify(name);
    let attempt = 0;
    while (true) {
      const candidate = attempt === 0 ? base : `${base}-${attempt}`;
      const exists = await this.prisma.product.findFirst({
        where: { slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
        select: { id: true },
      });
      if (!exists) return candidate;
      attempt++;
    }
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Produto não encontrado');
  }

  private async invalidateCatalogCache(): Promise<void> {
    await this.redis.delPattern('products:catalog:*');
    await this.redis.del('categories:active');
  }
}
