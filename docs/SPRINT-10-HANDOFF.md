# SPRINT 10 — HANDOFF: Painel Administrativo

**Data de conclusão:** 2026-05-23
**Status:** CONCLUÍDA
**TypeScript backend:** 0 erros (`tsc --noEmit` limpo)
**TypeScript frontend:** 0 erros novos
**Testes:** 7/7 passando (T-PROD-01 a T-PROD-04)

---

## 1. O que foi implementado

### Backend — `apps/api/src/modules/admin/`

| Arquivo | Descrição |
|---|---|
| `dto/admin-product-filter.dto.ts` | `AdminProductFilterDto` (q, categoryId, status, lowStock, onSale, page, limit); `BulkProductActionDto` |
| `dto/update-order-status.dto.ts` | `UpdateOrderStatusDto` (status, trackingCode obrigatório para SHIPPED, notes); `AdminOrderFilterDto` |
| `dto/coupon.dto.ts` | `CreateCouponDto`, `UpdateCouponDto`, `PatchCouponStatusDto` |
| `dto/inventory.dto.ts` | `UpdateInventoryDto`, `CreateInventoryMovementDto` |
| `audit-log.service.ts` | `AuditLogService.log()` — grava em `audit_logs` com falha silenciosa (RN025) |
| `admin-dashboard.service.ts` | `getDashboard()` — KPIs do dia, faturamento 30 dias (raw SQL), top 5 produtos, alertas de estoque, últimos 10 pedidos |
| `admin-products.service.ts` | `findAll/findOne/create/update/remove/updateStatus/uploadImages/bulkAction` |
| `admin-inventory.service.ts` | `findAll/updateVariant/createMovement/getMovements` |
| `admin-orders.service.ts` | `findAll/findOne/updateStatus` com validação de transições e tracking obrigatório para SHIPPED |
| `admin-coupons.service.ts` | `findAll/findOne/create/update/remove/patchStatus` |
| `admin.controller.ts` | Todos os endpoints `/api/v1/admin/*` com `@Roles(Role.ADMIN)` + AuditLog em cada mutação |
| `admin.module.ts` | Módulo com MulterModule (memoryStorage) para upload multipart |
| `admin-products.service.spec.ts` | 7 testes: T-PROD-01 a T-PROD-04 |

### Backend — Arquivo atualizado

| Arquivo | O que mudou |
|---|---|
| `app.module.ts` | Adicionado `AdminModule` ao array de imports |

---

### Frontend — `apps/web/`

| Arquivo | Descrição |
|---|---|
| `lib/admin-api.ts` | Cliente tipado para todos os endpoints admin (dashboard, products, inventory, orders, coupons). Classe `AdminApiError`. Upload multipart separado (sem Content-Type JSON) |
| `app/admin/layout.tsx` | Sidebar preta `#000000`, links dourados `#C9A84C` no item ativo (via `usePathname`), proteção de rota: redireciona para `/auth/login` sem token, redireciona para `/loja` se role ≠ ADMIN |
| `app/admin/dashboard/page.tsx` | 4 KPI cards (Vendas/Faturamento do dia, Pedidos/Ticket médio do mês), gráfico de linha SVG (faturamento 30 dias), alertas de estoque, top 5 produtos com barras de progresso, tabela últimos 10 pedidos |
| `app/admin/produtos/page.tsx` | Tabela com busca, filtros (status), seleção múltipla, ações em lote (ativar/inativar/excluir), toggle de status inline, paginação |
| `app/admin/produtos/novo/page.tsx` | Página de criação usando `ProductForm` |
| `app/admin/produtos/[id]/page.tsx` | Página de edição carregando produto existente |
| `app/admin/produtos/_components/ProductForm.tsx` | Formulário completo: nome/descrição/preço/categoria, upload drag-and-drop (com preview), tabela de variantes (react-hook-form + useFieldArray), status/toggles, campos SEO, validação Zod |
| `app/admin/inventario/page.tsx` | Tabela com status colorido (verde/amarelo/vermelho), edição inline de estoque e mínimo, modal de movimentação (entrada/saída manual) com motivo obrigatório |
| `app/admin/pedidos/page.tsx` | Tabela com filtros (status, busca, período), modal de atualização de status com validação de transições e campo de rastreamento obrigatório para SHIPPED |
| `app/admin/cupons/page.tsx` | Tabela de cupons com toggle de status, exclusão, modal/form de criação completo |

