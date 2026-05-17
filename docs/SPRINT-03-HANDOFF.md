# SPRINT 03 — HANDOFF: Banco de Dados

**Data de conclusão:** 2026-05-16
**Status:** CONCLUÍDA (migration pendente — requer Docker)

---

## 1. O que foi implementado

### Schema Prisma

| Arquivo | Descrição |
|---|---|
| `apps/api/prisma/schema.prisma` | Schema completo com 18 models, 8 enums, todos os índices da Seção 24.5 |
| `apps/api/prisma/seed.ts` | Seed idempotente: admin via .env + 6 categorias base |

### Enums definidos

| Enum | Valores |
|---|---|
| `UserRole` | USER, ADMIN |
| `ProductStatus` | ACTIVE, INACTIVE, DRAFT |
| `Gender` | FEMININO, MASCULINO, UNISSEX (D-11: valores em português conforme SDD) |
| `ProductSize` | PP, P, M, G, GG, XG, UNICO (D-11: XG não XGG; UNICO sem acento — limitação Prisma) |
| `CouponType` | FIXED, PERCENTAGE |
| `OrderStatus` | PENDING, PAID, PREPARING, SHIPPED, DELIVERED, CANCELLED |
| `PaymentMethod` | PIX, CREDIT_CARD, DEBIT_CARD, BOLETO |
| `PaymentStatus` | PENDING, APPROVED, REJECTED, CANCELLED, EXPIRED, REFUNDED (EXPIRED mantido — D-11) |
| `InventoryMovementType` | ENTRY, MANUAL_EXIT, SALE, CANCELLATION, RESERVATION, RELEASE (D-11: valores SDD) |

### Models do SDD (Seção 12)

| Model | Tabela | Observações |
|---|---|---|
| `User` | `users` | `phone` NOT NULL (D-06); soft delete via `deleted_at` (LGPD) |
| `UserAddress` | `user_addresses` | — |
| `Category` | `categories` | — |
| `Product` | `products` | `tags String[]` (PostgreSQL TEXT[]) |
| `ProductImage` | `product_images` | `onDelete: Cascade` no product |
| `ProductVariant` | `product_variants` | `onDelete: Cascade` no product |
| `Cart` | `carts` | userId nullable (suporte a convidados via sessionId) |
| `CartItem` | `cart_items` | `onDelete: Cascade` no cart |
| `Coupon` | `coupons` | — |
| `Order` | `orders` | `expiresAt` adicionado (D-12, não estava no SDD) |
| `OrderItem` | `order_items` | `productSnapshot Json` (JSONB) |
| `Payment` | `payments` | `gatewayResponse Json?` (JSONB) |
| `InventoryMovement` | `inventory_movements` | — |
| `OrderStatusHistory` | `order_status_history` | — |

### Models adicionais (D-02 e D-04)

| Model | Tabela | Decisão |
|---|---|---|
| `RefreshToken` | `refresh_tokens` | D-02: token como hash SHA-256 (64 chars hex) |
| `PasswordResetToken` | `password_reset_tokens` | D-04: TTL 1h, campo `usedAt` para invalidação |
| `AuditLog` | `audit_logs` | D-04: RN025 — log de ações admin |
| `CouponUsage` | `coupon_usages` | D-04: RN014 — unique(couponId, userCpf) |

### Índices implementados (Seção 24.5)

Todos os 13 índices da Seção 24.5 do SDD foram implementados via `@@index` e `@unique` no schema Prisma, incluindo os índices compostos com sort descendente para `orders.createdAt` e `inventory_movements(variantId, createdAt)`.

### Outros arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `packages/shared/src/enums/index.ts` | Enums alinhados ao SDD (D-11) |
| `apps/api/package.json` | Adicionado `bcryptjs ^2.4.3`, `@types/bcryptjs ^2.4.6`, config `"prisma": { "seed": ... }` |
| `package.json` (root) | `pnpm.onlyBuiltDependencies` configurado para Prisma/NestJS |
| `docs/DECISIONS.md` | Adicionados D-11 (enum alignment) e D-12 (orders.expires_at) |

---

## 2. Decisões técnicas tomadas nesta sprint

