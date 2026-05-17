# SPRINT 06 — HANDOFF: Carrinho

**Data de conclusão:** 2026-05-17
**Status:** CONCLUÍDA
**TypeScript backend:** 0 erros (`tsc --noEmit` limpo)
**TypeScript frontend:** 0 erros novos (3 pré-existentes da Sprint 5 — ver Pendências)
**Testes:** 12 testes unitários escritos (T-CART-01 a T-CART-08 + extras)

---

## 1. O que foi implementado

### Backend — `apps/api/src/modules/cart/`

| Arquivo | Descrição |
|---|---|
| `dto/add-item.dto.ts` | `variantId` (UUID) + `quantity` (1–99) com class-validator |
| `dto/update-item.dto.ts` | `quantity` (1–99) com class-validator |
| `dto/apply-coupon.dto.ts` | `code` (string, Transform para UPPERCASE) com class-validator |
| `cart.service.ts` | CartService completo: getCart (cache Redis JSON), addItem, updateItem, removeItem, clearCart, applyCoupon (RN014/RN015/RN016), removeCoupon, revalidação RN021 |
| `cart.controller.ts` | 8 endpoints: GET/POST/PUT/DELETE cart + POST/DELETE coupon; OptionalJwtGuard para rotas públicas, JwtAuthGuard para cupom |
| `cart.module.ts` | Módulo NestJS importando PrismaModule, RedisModule, AuthModule |
| `cart.service.spec.ts` | 12 testes unitários: T-CART-01 a T-CART-08 + clearCart + RN021 |

### Backend — `apps/api/src/modules/auth/guards/`

| Arquivo | Descrição |
|---|---|
| `optional-jwt.guard.ts` | OptionalJwtGuard: extends AuthGuard('jwt'), sobrescreve handleRequest para retornar null em vez de 401 quando sem token |

### Backend — Arquivos atualizados

| Arquivo | O que mudou |
|---|---|
| `app.module.ts` | Adicionado CartModule |

---

### Frontend — `apps/web/lib/`

| Arquivo | Descrição |
|---|---|
| `cart-api.ts` | Cliente de API tipado: getCart, addItem, updateItem, removeItem, clearCart, applyCoupon, removeCoupon; CartApiError; tipos Cart, CartItem, CartVariant, CartProduct, CartCoupon |

### Frontend — `apps/web/store/`

| Arquivo | Descrição |
|---|---|
| `cart-store.ts` | Zustand store: CartState com cart/loading/error + ações assíncronas; useCartCount helper para badge do header |

### Frontend — `apps/web/components/ui/`

| Arquivo | Descrição |
|---|---|
| `button.tsx` | shadcn/ui Button (variant: default/destructive/outline/secondary/ghost/link; size: default/sm/lg/icon) |
| `input.tsx` | shadcn/ui Input com forwardRef |

### Frontend — `apps/web/components/loja/`

| Arquivo | Descrição |
|---|---|
| `cart-item-card.tsx` | Card de item: thumbnail Next/Image, nome+variante, preço unitário, seletor +/−, subtotal, remover; aviso inline de estoque baixo (< 3 unidades) |
| `cart-summary.tsx` | Resumo: subtotal, desconto (badge verde), cupom com feedback inline sucesso/erro, campo CEP + lista de opções de frete, total com frete, CTAs Finalizar/Continuar |

### Frontend — Páginas

| Arquivo | Descrição |
|---|---|
| `app/(loja)/carrinho/page.tsx` | Página do carrinho: skeleton loading, estado vazio com CTA, grid 2/3 colunas (itens + resumo), limpar carrinho |

### Frontend — Dependência adicionada

| Pacote | Versão | Motivo |
|---|---|---|
| `zustand` | `^4.5.4` | Gerenciamento de estado do carrinho (SDD 10.1 / Stack obrigatória) |

---

## 2. Endpoints implementados