---

## 2. Endpoints implementados

```
# Dashboard
GET    /api/v1/admin/dashboard

# Produtos
GET    /api/v1/admin/products               ?q, categoryId, status, lowStock, onSale, page, limit
GET    /api/v1/admin/products/:id
POST   /api/v1/admin/products
PUT    /api/v1/admin/products/:id
DELETE /api/v1/admin/products/:id
PATCH  /api/v1/admin/products/:id/status    { status }
POST   /api/v1/admin/products/:id/images    multipart/form-data (campo: images)
POST   /api/v1/admin/products/bulk          { ids[], action: activate|deactivate|delete }

# Invent��rio
GET    /api/v1/admin/inventory
PUT    /api/v1/admin/inventory/:variantId   { stock, minStock? }
POST   /api/v1/admin/inventory/movements    { variantId, type, quantity, reason, notes? }
GET    /api/v1/admin/inventory/:variantId/movements

# Pedidos
GET    /api/v1/admin/orders                 ?status, paymentMethod, dateFrom, dateTo, q, page, limit
GET    /api/v1/admin/orders/:id
PUT    /api/v1/admin/orders/:id/status      { status, trackingCode?, notes? }

# Cupons
GET    /api/v1/admin/coupons
GET    /api/v1/admin/coupons/:id
POST   /api/v1/admin/coupons
PUT    /api/v1/admin/coupons/:id
DELETE /api/v1/admin/coupons/:id
PATCH  /api/v1/admin/coupons/:id/status     { isActive }
```

---

## 3. Regras de negócio implementadas

| Regra | Implementação |
|---|---|
| RN024 — USER não acessa `/admin/` | `@Roles(Role.ADMIN)` em todo `AdminController`; frontend redireciona para `/loja` |
| RN025 — Audit log de ações admin | `AuditLogService.log()` chamado em cada mutação do controller |
| RF039–RF041 — KPIs e alertas dashboard | `AdminDashboardService.getDashboard()` com 8 queries paralelas |
| RF042–RF046 — Cadastro de produtos | `AdminProductsService.create()` com SKU auto (JM-{CAT}-{ts}), variantes em transação |
| RF047 — Produto INACTIVE/DRAFT fora do catálogo | `updateStatus()` + catálogo público já filtra por ACTIVE |
| RF048–RF049 — Editar/bulk action | `update()`, `bulkAction()` com ações ativar/inativar/excluir |
| RF050–RF052 — Inventário por variante | `findAll()` retorna status colorido; `createMovement()` com histórico |
| RF054–RF056 — Gerenciar pedidos + tracking | `updateStatus()` valida transições + exige `trackingCode` para SHIPPED |
| RF057 — Cancelamento reverte estoque | `admin-orders.service` chama `paymentsService.cancelPayment()` para pedidos com pagamento |
| RF063 — Gestão de cupons | CRUD completo com validação de código único (maiúsculas) |
| D-04 — Tabela audit_logs | Já existia no schema; `AuditLogService` grava userId, action, resource, old/new data, IP |

---

## 4. Testes unitários

```bash
cd apps/api && npx jest "admin-products.service.spec" --no-coverage --forceExit --runInBand
```

| Teste | Cenário | Status |
|---|---|---|
| T-PROD-01a | `create` lança NotFoundException se categoria não existe | ✅ 7/7 |
| T-PROD-01b | nome em branco viola `@IsNotEmpty` (documentado) | ✅ |
| T-PROD-02a | upload `.exe` lança `BadRequestException` | ✅ |
| T-PROD-02b | mensagem contém "Formato inválido" | ✅ |
| T-PROD-03 | variants=[] lança `BadRequestException("Adicione ao menos uma variante")` | ✅ |
| T-PROD-04a | `updateStatus(INACTIVE)` chama `product.update` com status INACTIVE | ✅ |
| T-PROD-04b | `findAll` com status=INACTIVE filtra pelo campo correto | ✅ |

