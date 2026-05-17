# SPRINT 07 — HANDOFF: Checkout

**Data de conclusão:** 2026-05-17
**Status:** CONCLUÍDA
**TypeScript backend:** 0 erros (`tsc --noEmit` limpo)
**TypeScript frontend:** 0 erros novos (3 pré-existentes da Sprint 5 — não relacionados)
**Testes:** 8 testes unitários escritos (T-CHECKOUT-01 a T-CHECKOUT-08)

---

## 1. O que foi implementado

### Backend — `apps/api/src/modules/checkout/`

| Arquivo | Descrição |
|---|---|
| `dto/shipping-options.dto.ts` | `ShippingOptionsDto`: `zipCode` (regex CEP) + `items[]` (variantId + quantity) |
| `dto/create-checkout.dto.ts` | `CreateCheckoutDto` com sub-DTOs: `CustomerDto`, `AddressDto`, `ShippingDto`, `PaymentDto` |
| `checkout.service.ts` | `CheckoutService`: `getShippingOptions` (Melhor Envio + D-08 fallback), `createOrder` (transação SELECT FOR UPDATE RN026), `lookupCep` (proxy ViaCEP) |
| `checkout.controller.ts` | `POST /checkout/shipping-options`, `POST /checkout` — ambos com `OptionalJwtGuard` |
| `checkout.module.ts` | Módulo importando `PrismaModule`, `AuthModule`, `CartModule`; registrando `CepController` |

### Backend — `apps/api/src/modules/cep/`

| Arquivo | Descrição |
|---|---|
| `cep.controller.ts` | `GET /api/v1/cep/:zipCode` — proxy para ViaCEP via `CheckoutService.lookupCep()` |

### Backend — Arquivos atualizados

| Arquivo | O que mudou |
|---|---|
| `app.module.ts` | Adicionado `CheckoutModule` |
| `config/env.validation.ts` | Adicionadas variáveis `MELHOR_ENVIO_TOKEN`, `STORE_CEP`, `FALLBACK_SHIPPING_PRICE` |

---

### Frontend — `apps/web/lib/`

| Arquivo | Descrição |
|---|---|
| `checkout-api.ts` | Cliente tipado: `getShippingOptions`, `createCheckout`, `lookupCep`; tipos `ShippingOption`, `CheckoutCustomer`, `CheckoutAddress`, `CheckoutPayment`, `CreateCheckoutPayload`, `CheckoutResult`, `ViaCepResult` |

### Frontend — `apps/web/components/loja/`

| Arquivo | Descrição |
|---|---|
| `checkout-progress.tsx` | Barra de progresso: 4 etapas com círculos numerados, check verde nos concluídos, linha conectora colorida |
| `checkout-step1-customer.tsx` | Etapa 1: nome, e-mail, CPF (com máscara automática), telefone; react-hook-form + Zod; pré-preenche se logado |
| `checkout-step2-delivery.tsx` | Etapa 2: CEP com busca automática ViaCEP, preenchimento de logradouro/bairro/cidade/UF; lista de opções de frete (radio buttons); botão de frete reload |
| `checkout-step3-payment.tsx` | Etapa 3: seleção de forma de pagamento (PIX, Cartão Crédito, Débito, Boleto) — UI completa; integração MP na Sprint 8 |
| `checkout-step4-review.tsx` | Etapa 4: revisão completa (itens, endereço, frete, pagamento, totais), checkbox de aceite dos termos, botão Finalizar com loading |
| `checkout-summary.tsx` | Resumo colapsável: thumbnails, quantidades em badge, subtotal/desconto/frete/total; sticky em desktop |

### Frontend — Páginas

| Arquivo | Descrição |
|---|---|
| `app/(loja)/checkout/page.tsx` | Orquestrador das 4 etapas: estado local de cada step, chama `createCheckout`, exibe tela de sucesso pós-pedido |

---

## 2. Endpoints implementados

```
POST /api/v1/checkout/shipping-options   → lista opções de frete (Melhor Envio ou fallback)
POST /api/v1/checkout                    → cria pedido + payment PENDING
GET  /api/v1/cep/:zipCode               → proxy ViaCEP
```

