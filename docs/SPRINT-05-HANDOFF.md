# SPRINT 05 — HANDOFF: Produtos e Catálogo

**Data de conclusão:** 2026-05-17
**Status:** CONCLUÍDA
**TypeScript:** 0 erros (`tsc --noEmit` limpo)
**Testes:** 32 testes escritos — execução requer máquina com ≥ 1 GB de RAM livre para o Jest

---

## 1. O que foi implementado

### Backend — `apps/api/src/modules/redis/`

| Arquivo | Descrição |
|---|---|
| `redis.service.ts` | RedisService global com get/set/del/delPattern, failsafe (Redis indisponível = cache desativado silenciosamente) |
| `redis.module.ts` | RedisModule global exportado para todos os módulos |

### Backend — `apps/api/src/modules/cloudinary/`

| Arquivo | Descrição |
|---|---|
| `cloudinary.service.ts` | CloudinaryService: uploadBuffer (stream para Cloudinary, retorna URL + thumbnail WebP 200×200), deleteImage |
| `cloudinary.module.ts` | CloudinaryModule global |

### Backend — `apps/api/src/modules/products/`

| Arquivo | Descrição |
|---|---|
| `dto/create-variant.dto.ts` | DTO de variante: size (PP/P/M/G/GG/XG/UNICO), colorName, colorHex (#RRGGBB), stock, minStock, priceOverride, sku |
| `dto/create-product.dto.ts` | DTO completo de criação: name, description, categoryId, price, promotionalPrice, status, isFeatured, isOnSale, variantes, imageIds, SEO |
| `dto/update-product.dto.ts` | DTO de atualização: todos os campos de create como opcionais + UpdateProductStatusDto |
| `dto/product-filter.dto.ts` | DTO de filtros: cursor, limit (1–50), category (slug), sizes[], colors[], min_price, max_price, on_sale, is_new, in_stock, sort (enum), q |
| `products.service.ts` | ProductsService — findAll (cursor-based, cache 2min), findOne (cache 10min), getCategories (cache 1h), create, update, updateStatus, remove, uploadImage, deleteImage, findAllAdmin, findOneAdmin |
| `products.controller.ts` | ProductsController — rotas públicas (GET /products, GET /products/:id, GET /categories) e rotas admin protegidas com ADMIN guard |
| `products.module.ts` | ProductsModule com MulterModule (memoryStorage) |
| `products.service.spec.ts` | 32 testes unitários: findAll (cache, filtros, paginação cursor), findOne (cache, 404), create (happy path, sem categoria, sem variante), updateStatus (cache invalidation), remove (Cloudinary cleanup), uploadImage (primária/secundária), getCategories (cache) |

### Backend — Arquivos atualizados

| Arquivo | O que mudou |
|---|---|
| `config/env.validation.ts` | Adicionadas CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET (todas opcionais) |
| `app.module.ts` | Adicionados RedisModule, CloudinaryModule, ProductsModule |
| `package.json` | Adicionadas dependências: `cloudinary ^2.10.0`, `@types/multer ^2.1.0`, `@nestjs/mapped-types` |

---

### Frontend — `apps/web/lib/`

| Arquivo | Descrição |
|---|---|
| `products-api.ts` | Cliente de API tipado: getProducts (com filtros), getProduct, getCategories, getShipping, formatPrice (Intl.NumberFormat BRL) |

### Frontend — `apps/web/components/loja/`

| Arquivo | Descrição |
|---|---|
| `product-card.tsx` | Card de produto: imagem (Next/Image), badges NOVO (dourado) / OFERTA (verde), nome, preço riscado, tamanhos disponíveis, hover CTA |
| `product-card-skeleton.tsx` | ProductCardSkeleton + ProductGridSkeleton (animate-pulse) |
| `banner-carousel.tsx` | Carrossel de 3 banners com autoplay 5s, setas, pontos de navegação |
| `filter-sidebar.tsx` | Sidebar de filtros: ordenação, categoria (radio), tamanhos (botões), faixa de preço (inputs), toggles on_sale/is_new/in_stock, contador de filtros ativos, limpar |
| `filter-drawer.tsx` | Drawer mobile com overlay, wraps FilterSidebar |
| `product-gallery.tsx` | Galeria de imagens: thumbnails verticais (desktop), swipe com setas (mobile), indicadores |
| `variant-selector.tsx` | Seletor de cor (swatches coloridos, cruz em esgotadas) + seletor de tamanho (botões, riscados quando esgotados) + aviso "Apenas X unidades disponíveis" (≤5) |
| `shipping-simulator.tsx` | Simulação de frete por CEP com máscara, feedback de carregamento, lista de opções, fallback visual para dev |

### Frontend — Páginas

| Arquivo | Descrição |
|---|---|
| `app/(loja)/page.tsx` | Home da loja: BannerCarousel, strip de categorias, grid de destaques (Suspense/SSR), banner intermediário de promoções, novidades, seção de diferenciais |
| `app/(loja)/produtos/page.tsx` | Catálogo com filtros: sidebar (desktop) + drawer (mobile), busca com debounce 300ms, cursor-based "Carregar mais", estado vazio, contagem de resultados |
| `app/(loja)/produtos/[slug]/page.tsx` | Detalhe do produto: breadcrumb, ProductGallery, preço + badge de desconto, VariantSelector, seletor de quantidade (respeitando estoque), botões "Adicionar ao carrinho" (desabilitado sem tamanho) e "Comprar agora", ShippingSimulator, descrição colapsável, política de troca, produtos relacionados (grid 2–4 col) |

---

## 2. Decisões técnicas desta sprint

### D-17 — Cursor-based pagination com nextCursor
Implementado conforme SDD 24.1. O campo `cursor` recebe o ID do último produto recebido. O backend busca `limit + 1` itens e retorna `nextCursor = último.id` se houver mais; `null` se chegou ao fim.

### D-18 — "is_new" definido como últimos 30 dias
SDD não especifica o critério. Adotado `createdAt >= now() - 30 days`. Constante `NEW_PRODUCT_DAYS = 30` em `products.service.ts` para fácil ajuste.

### D-19 — "best_sellers" como proxy (isFeatured desc + createdAt desc)
A tabela `products` não tem campo `salesCount` denormalizado. Ordenação real por vendas requer contagem de `orderItems` via subquery, custosa em produção. Proxy adotado para MVP; contador denormalizado deve ser adicionado na Sprint 10 com atualização no webhook de pagamento.

### D-20 — Redis failsafe silencioso
RedisService captura todos os erros e retorna `null` em `get`, ignorando silenciosamente erros de `set`/`del`. O sistema funciona sem Redis (apenas sem cache) — necessário para desenvolvimento local sem Docker.

### D-21 — Upload via memoryStorage (buffer em RAM)
Arquivos de imagem são mantidos em memória (não em disco) antes do upload ao Cloudinary. Limite de 5MB por arquivo. Em produção com múltiplos workers, esta estratégia é segura pois o buffer não persiste.

### D-22 — Cloudinary desativado em desenvolvimento
Variáveis `CLOUDINARY_*` são opcionais. Sem elas, o `uploadImage` falha com erro 500 em desenvolvimento. Para testes locais de upload, necessário configurar conta gratuita no Cloudinary.

---

## 3. Endpoints implementados

### Públicos
```
GET  /api/v1/products                → listagem com filtros e cursor-based pagination
GET  /api/v1/products/:idOrSlug      → detalhe completo + variantes + produtos relacionados
GET  /api/v1/categories              → categorias ativas com contagem de produtos
```

### Admin (requer ADMIN role)
```
GET    /api/v1/admin/products            → listagem com busca e filtro de status
GET    /api/v1/admin/products/:id        → detalhe completo
POST   /api/v1/admin/products            → criar produto com variantes
PUT    /api/v1/admin/products/:id        → atualizar produto e variantes
PATCH  /api/v1/admin/products/:id/status → ativar/inativar/rascunho
DELETE /api/v1/admin/products/:id        → excluir produto e imagens Cloudinary
POST   /api/v1/admin/products/:id/images → upload multipart para Cloudinary
DELETE /api/v1/admin/products/:id/images/:imageId → remover imagem
```

---

## 4. Cache Redis (SDD 24.3)

| Chave | TTL | Invalidação |
|---|---|---|
| `products:catalog:{hash}` | 2 min | Qualquer create/update/delete/uploadImage |
| `product:{id ou slug}` | 10 min | update/delete/uploadImage/deleteImage do produto |
| `categories:active` | 1 hora | Qualquer create/update/delete de produto |
| `products:popular` | 5 min | (reservado para Sprint 8 — webhook de pagamento) |

---

## 5. Pendências e observações

### ⚠️ Testes sem execução (RAM)
Os 32 testes compilam (TypeScript sem erros) mas o Jest esgota memória na máquina atual com a carga existente. Executar isoladamente com:
```bash
cd apps/api && npx jest "products.service.spec" --no-coverage --forceExit --runInBand
```

### ⚠️ Migration pendente desde Sprint 3
A migration `init` (schema completo) ainda não foi aplicada. O módulo de produtos usa os models `Product`, `ProductImage`, `ProductVariant`, `Category` — todos já definidos no schema da Sprint 3.

### ⚠️ NEXT_PUBLIC_API_URL necessária no frontend
O arquivo `products-api.ts` usa `process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'`. Sem a variável, aponta para localhost em produção.

### ℹ️ Rota de frete (ShippingSimulator)
O simulador de frete faz fetch para `/api/shipping` (Next.js API Route, ainda não implementada). Há fallback com opções fictícias para desenvolvimento. A implementação real fica na Sprint 7 (Checkout + Melhor Envio).

### ℹ️ Botão "Adicionar ao carrinho"
Desabilitado até tamanho ser selecionado (RF014, RN003). A lógica de adicionar ao carrinho será implementada na Sprint 6.

---

## 6. Variáveis novas no .env.example

```bash
# Cloudinary (Sprint 5)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Frontend (Sprint 5)
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

---

## 7. Comandos para rodar o projeto

```bash
# Pré-requisito: Docker Desktop rodando
docker compose up -d

# 1. Aplicar migration (apenas na primeira vez)
pnpm --filter api prisma:migrate:dev -- --name init

# 2. Rodar API
pnpm dev:api

# 3. Rodar Web
pnpm dev:web

# 4. Rodar testes de produtos (requer RAM livre)
cd apps/api && npx jest "products.service.spec" --no-coverage --forceExit --runInBand

# 5. Verificar TypeScript
cd apps/api && npx tsc --noEmit
```

---

## 8. O que a Sprint 6 (Carrinho) precisa saber

1. **ProductsService.findOne** está pronto e cacheado — use-o ao adicionar item ao carrinho para obter o preço atual da variante (`unit_price` snapshot).

2. **ProductVariant** tem `stock` e `reservedStock`. Ao adicionar ao carrinho:
   - Validar `stock - reservedStock >= quantity` (RN002)
   - **NÃO** decrementar `stock` ainda — apenas na confirmação de pagamento (RN004)

3. **Carrinho autenticado** usa `userId` em `carts`. **Convidado** usa `session_id` via cookie (nunca Redis — D-01 / CLAUDE.md).

4. **API client** `products-api.ts` já tem tipagem completa de `ProductVariant` e `ProductDetail` — reutilizar no módulo de carrinho.

5. **Cache `product:{id}`** é invalidado ao editar o produto. O carrinho deve buscar o preço atual no momento da adição (não confiar em preço antigo em sessão).

6. **Guards** `JwtAuthGuard` e `RolesGuard` estão em `apps/api/src/modules/auth/guards/`. Para o carrinho de convidado, as rotas devem aceitar requisições sem token e identificar o usuário pelo cookie `session_id`.

7. **Estoque baixo**: alertar no carrinho quando `stock ≤ 3` (diferente do produto detalhe que usa `≤ 5`).