```
GET    /api/v1/cart                  → retorna carrinho (autenticado ou guest via session_id cookie)
POST   /api/v1/cart/items            → adiciona/acumula item (valida RN001, RN002)
PUT    /api/v1/cart/items/:id        → atualiza quantidade (valida estoque)
DELETE /api/v1/cart/items/:id        → remove item (ownership check)
DELETE /api/v1/cart                  → limpa todos os itens + remove cupom
POST   /api/v1/cart/coupon           → aplica cupom (requer JWT; valida RN014, RN015, RN016)
DELETE /api/v1/cart/coupon           → remove cupom do carrinho
```

### Autenticação por rota

| Endpoint | Guard | Lógica |
|---|---|---|
| Todas exceto POST coupon | `OptionalJwtGuard` | Se autenticado → `userId`; se guest → `session_id` cookie (gerado se ausente) |
| POST /cart/coupon | `JwtAuthGuard` | Requer token JWT (CPF necessário para RN014) |

---

## 3. Regras de negócio implementadas

| Regra | Implementação |
|---|---|
| RN001 — estoque > 0 para adicionar | `available = stock - reservedStock; if (<=0) → 422` |
| RN002 — quantidade ≤ estoque disponível | Checado em addItem e updateItem; acumulação controlada |
| RN014 — uso único por CPF | `couponUsage.findUnique({ couponId, userCpf })` |
| RN015 — cupom ativo, não expirado, dentro do limite | `isActive`, `validUntil`, `usesCount < maxUses` |
| RN016 — subtotal ≥ min_order_value | Soma dos itens antes de aplicar |
| RN021 — revalidar estoque após 1h de inatividade | `now - cart.updatedAt > 1h` → revalidateIfStale() remove/ajusta itens |

---

## 4. Persistência e Cache

| Camada | O que persiste |
|---|---|
| **PostgreSQL** | Tabelas `carts` + `cart_items` — autenticado (userId) e guest (sessionId). **Nunca Redis para persistência** |
| **Redis** | Cache do response final (`cart:user:{id}` ou `cart:session:{id}`) com TTL 60s, invalidado em toda mutação |

### Ciclo de vida do session_id

1. Guest faz `GET /cart` → backend não encontra cookie → gera UUID → seta cookie `session_id` HttpOnly, SameSite=lax, MaxAge 7d
2. Próximas requisições do mesmo browser enviam o cookie → backend identifica o carrinho
3. Ao fazer login (futura Sprint 4 integração): merge do guest cart no user cart (a implementar em Sprint 7/Checkout)

---

## 5. Testes unitários

```bash
# Rodar apenas os testes do carrinho (requer ≥ 1 GB de RAM livre)
cd apps/api && npx jest "cart.service.spec" --no-coverage --forceExit --runInBand
```

| Teste | Cenário | Resultado esperado |
|---|---|---|
| T-CART-01 | Variante inexistente/inativa | NotFoundException |
| T-CART-02 | Quantidade > estoque disponível | UnprocessableEntityException |
| T-CART-02b | Acumulação além do disponível | UnprocessableEntityException |
| T-CART-03 | Remover item existente | Item deletado, totais atualizados |
| T-CART-03b | Remover item inexistente | NotFoundException |
| T-CART-04 | Cupom 20% válido sobre R$299,80 | desconto ≈ R$59,96 |
| T-CART-05 | Cupom inexistente ou inativo | BadRequestException "Cupom inválido" |
| T-CART-06 | Cupom expirado | BadRequestException "Cupom expirado" |
| T-CART-07 | CPF já usou este cupom (RN014) | BadRequestException "já utilizou" |
| T-CART-08 | Subtotal < min_order_value (RN016) | BadRequestException com valor exibido |
| Extra — clearCart | Limpar carrinho | deleteMany chamado, items=[] |
| Extra — RN021 | Estoque zerado após 1h inatividade | cartItem.delete chamado |

---

## 6. Pendências e observações