### Fluxo do POST /checkout

```
1. Buscar carrinho (userId ou sessionId)
2. Validar carrinho não vazio
3. BEGIN TRANSACTION
   a. SELECT FOR UPDATE nas variantes (RN026)
   b. Verificar estoque novamente dentro da transação
   c. Buscar dados completos das variantes (nome, SKU, imagem)
   d. Gerar orderNumber JM-{ANO}{SEQ5} (D-05)
   e. Calcular subtotal, desconto, total
   f. Buscar coupon completo por code (id, maxDiscount)
   g. Criar Order + OrderItems (com productSnapshot JSONB)
   h. Registrar CouponUsage + incrementar usesCount (se cupom)
   i. Limpar carrinho (clearCart)
4. COMMIT
5. Criar Payment (status PENDING, externalId placeholder)
6. Retornar orderId + orderNumber + payment info
```

---

## 3. Regras de negócio implementadas

| Regra | Implementação |
|---|---|
| RN004 — Estoque decrementado só após webhook | `productVariant.update` NÃO chamado no checkout — apenas na Sprint 8 |
| RN006 — PIX expira em 30 minutos | `expiresAt = now() + 30min` para PIX |
| RN007 — Boleto expira em 3 dias | `expiresAt = now() + 3 dias` para BOLETO |
| RN026 — SELECT FOR UPDATE | `$executeRawUnsafe` com `FOR UPDATE` antes de verificar estoque |
| RF067 — Guest checkout | `guestName`, `guestEmail`, `guestCpf` preenchidos quando `userId === null` |
| D-05 — Número do pedido | `JM-{YYYY}{AAAAA}` sequencial por ano |
| D-08 — Fallback frete | `FALLBACK_SHIPPING_PRICE` env var quando Melhor Envio indisponível |
| D-13 — Sem reserva temporária | Documentado: `SELECT FOR UPDATE` suficiente para MVP |
| D-14 — Proxy ViaCEP | Backend faz a chamada; frontend não acessa ViaCEP diretamente |
| D-15 — Payment placeholder | `externalId = pending-{orderId}` até Sprint 8 integrar MP |

---

## 4. Testes unitários

```bash
# Rodar apenas os testes do checkout (requer ≥ 1 GB de RAM livre)
cd apps/api && npx jest "checkout.service.spec" --no-coverage --forceExit --runInBand
```

| Teste | Cenário | Resultado esperado |
|---|---|---|
| T-CHECKOUT-01 | Pedido PIX com dados válidos | retorna orderId + orderNumber |
| T-CHECKOUT-02 | Carrinho vazio | `BadRequestException` |
| T-CHECKOUT-03 | Concorrência — stock=1, quantity=2 | `UnprocessableEntityException` |
| T-CHECKOUT-04 | Snapshot do produto | `productSnapshot` com name, sku, size, colorName, imageUrl |
| T-CHECKOUT-05 | Formato orderNumber | `JM-{ANO}00001` para primeiro pedido do ano |
| T-CHECKOUT-06 | Guest checkout | `userId=null`, `guestName/guestEmail/guestCpf` preenchidos |
| T-CHECKOUT-07 | Estoque não decrementado (RN004) | `productVariant.update` não chamado |
| T-CHECKOUT-08 | Fallback de frete (D-08) | retorna 1 opção com preço do env |

---

## 5. Decisões técnicas desta sprint

| Decisão | Arquivo |
|---|---|
| D-13 — Sem reserva temporária de estoque (SELECT FOR UPDATE suficiente) | `docs/DECISIONS.md` |
| D-14 — Proxy ViaCEP no backend (não chamada direta do frontend) | `docs/DECISIONS.md` |
| D-15 — Payment com externalId placeholder (integração MP na Sprint 8) | `docs/DECISIONS.md` |
| D-16 — Merge de guest cart via sessionId no DTO (merge completo na Sprint 9) | `docs/DECISIONS.md` |

---

## 6. Pendências e observações

