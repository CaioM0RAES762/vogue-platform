# SPRINT 02 — HANDOFF: Setup do Monorepo

**Data de conclusão:** 2025-05-15
**Status:** CONCLUÍDA

---

## 1. O que foi implementado

### Arquivos raiz do monorepo

| Arquivo | Descrição |
|---|---|
| `package.json` | Root package.json com scripts pnpm workspaces |
| `pnpm-workspace.yaml` | Declara `apps/*` e `packages/*` como workspaces |
| `tsconfig.base.json` | Configuração TypeScript base compartilhada (strict, ES2022) |
| `.eslintrc.js` | ESLint com @typescript-eslint + prettier |
| `.prettierrc` | Prettier: singleQuote, semi, trailingComma, printWidth 100 |
| `.prettierignore` | Exclui dist, .next, node_modules, pnpm-lock.yaml |
| `.gitignore` | Node, Next.js, NestJS, .env, logs, coverage, IDE |
| `.env.example` | Todas as variáveis da Seção 10.4 do SDD + FALLBACK_SHIPPING_PRICE (D-08) |
| `docker-compose.yml` | PostgreSQL 16-alpine + Redis 7-alpine com healthchecks |
| `README.md` | Instruções completas de setup, execução e estrutura |

### apps/api — NestJS

| Arquivo | Descrição |
|---|---|
| `apps/api/package.json` | NestJS 10, Prisma 5, Winston, Helmet, class-validator |
| `apps/api/tsconfig.json` | Extends base, experimentalDecorators, emitDecoratorMetadata |
| `apps/api/nest-cli.json` | Config do Nest CLI |
| `apps/api/src/main.ts` | Bootstrap: Helmet, CORS, prefix api/v1, ValidationPipe global |
| `apps/api/src/app.module.ts` | ConfigModule global, WinstonModule, PrismaModule, AppController |
| `apps/api/src/app.controller.ts` | Endpoint GET /api/v1/health para healthcheck |
| `apps/api/src/config/app.config.ts` | Todas as vars de ambiente tipadas via registerAs |
| `apps/api/src/config/env.validation.ts` | Validação das vars obrigatórias com class-validator |
| `apps/api/src/common/logger/winston.logger.ts` | Logger colorido em dev, JSON em prod, arquivos error.log e combined.log |
| `apps/api/src/modules/prisma/prisma.module.ts` | Module global — exporta PrismaService |
| `apps/api/src/modules/prisma/prisma.service.ts` | Extends PrismaClient, conecta/desconecta no ciclo do módulo |
| `apps/api/prisma/schema.prisma` | Schema mínimo (datasource + generator) — será expandido na Sprint 3 |

### apps/web — Next.js 14