### D-11 — Alinhamento de Enums (Sprint 3)
Os enums criados na Sprint 2 divergiam do SDD em `Gender`, `ProductSize` e `InventoryMovementType`. Todos foram corrigidos para usar os valores do SDD. Ver docs/DECISIONS.md.

### D-12 — Campo `orders.expires_at` (Sprint 3)
O campo `expires_at` não consta na Seção 12 do SDD, mas é exigido pela lógica do D-10 (cron de cancelamento). Adicionado como `DateTime?` (nullable). Ver docs/DECISIONS.md.

### bcrypt → bcryptjs
Docker e Visual Studio Build Tools não estão instalados no ambiente de desenvolvimento atual, impedindo a compilação do módulo nativo `bcrypt`. Substituído por `bcryptjs` (mesmo algoritmo, pure JS, hashes 100% compatíveis). A Sprint 4 pode manter `bcryptjs` ou instalar `bcrypt` nativo se as ferramentas de build estiverem disponíveis.

---

## 3. Pendências e observações

### ⚠️ Migration inicial NÃO foi aplicada
`prisma validate` ✅ e `prisma generate` ✅ foram executados com sucesso.  
`prisma migrate dev --name init` requer PostgreSQL rodando — **ver Seção 6 abaixo** para os comandos.

### Checklist antes de executar a migration
- [ ] Docker Desktop instalado e rodando
- [ ] `.env` criado a partir de `.env.example` com `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- [ ] Containers do `docker-compose.yml` iniciados

---

## 4. Migrations aplicadas

**Nenhuma** — blocked on Docker/PostgreSQL. A migration `init` será a primeira a ser aplicada.

---

## 5. Variáveis novas no .env.example

Nenhuma variável nova além das já existentes. As seguintes são necessárias para o seed:

```bash
ADMIN_EMAIL=admin@janainamodas.com.br
ADMIN_PASSWORD=ChangeMe@2025!
```

---

## 6. Comandos para rodar o projeto agora

```bash
# Pré-requisito: Docker Desktop instalado

# 1. Criar .env a partir do exemplo
cp .env.example .env
# Editar .env: DATABASE_URL, JWT_SECRET, REFRESH_TOKEN_SECRET, COOKIE_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD

# 2. Subir banco de dados e Redis
docker compose up -d

# 3. Aguardar PostgreSQL ficar saudável
docker compose ps  # deve mostrar status "healthy"

# 4. Criar migration inicial e rodar seed
pnpm --filter api prisma:migrate:dev -- --name init

# 5. Verificar tabelas criadas
pnpm --filter api prisma:studio
# Abrir http://localhost:5555

# 6. (Opcional) Rodar seed manualmente se não rodou automaticamente
pnpm --filter api prisma:seed

# 7. Rodar a API
pnpm dev:api
```

---

## 7. O que a Sprint 4 precisa saber

1. **Autenticação usa `bcryptjs`** (não `bcrypt` nativo). Importar com:
   ```typescript
   import * as bcrypt from 'bcryptjs';
   ```
   Rounds obrigatórios: `12` (regra CLAUDE.md).

2. **Refresh token** armazenado na tabela `refresh_tokens` como hash SHA-256 de 64 chars hex (D-02). O token bruto só trafega via cookie HttpOnly; o banco armazena apenas o hash.

3. **Password reset** usa a tabela `password_reset_tokens`. Token é UUID, TTL 1h, campo `usedAt` para invalidação pós-uso.

4. **CPF do admin** no seed é `000.000.000-00` (placeholder). O campo tem unique constraint — a Sprint 4 deve garantir que usuários reais usem CPF válido na validação do DTO.

5. **phone NOT NULL** — o DTO de registro (`POST /auth/register`) precisa validar `@IsNotEmpty()` e `@IsPhoneNumber('BR')` no campo phone (D-06).

6. **Role ADMIN** no guard deve verificar `user.role === 'ADMIN'` — o enum Prisma é `UserRole.ADMIN`.

7. **Shared package atualizado**: Os enums de `@janainamoda/shared` foram atualizados (D-11). Usar os novos valores nos DTOs e validações da Sprint 4.

8. **Migration**: Se a migration ainda não foi rodada, a Sprint 4 não pode ser testada localmente. Priorizar `docker compose up -d` + `pnpm --filter api prisma:migrate:dev -- --name init` antes de iniciar.
