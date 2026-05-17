import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { ProductFilterDto, ProductSortOption } from './dto/product-filter.dto';
import { CreateProductDto, ProductStatus } from './dto/create-product.dto';
import { ProductSize } from './dto/create-variant.dto';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockProduct = {
  id: 'prod-uuid-1',
  name: 'Vestido Floral',
  slug: 'vestido-floral',
  categoryId: 'cat-uuid-1',
  price: { toFixed: () => '189.90', toString: () => '189.90' } as unknown as number,
  promotionalPrice: null,
  isOnSale: false,
  isFeatured: false,
  status: 'ACTIVE',
  sku: 'JM-VESTU-001',
  createdAt: new Date(),
  images: [{ url: 'http://img.url', thumbnailUrl: 'http://thumb.url', altText: 'Vestido' }],
  variants: [
    { size: 'M', colorName: 'Preto', colorHex: '#000000', stock: 5, isActive: true },
  ],
  category: { name: 'Vestidos', slug: 'vestidos' },
};

const makePrisma = () => ({
  product: {
    findMany: jest.fn().mockResolvedValue([mockProduct]),
    findFirst: jest.fn().mockResolvedValue({ ...mockProduct, description: 'Desc' }),
    findUnique: jest.fn().mockResolvedValue({ ...mockProduct, description: 'Desc' }),
    create: jest.fn().mockResolvedValue(mockProduct),
    update: jest.fn().mockResolvedValue(mockProduct),
    delete: jest.fn().mockResolvedValue(mockProduct),
    count: jest.fn().mockResolvedValue(1),
  },
  category: {
    findUnique: jest.fn().mockResolvedValue({ id: 'cat-uuid-1', slug: 'vestidos' }),
    findMany: jest.fn().mockResolvedValue([]),
  },
  productImage: {
    create: jest.fn().mockResolvedValue({ id: 'img-1', isPrimary: true }),
    findFirst: jest.fn().mockResolvedValue({ id: 'img-1', cloudinaryId: 'public-id' }),
    findMany: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue({}),
    count: jest.fn().mockResolvedValue(0),
    update: jest.fn().mockResolvedValue({}),
  },
  productVariant: {
    deleteMany: jest.fn().mockResolvedValue({}),
    createMany: jest.fn().mockResolvedValue({}),
  },
});

const makeRedis = () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  delPattern: jest.fn().mockResolvedValue(undefined),
});