### ⚠️ Erros TypeScript pré-existentes (Sprint 5 — não relacionados à Sprint 6)

```
app/(loja)/produtos/page.tsx — sort?: string vs union type (Sprint 5)
components/loja/variant-selector.tsx — MapIterator iteration (Sprint 5)
```

Estes erros existiam antes desta sprint e não foram modificados para não alterar o escopo.

### ⚠️ Merge de carrinho guest → autenticado não implementado

Quando um guest adiciona itens e depois faz login, o carrinho do guest **não é automaticamente migrado** para o userId. Esta lógica de merge deve ser implementada no fluxo de login (Sprint 7 — Checkout) ou ao retornar o token de login (Sprint 4 refactor).

Decisão sugerida: no endpoint POST /auth/login, se `session_id` cookie presente, transferir os itens do cart guest para o cart do usuário autenticado.

### ⚠️ Coupon — decremento de uses_count

O campo `coupon.usesCount` **não é decrementado** no `applyCoupon`. O incremento real acontece quando o pedido é confirmado (Sprint 8 — Pagamentos webhook). Isso é correto pelo SDD — o cupom é apenas "reservado" no carrinho.

### ℹ️ Frete no CartSummary

O componente `cart-summary.tsx` faz `POST /api/v1/checkout/shipping-options` para calcular frete. Este endpoint será implementado na Sprint 7. Enquanto isso, a falha é silenciosa (try/catch) e o campo frete fica vazio, sem travar a UX.

### ℹ️ Botão "Finalizar compra"

Redireciona para `/checkout`, que será implementado na Sprint 7.

### ℹ️ Badge do header

O `useCartCount` helper está disponível no `cart-store.ts`. Para usar no header (Sprint 7 ou Sprint 9), importar e conectar ao `useCartStore`.

---

## 7. Variáveis novas no .env.example

Nenhuma variável nova. Todas as dependências já existiam.

---

## 8. Comandos para rodar o projeto

```bash
# Pré-requisito: Docker Desktop rodando
docker compose up -d

# 1. Aplicar migration (apenas se ainda não aplicada)
pnpm --filter api prisma:migrate:dev -- --name init

# 2. Rodar API
pnpm dev:api

# 3. Rodar Web
pnpm dev:web

# 4. Testar carrinho manualmente
# GET http://localhost:3001/api/v1/cart
# POST http://localhost:3001/api/v1/cart/items
# Body: { "variantId": "<uuid>", "quantity": 1 }

# 5. Rodar testes unitários do carrinho
cd apps/api && npx jest "cart.service.spec" --no-coverage --forceExit --runInBand

# 6. Verificar TypeScript backend
cd apps/api && npx tsc --noEmit
```

---

## 9. O que a Sprint 7 (Checkout) precisa saber

1. **CartService está exportado** pelo `CartModule` — importe-o no CheckoutModule para acessar `getCart()`, `clearCart()` e `applyCoupon()`.

2. **Merge de guest cart**: implementar no fluxo de login ou no início do checkout. Ler `session_id` cookie, encontrar cart guest, transferir itens para o cart do userId autenticado.

3. **Validar estoque no checkout**: usar `SELECT FOR UPDATE` nas variantes (RN026) — não confiar nos valores do carrinho. CartItem.unitPrice é snapshot do momento da adição (pode ter mudado).

4. **Limpar carrinho após pedido confirmado**: `cartService.clearCart(userId)` deve ser chamado após `order` criada com sucesso no checkout.

5. **Endpoint de frete**: `POST /api/v1/checkout/shipping-options` é consumido pelo `cart-summary.tsx` — implementar na Sprint 7.

6. **CouponUsage**: ao criar o pedido, registrar `couponUsage` e incrementar `coupon.usesCount` dentro da transação.

7. **Zustand store**: `useCartStore` e `useCartCount` estão prontos em `apps/web/store/cart-store.ts` para o header e para reset pós-checkout.
