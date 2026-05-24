# SPRINT 09 — HANDOFF: Minha Conta (Área do Cliente)

**Data de conclusão:** 2026-05-17
**Status:** CONCLUÍDA
**TypeScript backend:** 0 erros (`tsc --noEmit` limpo)
**TypeScript frontend:** 0 erros novos (3 pré-existentes da Sprint 5 — não relacionados)
**Testes:** 8 testes unitários escritos (T-USER-01 a T-USER-08)

---

## 1. O que foi implementado

### Backend — `apps/api/src/modules/users/`

| Arquivo | Descrição |
|---|---|
| `dto/update-profile.dto.ts` | `UpdateProfileDto`: name?, phone? (CPF não permitido) |
| `dto/create-address.dto.ts` | `CreateAddressDto`: todos os campos de endereço com validação |
| `dto/update-address.dto.ts` | `UpdateAddressDto`: extends PartialType(CreateAddressDto) |
| `dto/order-filter.dto.ts` | `OrderFilterDto`: status?, from?, to?, page?, limit? |
| `dto/cancel-order.dto.ts` | `CancelOrderDto`: reason (min 5, max 500 chars) |
| `users.service.ts` | `UsersService`: getMe, updateMe, deleteMe (LGPD), getAddresses, createAddress, updateAddress, deleteAddress, setDefaultAddress, getOrders, getOrderById, cancelOrder |
| `users.controller.ts` | `UsersController`: todos os endpoints com `@UseGuards(JwtAuthGuard)` |
| `users.module.ts` | Módulo com PrismaModule, AuthModule, MailModule, PaymentsModule |
| `users.service.spec.ts` | 8 testes unitários T-USER-01 a T-USER-08 |

### Backend — Arquivos atualizados

| Arquivo | O que mudou |
|---|---|
| `app.module.ts` | Adicionado `UsersModule` ao array de imports |
| `modules/mail/mail.service.ts` | Adicionado `sendOrderCancelled(to, orderNumber)` — e-mail de notificação de cancelamento |

---

### Frontend — Novos arquivos

| Arquivo | Descrição |
|---|---|
| `lib/account-api.ts` | Cliente tipado: `accountApi.getMe/updateMe/deleteMe`, `getAddresses/createAddress/updateAddress/deleteAddress/setDefaultAddress`, `getOrders/getOrder/cancelOrder`. Classe `AccountApiError` |
| `app/(loja)/minha-conta/layout.tsx` | Layout: sidebar fixa (desktop) + tabs horizontais com overflow (mobile). Proteção de rota: redireciona para `/auth/login` se sem token. Botão "Sair" |
| `app/(loja)/minha-conta/page.tsx` | Redirect para `/minha-conta/dados` |
| `app/(loja)/minha-conta/dados/page.tsx` | Dados pessoais: visualização em grid + formulário de edição (react-hook-form + Zod). CPF e e-mail não editáveis. Zona de perigo LGPD com confirmação dupla |
| `app/(loja)/minha-conta/enderecos/page.tsx` | Lista de endereços em cards (padrão destacado em dourado) + formulário com ViaCEP autopreenchimento. Ações: editar, excluir, definir como padrão |
| `app/(loja)/minha-conta/pedidos/page.tsx` | Tabela (desktop) + cards (mobile) com filtro de status e paginação. Skeleton loading. Estado vazio com CTA |
| `app/(loja)/minha-conta/pedidos/[id]/page.tsx` | Detalhe do pedido: itens (foto, nome, variante, qty, preço), totais, endereço, rastreamento, histórico de status (timeline), botão cancelar (visível apenas para PENDING/PAID com campo de motivo) |

### Frontend — Arquivos atualizados

| Arquivo | O que mudou |
|---|---|
| `app/globals.css` | Adicionada classe utilitária `.input-field` no `@layer components` |

---

## 2. Endpoints implementados

```
GET    /api/v1/users/me                          → perfil do usuário autenticado
PUT    /api/v1/users/me                          → editar nome e telefone
DELETE /api/v1/users/me                          → exclusão LGPD (anonimização)

GET    /api/v1/users/me/addresses                → listar endereços
POST   /api/v1/users/me/addresses                → criar endereço
PUT    /api/v1/users/me/addresses/:id            → editar endereço
DELETE /api/v1/users/me/addresses/:id            → excluir endereço
PATCH  /api/v1/users/me/addresses/:id/default    → definir como padrão

GET    /api/v1/users/me/orders                   → listar pedidos (filtros: status, from, to, page, limit)
GET    /api/v1/orders/:id                        → detalhe do pedido
POST   /api/v1/orders/:id/cancel                 → cancelar pedido (PENDING/PAID apenas — D-07)
```

---

## 3. Regras de negócio implementadas