const makeCloudinary = () => ({
  uploadBuffer: jest.fn().mockResolvedValue({
    publicId: 'products/test',
    url: 'https://cloudinary.com/test.jpg',
    thumbnailUrl: 'https://cloudinary.com/thumb.jpg',
  }),
  deleteImage: jest.fn().mockResolvedValue(undefined),
});

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: ReturnType<typeof makePrisma>;
  let redis: ReturnType<typeof makeRedis>;
  let cloudinary: ReturnType<typeof makeCloudinary>;

  beforeEach(async () => {
    prisma = makePrisma();
    redis = makeRedis();
    cloudinary = makeCloudinary();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: CloudinaryService, useValue: cloudinary },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  // ─── findAll ─────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('retorna produtos do cache quando disponível', async () => {
      const cached = { data: [{ id: 'cached' }], nextCursor: null };
      redis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.findAll({});
      expect(result).toEqual(cached);
      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });

    it('busca no banco quando cache vazio e armazena no Redis', async () => {
      const dto: ProductFilterDto = { limit: 20 };
      const result = await service.findAll(dto);

      expect(prisma.product.findMany).toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('products:catalog:'),
        expect.any(String),
        120,
      );
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('nextCursor');
    });

    it('aplica filtro de categoria', async () => {
      await service.findAll({ category: 'vestidos' });
      const [call] = prisma.product.findMany.mock.calls;
      expect(call[0].where).toMatchObject({ category: { slug: 'vestidos' } });
    });

    it('aplica filtro on_sale', async () => {
      await service.findAll({ on_sale: true });
      const [call] = prisma.product.findMany.mock.calls;
      expect(call[0].where).toMatchObject({ isOnSale: true });
    });

    it('aplica filtro is_new (últimos 30 dias)', async () => {
      await service.findAll({ is_new: true });
      const [call] = prisma.product.findMany.mock.calls;
      expect(call[0].where.createdAt).toBeDefined();
      expect(call[0].where.createdAt.gte).toBeInstanceOf(Date);
    });

    it('aplica filtro de faixa de preço', async () => {
      await service.findAll({ min_price: 50, max_price: 200 });
      const [call] = prisma.product.findMany.mock.calls;
      expect(call[0].where.price).toMatchObject({ gte: 50, lte: 200 });
    });

    it('aplica busca por texto (q)', async () => {
      await service.findAll({ q: 'vestido' });
      const [call] = prisma.product.findMany.mock.calls;
      expect(call[0].where.OR).toBeDefined();
    });

    it('aplica filtro in_stock', async () => {
      await service.findAll({ in_stock: true });
      const [call] = prisma.product.findMany.mock.calls;
      expect(call[0].where.variants).toMatchObject({ some: { isActive: true, stock: { gt: 0 } } });
    });

    it('aplica cursor-based pagination', async () => {
      await service.findAll({ cursor: 'cursor-uuid', limit: 5 });
      const [call] = prisma.product.findMany.mock.calls;
      expect(call[0].skip).toBe(1);
      expect(call[0].cursor).toEqual({ id: 'cursor-uuid' });
      expect(call[0].take).toBe(6);
    });

    it('nextCursor é null quando há menos itens que o limit', async () => {
      const result = await service.findAll({ limit: 20 });
      // mockProduct retorna 1 item, menos que limit=20
      expect(result.nextCursor).toBeNull();
    });

    it('nextCursor aponta para o último item quando há mais itens que o limit', async () => {
      const items = Array.from({ length: 21 }, (_, i) => ({ ...mockProduct, id: `prod-${i}` }));
      prisma.product.findMany.mockResolvedValue(items);

      const result = await service.findAll({ limit: 20 });
      expect(result.nextCursor).toBe('prod-19');
      expect(result.data).toHaveLength(20);
    });

    it('ordena por preço ascendente', async () => {
      await service.findAll({ sort: ProductSortOption.PRICE_ASC });
      const [call] = prisma.product.findMany.mock.calls;
      expect(call[0].orderBy).toContainEqual({ price: 'asc' });
    });

    it('ordena por mais recentes', async () => {
      await service.findAll({ sort: ProductSortOption.NEWEST });
      const [call] = prisma.product.findMany.mock.calls;
      expect(call[0].orderBy).toContainEqual({ createdAt: 'desc' });
    });

    it('limita take a 50 mesmo se limit > 50', async () => {
      await service.findAll({ limit: 100 });
      const [call] = prisma.product.findMany.mock.calls;
      expect(call[0].take).toBe(51); // limit=50 + 1 de lookahead
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('retorna produto do cache quando disponível', async () => {
      const cached = { id: 'cached', name: 'Cached Product' };
      redis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.findOne('vestido-floral');
      expect(result).toEqual(cached);
      expect(prisma.product.findFirst).not.toHaveBeenCalled();
    });

    it('lança NotFoundException para produto inexistente', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      await expect(service.findOne('nao-existe')).rejects.toThrow(NotFoundException);
    });

    it('retorna produto com variantes e relacionados', async () => {
      const productWithRelations = {
        ...mockProduct,
        description: 'Descrição',
        composition: null,
        sku: 'JM-001',
        brand: null,
        collection: null,
        gender: null,
        weight: null, width: null, height: null, depth: null,
        status: 'ACTIVE',
        tags: [],
        updatedAt: new Date(),
        seoTitle: null, seoDescription: null,
        images: [],
        variants: [{ id: 'v1', size: 'M', colorName: 'Preto', colorHex: '#000', stock: 5, reservedStock: 0, minStock: 5, priceOverride: null, isActive: true, createdAt: new Date(), updatedAt: new Date(), productId: 'prod-uuid-1', sku: 'JM-001-M' }],
        category: { id: 'cat-1', name: 'Vestidos', slug: 'vestidos' },
      };
      prisma.product.findFirst.mockResolvedValue(productWithRelations);
      prisma.product.findMany.mockResolvedValue([]);

      const result = await service.findOne('vestido-floral');
      expect(result).toHaveProperty('id', 'prod-uuid-1');
      expect(result).toHaveProperty('related');
      expect(redis.set).toHaveBeenCalledWith('product:vestido-floral', expect.any(String), 600);
    });
  });

  // ─── create ──────────────────────────────────────────────────────────────

  describe('create', () => {
    const validDto: CreateProductDto = {
      name: 'Blusa Ciganinha',
      description: 'Blusa feminina',
      categoryId: 'cat-uuid-1',
      price: 89.9,
      variants: [{ size: ProductSize.M, colorName: 'Branco', stock: 10 }],
    };

    it('cria produto com variantes', async () => {
      const result = await service.create(validDto);
      expect(prisma.product.create).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
    });

    it('lança BadRequestException quando categoria não existe', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      await expect(service.create(validDto)).rejects.toThrow(BadRequestException);
    });

    it('lança BadRequestException quando nenhuma variante é fornecida', async () => {
      await expect(service.create({ ...validDto, variants: [] })).rejects.toThrow(BadRequestException);
    });

    it('invalida cache após criação', async () => {
      await service.create(validDto);
      expect(redis.delPattern).toHaveBeenCalledWith('products:catalog:*');
      expect(redis.del).toHaveBeenCalledWith('categories:active');
    });
  });

  // ─── updateStatus ─────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('atualiza status do produto', async () => {
      await service.updateStatus('prod-uuid-1', 'INACTIVE');
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-uuid-1' },
        data: { status: 'INACTIVE' },
      });
    });

    it('invalida cache ao mudar status', async () => {
      await service.updateStatus('prod-uuid-1', 'ACTIVE');
      expect(redis.delPattern).toHaveBeenCalledWith('products:catalog:*');
      expect(redis.del).toHaveBeenCalledWith(`product:prod-uuid-1`);
    });
  });

  // ─── remove ──────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('exclui produto e imagens do Cloudinary', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'prod-uuid-1',
        images: [{ cloudinaryId: 'prod/img1' }],
      });

      await service.remove('prod-uuid-1');
      expect(cloudinary.deleteImage).toHaveBeenCalledWith('prod/img1');
      expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: 'prod-uuid-1' } });
    });

    it('lança NotFoundException para produto inexistente', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.remove('nao-existe')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── uploadImage ──────────────────────────────────────────────────────────

  describe('uploadImage', () => {
    const mockFile = {
      buffer: Buffer.from('fake-image'),
      mimetype: 'image/jpeg',
      originalname: 'test.jpg',
    } as Express.Multer.File;

    it('faz upload para Cloudinary e salva URL no banco', async () => {
      await service.uploadImage('prod-uuid-1', mockFile, 'Vestido lindo');

      expect(cloudinary.uploadBuffer).toHaveBeenCalledWith(mockFile.buffer);
      expect(prisma.productImage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cloudinaryId: 'products/test',
            url: 'https://cloudinary.com/test.jpg',
            thumbnailUrl: 'https://cloudinary.com/thumb.jpg',
            altText: 'Vestido lindo',
            isPrimary: true, // primeira imagem é primária
          }),
        }),
      );
    });

    it('invalida cache do produto após upload', async () => {
      await service.uploadImage('prod-uuid-1', mockFile);
      expect(redis.del).toHaveBeenCalledWith('product:prod-uuid-1');
    });

    it('segunda imagem não é marcada como primária', async () => {
      prisma.productImage.count.mockResolvedValue(2); // já existe 2 imagens
      await service.uploadImage('prod-uuid-1', mockFile);
      expect(prisma.productImage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isPrimary: false }),
        }),
      );
    });
  });

  // ─── getCategories ────────────────────────────────────────────────────────

  describe('getCategories', () => {
    it('retorna categorias do cache', async () => {
      const cached = [{ id: 'cat-1', name: 'Vestidos' }];
      redis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getCategories();
      expect(result).toEqual(cached);
      expect(prisma.category.findMany).not.toHaveBeenCalled();
    });

    it('busca do banco e armazena em cache por 1h', async () => {
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-1', name: 'Vestidos', slug: 'vestidos', description: null, imageUrl: null, _count: { products: 5 } },
      ]);

      await service.getCategories();
      expect(redis.set).toHaveBeenCalledWith('categories:active', expect.any(String), 3600);
    });
  });
});