| Arquivo | Descrição |
|---|---|
| `apps/web/package.json` | Next.js 14, React 18, Tailwind, Shadcn deps, Zod |
| `apps/web/tsconfig.json` | App Router, bundler, paths @/* e @shared/* |
| `apps/web/next.config.ts` | remotePatterns Cloudinary |
| `apps/web/tailwind.config.ts` | Tema customizado: brand-black, brand-gold, brand-gray-light, brand-white; fontes Playfair Display + Inter; CSS variables Shadcn/UI |
| `apps/web/postcss.config.js` | tailwindcss + autoprefixer |
| `apps/web/components.json` | Shadcn/UI config (style default, RSC, cssVariables) |
| `apps/web/app/globals.css` | CSS variables HSL para o tema, import Google Fonts |
| `apps/web/app/layout.tsx` | Root layout: html lang pt-BR, metadata |
| `apps/web/app/page.tsx` | Redirect `/` → `/loja` |
| `apps/web/app/(loja)/layout.tsx` | Layout da loja: header preto com logo dourado, footer |
| `apps/web/app/(loja)/page.tsx` | Home da loja: hero, grid de produtos placeholder |
| `apps/web/app/auth/layout.tsx` | Layout centralizado para auth |
| `apps/web/app/auth/login/page.tsx` | Placeholder — Sprint 4 |
| `apps/web/app/auth/cadastro/page.tsx` | Placeholder — Sprint 4 |
| `apps/web/app/auth/recuperar-senha/page.tsx` | Placeholder — Sprint 4 |
| `apps/web/app/admin/layout.tsx` | Sidebar preta com links dourados, header branco |
| `apps/web/app/admin/dashboard/page.tsx` | Placeholder KPI cards e gráfico — Sprint 10 |
| `apps/web/lib/utils.ts` | Função `cn()` (clsx + tailwind-merge) para Shadcn/UI |

### packages/shared

| Arquivo | Descrição |
|---|---|
| `packages/shared/package.json` | Nome @janainamoda/shared, depende de zod |
| `packages/shared/tsconfig.json` | Extends base |
| `packages/shared/src/index.ts` | Re-exporta enums e types |
| `packages/shared/src/enums/index.ts` | UserRole, ProductStatus, Gender, ProductSize, CouponType, OrderStatus, PaymentMethod, PaymentStatus, InventoryMovementType |
| `packages/shared/src/types/index.ts` | PaginationMeta, PaginatedResponse, CursorPaginationMeta, CursorPaginatedResponse, ApiResponse |

### docs

| Arquivo | Descrição |
|---|---|
| `docs/DECISIONS.md` | Decisões D-01 a D-10 documentadas com data, motivo e impacto |
| `docs/SPRINT-02-HANDOFF.md` | Este arquivo |

---

## 2. Decisões técnicas tomadas nesta sprint

Nenhuma nova decisão além das D-01 a D-10 já registradas no MASTER.md.

**Escolhas de implementação:**
- `validateEnv` usa class-validator com vars obrigatórias: `DATABASE_URL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `COOKIE_SECRET`. Em dev, a validação pode falhar se não houver `.env` — copiar `.env.example` para `.env`.
- PrismaModule declarado como `@Global()` — qualquer módulo pode injetar PrismaService sem re-importar.
- Rotas de auth usam pasta `auth/` (sem route group) para manter URLs `/auth/login`, `/auth/cadastro`.
- Rotas da loja usam route group `(loja)` para isolar o layout sem afetar URLs.
- Admin usa pasta `admin/` sem route group — URLs `/admin/dashboard`, etc.

---

## 3. Pendências e observações

- **Shadcn/UI CLI**: Os componentes Shadcn/UI (Button, Input, etc.) precisam ser instalados individualmente via `pnpm dlx shadcn@latest add <component>` dentro de `apps/web/`. Isso será feito sob demanda a partir da Sprint 4.
- **Prisma Schema completo**: Sprint 3 expande o `schema.prisma` com todos os models.
- **Proteção de rotas admin**: Middleware de autenticação ADMIN será implementado na Sprint 4.
- **Google Fonts**: O import no `globals.css` requer conectividade. Em ambiente sem internet, usar fontes locais ou remover o import.
- **tailwindcss-animate**: Dependência para animações Shadcn/UI — incluída no `package.json`.

---

## 4. Migrations aplicadas

Nenhuma. O schema Prisma está mínimo (apenas datasource + generator). Migration inicial será criada na Sprint 3.

---

## 5. Variáveis novas no .env.example

Todas as variáveis da Seção 10.4 do SDD foram incluídas, mais:

```bash
FALLBACK_SHIPPING_PRICE=15.00    # D-08 — frete fixo se Melhor Envio indisponível
NEXT_PUBLIC_SENTRY_DSN=...       # DSN público para o frontend Next.js
```

---

## 6. Comandos para rodar o projeto agora

```bash
# 1. Instalar dependências
pnpm install

# 2. Copiar e configurar .env
cp .env.example .env
# Editar .env: preencher DATABASE_URL, JWT_SECRET, REFRESH_TOKEN_SECRET, COOKIE_SECRET

# 3. Subir infraestrutura
docker compose up -d

# 4. Verificar saúde dos containers
docker compose ps

# 5. Rodar API (porta 3001)
pnpm dev:api

# 6. Rodar frontend (porta 3000)
pnpm dev:web

# 7. Health check da API
curl http://localhost:3001/api/v1/health
```

---

## 7. O que a Sprint 3 precisa saber

1. **Schema Prisma** em `apps/api/prisma/schema.prisma` está vazio — a Sprint 3 deve adicionar todos os models da Seção 12 do SDD mais os 4 models extras das decisões D-02 e D-04.

2. **`DATABASE_URL`** deve apontar para o PostgreSQL do Docker:
   ```
   DATABASE_URL="postgresql://janaina:janaina123@localhost:5432/janaina_modas"
   ```

3. **Enums do schema Prisma** devem espelhar os enums já definidos em `packages/shared/src/enums/index.ts`.

4. **Seed** deve ler `ADMIN_EMAIL` e `ADMIN_PASSWORD` do `.env` e criar o admin com bcrypt custo 12.

5. **Após a Sprint 3**, o comando `pnpm prisma:migrate:dev --name init` cria a migration inicial e o `pnpm prisma:generate` regenera o cliente.

6. **Regra crítica**: nunca usar `prisma db push` — sempre `prisma migrate dev` em dev e `prisma migrate deploy` em produção.