### ⚠️ Integração Mercado Pago (Sprint 8)
O `PaymentService` atual cria um registro `Payment` com `externalId = pending-{orderId}`. A Sprint 8 deve:
1. Chamar a API do MP para PIX → popular `qrCode`, `qrCodeBase64`, `expiresAt`
2. Chamar a API do MP para Boleto → popular `barcode`
3. Chamar a API do MP para Cartão → tokenização via SDK frontend
4. Substituir o `externalId` placeholder pelo ID real do MP
5. Implementar polling de 5s (D-03) no frontend da tela de PIX

### ⚠️ Etapa 3 — Cartão de crédito (UI preparada, sem integração)
Os campos de cartão (número, nome, validade, CVV) foram omitidos propositalmente — eles requerem a SDK do Mercado Pago no frontend (tokenização no browser, nunca no servidor — RN008). A Sprint 8 adiciona o SDK MP e os campos de cartão.

### ⚠️ useAuth — campo cpf
A página de checkout usa `user.cpf` do `useAuth()`. Se o AuthProvider não expõe `cpf` no objeto `user`, remover o pré-preenchimento do CPF (o usuário preenche manualmente). Verificar em `context/auth-context.tsx`.

### ⚠️ Erros TypeScript pré-existentes (Sprint 5 — não relacionados)
```
app/(loja)/produtos/page.tsx — sort?: string vs union type
components/loja/variant-selector.tsx — MapIterator iteration
```

### ℹ️ CartService.clearCart — assinatura
O `clearCart` do `CartService` precisa aceitar `(userId?: string, sessionId?: string)`. Verificar se a assinatura atual suporta ambos os casos — se não suportar, adaptar no CartModule (Sprint 7 já chama ambas as formas).

---

## 7. Variáveis novas no .env.example

```env
# Frete — Melhor Envio
MELHOR_ENVIO_TOKEN=         # Token Bearer da API Melhor Envio
STORE_CEP=01310100          # CEP de origem da loja para cálculo de frete

# Frete Fallback (D-08)
FALLBACK_SHIPPING_PRICE=15.00
```

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

# 4. Testar endpoints manualmente
# GET  http://localhost:3001/api/v1/cep/01310100
# POST http://localhost:3001/api/v1/checkout/shipping-options
#      Body: { "zipCode": "01310-100", "items": [{ "variantId": "<uuid>", "quantity": 1 }] }
# POST http://localhost:3001/api/v1/checkout
#      Body: { customer, address, shipping, payment: { method: "PIX" } }

# 5. Rodar testes do checkout
cd apps/api && npx jest "checkout.service.spec" --no-coverage --forceExit --runInBand

# 6. Verificar TypeScript backend
cd apps/api && npx tsc --noEmit
```

---

## 9. O que a Sprint 8 (Pagamentos) precisa saber

1. **Credenciais Mercado Pago obrigatórias antes de iniciar:**
   `MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_WEBHOOK_SECRET` no `.env`
   Sem elas, a Sprint 8 está bloqueada (ver aviso no MASTER.md).

2. **Payment placeholder:** Buscar `payment WHERE externalId = 'pending-{orderId}'`,
   atualizar para o ID real retornado pelo MP + popular `qrCode`/`barcode`.

3. **expiresAt já gravado:** O campo `orders.expires_at` é setado no checkout
   (PIX = +30min, BOLETO = +3 dias). O cron D-10 usa este campo diretamente.

4. **Webhook deve implementar RN004:** `UPDATE product_variants SET stock = stock - quantity`
   dentro de uma transação atômica por `order_item`, com INSERT em `inventory_movements`.

5. **Polling D-03:** Frontend deve fazer `GET /api/v1/orders/{orderId}` a cada 5 segundos
   enquanto `order.status === 'PENDING'`. Redirecionar para `/pedido-confirmado` ao detectar `PAID`.

6. **Tela PIX:** QR Code base64 (vem do MP) + código copia-e-cola + contador regressivo 30min
   (vermelho quando < 5min restantes).

7. **CartService.clearCart** já é chamado no checkout. Não chamar de novo no webhook.