---

## 5. Decisões técnicas desta sprint

**D-21: Gráfico de faturamento via SVG puro (sem recharts)**
Recharts não estava instalado. Criado gráfico SVG responsivo inline no dashboard. Sprint 11 (Relatórios) pode instalar recharts para gráficos mais ricos.

**D-22: `cancelPayment` exige externalId do payment**
`PaymentsService.cancelPayment(externalId, reason)` recebe o externalId do Mercado Pago, não o orderId. O AdminOrdersService busca `order.payments[0].externalId` antes de chamar.

**D-23: Upload de imagens via MulterModule memoryStorage**
Arquivos ficam em `buffer` sem tocar o disco, passando direto ao Cloudinary via `uploadBuffer()`. Limite: 10 arquivos por request.

---

## 6. Pendências e observações

### ⚠️ Proteção de rota admin — client-side only
O layout verifica `sessionStorage` no `useEffect`. Proteção server-side real deve ser implementada no `middleware.ts` do Next.js na Sprint 12.

### ⚠️ Formulário de produtos — categoryId como UUID puro
Atualmente o campo categoryId aceita texto livre (UUID). Sprint 11 ou refinamento pode adicionar um `<select>` que busca as categorias via API pública `GET /api/v1/categories`.

### ⚠️ Página de detalhe do pedido admin
Rota `GET /api/v1/admin/orders/:id` existe, mas a página frontend `/admin/pedidos/[id]` não foi criada (não estava no escopo explícito do prompt). Link "Ver" na tabela de pedidos aponta para ela — pode ser criada na Sprint 11 ou como página básica no início da Sprint 11.

### ℹ️ Erros TypeScript pré-existentes da Sprint 5 (não relacionados)
```
app/(loja)/produtos/page.tsx — sort?: string vs union type
components/loja/variant-selector.tsx — MapIterator iteration
```

---

## 7. Variáveis novas no .env.example

Nenhuma variável nova nesta sprint. Todas as dependências já existiam.

---

## 8. Comandos para rodar o projeto

```bash
# Pré-requisito: Docker Desktop rodando
docker compose up -d

# 1. Instalar dependências
pnpm install

# 2. Aplicar migration (se ainda não aplicada)
pnpm --filter api prisma:migrate:dev -- --name init

# 3. Rodar API
pnpm dev:api

# 4. Rodar Web
pnpm dev:web

# 5. Rodar testes da Sprint 10
cd apps/api && npx jest "admin-products.service.spec" --no-coverage --forceExit --runInBand

# 6. Verificar TypeScript backend
cd apps/api && npx tsc --noEmit

# 7. Acessar painel admin
# http://localhost:3000/admin/dashboard
# (redireciona para /auth/login se não autenticado)
# (redireciona para /loja se role = USER)
```

---

## 9. O que a Sprint 11 (Relatórios) precisa saber

1. **`AdminModule` está registrado** — pode importar `AdminModule` ou os services individualmente se precisar de lógica de pedidos/produtos nos relatórios.

2. **`cancelPayment` exige `externalId`** (D-22) — não o `orderId`. Sempre buscar `order.payments[0].externalId` antes de cancelar.

3. **Gráfico SVG** no dashboard (D-21) — Sprint 11 pode instalar `recharts` para gráficos de relatórios mais interativos. Adicionar como dependência em `apps/web/package.json`.

4. **`GET /api/v1/admin/orders` e `GET /api/v1/admin/products`** estão paginados — os relatórios devem consumir os dados diretamente do banco (via novo `ReportsService`) em vez de usar os endpoints paginados.

5. **Página `/admin/pedidos/[id]`** não foi criada — pode ser feita no início da Sprint 11 antes dos relatórios se quiser completude da navegação.

6. **`audit_logs`** já recebe todas as ações admin — os relatórios de auditoria podem simplesmente consultar essa tabela.