| Regra | Implementação |
|---|---|
| RF034 — Histórico de pedidos | `getOrders` com filtros + paginação 10/página |
| RF035 — Editar dados (exceto CPF) | `updateMe` só aceita `name` e `phone`; CPF bloqueado na DTO |
| RF036 — Gerenciar endereços | CRUD completo + PATCH `/default`; primeiro endereço vira padrão automaticamente |
| RF037 — Cancelar pedido | `cancelOrder` verifica CANCELLABLE_STATUSES = [PENDING, PAID] (D-07) |
| RF038 — Exclusão LGPD (RN023) | `deleteMe` anonimiza nome, e-mail, CPF, telefone; revoga tokens; exclui endereços; pedidos mantidos |
| D-07 — Cancelamento bloqueado após SHIPPED | `BadRequestException` se `status` ∉ [PENDING, PAID] |
| Estoque PAID | `cancelOrder` chama `paymentsService.cancelPayment()` que já reverte estoque (RN005) |
| E-mail de cancelamento | `mailService.sendOrderCancelled()` disparado após cancelamento |
| Proteção de rota frontend | Layout verifica `sessionStorage.access_token`; redireciona para `/auth/login?redirect=...` |

---

## 4. Testes unitários

```bash
cd apps/api && npx jest "users.service.spec" --no-coverage --forceExit --runInBand
```

| Teste | Cenário | Status |
|---|---|---|
| T-USER-01 | `getMe` retorna dados sem hash de senha | ✅ Escrito |
| T-USER-01b | `getMe` lança NotFoundException para usuário inexistente | ✅ Escrito |
| T-USER-02 | `updateMe` não permite CPF/e-mail na DTO | ✅ Escrito |
| T-USER-03 | `createAddress` define isDefault=true no primeiro endereço | ✅ Escrito |
| T-USER-04 | `deleteAddress` lança ForbiddenException para endereço de outro usuário | ✅ Escrito |
| T-USER-04b | `deleteAddress` lança NotFoundException para endereço inexistente | ✅ Escrito |
| T-USER-05 | `getOrders` retorna data + meta com paginação correta | ✅ Escrito |
| T-USER-06 | `getOrderById` lança ForbiddenException para pedido de outro usuário | ✅ Escrito |
| T-USER-07 | `cancelOrder` lança BadRequestException para SHIPPED (D-07) | ✅ Escrito |
| T-USER-07b | `cancelOrder` PENDING — sem reversão de estoque; e-mail enviado | ✅ Escrito |
| T-USER-07c | `cancelOrder` PAID — chama `cancelPayment` (reversão de estoque RN005) | ✅ Escrito |
| T-USER-08 | `deleteMe` — anonimiza dados e revoga tokens (LGPD) | ✅ Escrito |

---

## 5. Decisões técnicas desta sprint

Nenhuma decisão nova documentada no `docs/DECISIONS.md` — todas as situações cobertas pelas decisões D-01 a D-20 existentes.

---

## 6. Pendências e observações

### ⚠️ Proteção de rota no frontend — client-side only
O layout verifica `sessionStorage.access_token` no `useEffect`. Para proteção server-side real, implementar `middleware.ts` do Next.js na Sprint 12 ou usar cookies HttpOnly diretamente.

### ⚠️ Formulário de troca de senha
O SDD 6.2.6 menciona "formulário de troca de senha separado". A Sprint 4 já implementou `POST /auth/reset-password` com token por e-mail. O link pode ser adicionado na página `/minha-conta/dados` apontando para `/auth/recuperar-senha` — decidido manter fora do escopo da Sprint 9 para não replicar lógica.

### ⚠️ Botão "Solicitar troca/devolução"
SDD 6.2.6 marca como `[ASSUNÇÃO: fora do escopo v1.0]`. Não implementado.

### ℹ️ Erros TypeScript pré-existentes da Sprint 5 (não relacionados)
```
app/(loja)/produtos/page.tsx — sort?: string vs union type
components/loja/variant-selector.tsx — MapIterator iteration
```

---

## 7. Variáveis novas no .env.example

Nenhuma variável nova nesta sprint. Todas as dependências (RESEND_API_KEY, FRONTEND_URL) já existiam.

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

# 5. Rodar testes da Sprint 9
cd apps/api && npx jest "users.service.spec" --no-coverage --forceExit --runInBand

# 6. Verificar TypeScript backend
cd apps/api && npx tsc --noEmit

# 7. Acessar Minha Conta
# http://localhost:3000/minha-conta
# (redireciona para /auth/login se não autenticado)
```

---

## 9. O que a Sprint 10 (Painel Administrativo) precisa saber

1. **UsersModule exporta UsersService** — se o painel admin precisar de dados de usuários (ex: detalhe de pedido com info do cliente), pode importar `UsersModule`.

2. **`GET /api/v1/orders/:id` não é admin-only** — é rota de cliente. Para o painel admin, criar `GET /api/v1/admin/orders/:id` com `@Roles('ADMIN')` separado (ou reaproveitando a lógica do UsersService sem a checagem de `userId`).

3. **`cancelOrder` chama `PaymentsService.cancelPayment`** — o cancelamento admin deve seguir o mesmo fluxo para garantir reversão de estoque (RN005) e e-mail.

4. **AuditLog** — toda ação do admin deve registrar na tabela `audit_logs` (RN025). O `UsersController` não faz audit (é área do cliente). O `AdminController` da Sprint 10 deve incluir isso em cada mutação.

5. **Paginação offset-based** nos pedidos do cliente — a Sprint 10 pode usar cursor-based para listagens maiores no admin (consistente com produtos da Sprint 5).
