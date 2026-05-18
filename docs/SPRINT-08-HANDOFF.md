# SPRINT 08 — HANDOFF: Pagamentos

**Data de conclusão:** 2026-05-17
**Status:** CONCLUÍDA
**TypeScript backend:** 0 erros (`tsc --noEmit` limpo)
**TypeScript frontend:** 0 erros novos (3 pré-existentes da Sprint 5 — não relacionados)
**Testes:** 10/10 passando (T-PAG-01 a T-PAG-06 + T-EST-01 a T-EST-03)

---

## 1. O que foi implementado

### Backend — `apps/api/src/modules/payments/`

| Arquivo | Descrição |
|---|---|
| `dto/process-payment.dto.ts` | `ProcessPaymentDto`: orderId, method, payerEmail, payerName, payerCpf, cardToken?, paymentMethodId?, installments? |
| `payments.service.ts` | `PaymentsService`: createPayment (MP API), handleWebhook (HMAC + idempotência), approvePayment (transação atômica RN004), cancelPayment (reversão de estoque), cancelExpiredOrders (D-10), getOrderPaymentStatus (polling D-03) |
| `payments.controller.ts` | `POST /payments` (criar pagamento), `GET /payments/orders/:orderId/status` (polling), `POST /payments/webhook` (sempre 200 OK) |
| `payments.module.ts` | Módulo com BullModule (emailQueue + cancelExpiredOrders), MailModule, PrismaModule, AuthModule |
| `jobs/cancel-expired-orders.job.ts` | Processador Bull da fila `cancelExpiredOrders` |
| `jobs/cron-scheduler.service.ts` | Registra job repetível com cron `*/5 * * * *` no startup (D-10) |
| `jobs/email-queue.processor.ts` | Processador Bull da fila `emailQueue` — handler `order-confirmed` envia e-mail via MailService |
| `payments.service.spec.ts` | 10 testes unitários (T-PAG-01 a T-PAG-06, T-EST-01 a T-EST-03) |

### Backend — Arquivos atualizados

| Arquivo | O que mudou |
|---|---|
| `app.module.ts` | Adicionado `BullModule.forRootAsync` (Redis) e `PaymentsModule` |
| `config/env.validation.ts` | Adicionadas `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_WEBHOOK_SECRET` |
| `modules/checkout/checkout.service.ts` | Importa `PaymentsService`; após criar o pedido, chama `payments.createPayment()` e retorna dados reais do MP (qrCode, barcode, etc.) |
| `modules/checkout/checkout.module.ts` | Importa `PaymentsModule` |
| `modules/checkout/dto/create-checkout.dto.ts` | Adicionado `paymentMethodId?` no `PaymentDto` |
| `modules/mail/mail.service.ts` | Adicionado `sendOrderConfirmed(to, orderNumber, total)` |

---

### Frontend — Novos arquivos

| Arquivo | Descrição |
|---|---|
| `lib/payments-api.ts` | Cliente tipado: `paymentsApi.getOrderStatus(orderId)` para polling D-03 |
| `components/loja/pix-payment.tsx` | QR Code base64 + código copia-e-cola + contador regressivo 30min (vermelho < 5min) |
| `components/loja/boleto-payment.tsx` | Código de barras + botão copiar + link boleto + data de vencimento |
| `app/(loja)/pagamento/[orderId]/page.tsx` | Página de pagamento: polling 5s (D-03), exibe PIX/Boleto/Cartão, redireciona para /pedido-confirmado ao detectar PAID |
| `app/(loja)/pedido-confirmado/page.tsx` | Tela de confirmação pós-pagamento com link para acompanhar pedido |

### Frontend — Arquivos atualizados

| Arquivo | O que mudou |
|---|---|
| `components/loja/checkout-step3-payment.tsx` | Formulário de cartão com tokenização via MP.js (RN008); carrega SDK do CDN dinamicamente |
| `lib/checkout-api.ts` | `CheckoutPayment` adiciona `paymentMethodId?`; `CheckoutResult.payment` adiciona `externalId?`, `boletoUrl?` |
| `app/(loja)/checkout/page.tsx` | Após `createCheckout`, redireciona para `/pagamento/:orderId` passando dados MP via query string |

---

## 2. Endpoints implementados

```
POST   /api/v1/payments                       → cria pagamento no MP (PIX/Boleto/Cartão)
GET    /api/v1/payments/orders/:orderId/status → status do pedido para polling (D-03)
POST   /api/v1/payments/webhook               → recebe notificações MP (sempre 200 OK)
```

---

## 3. Fluxo completo de pagamento

### PIX
```
POST /checkout → cria order PENDING + payment placeholder
              → PaymentsService.createPayment(PIX) → MP API → retorna qrCode + qrCodeBase64
              → atualiza Payment record com externalId real
              → frontend redireciona para /pagamento/:orderId?qrCodeBase64=...
              → página de pagamento exibe QR Code + countdown 30min
              → polling GET /payments/orders/:orderId/status a cada 5s
MP webhook → POST /payments/webhook → validação HMAC
           → approvePayment(externalId) →
             TRANSACTION {
               UPDATE orders SET status=PAID
               UPDATE payments SET status=APPROVED, paid_at=now()
               UPDATE product_variants SET stock = stock - qty  (RN004)
               INSERT inventory_movements (type=SALE)
             }
           → emailQueue.add('order-confirmed')
           → polling detecta PAID → redirect /pedido-confirmado
```

### Boleto
```
Similar ao PIX, mas: payment_method_id='bolbradesco', expiresAt = +3 dias
Frontend exibe barcode + link do boleto + data de vencimento
```

### Cartão de Crédito/Débito (RN008)
```
Usuário preenche dados no formulário (MP.js no browser)
MP.js.createCardToken() → token no frontend (dados NUNCA passam pelo servidor)
POST /checkout { payment: { method: 'CREDIT_CARD', cardToken, paymentMethodId, installments } }
Backend chama MP com { token, installments, payment_method_id }
Webhook aprova → mesmo fluxo de approvePayment
```

---

## 4. Regras de negócio implementadas

| Regra | Implementação |
|---|---|
| RN004 — Estoque decrementado só após webhook | `approvePayment` com transação atômica — `UPDATE product_variants SET stock = stock - qty` |
| RN005 — Estoque revertido em cancelamento | `cancelPayment` com `UPDATE product_variants SET stock = stock + qty` + `INSERT inventory_movements (CANCELLATION)` |
| RN006 — PIX expira em 30 minutos | `date_of_expiration` passado para MP; cron D-10 cancela se webhook não chegar |
| RN007 — Boleto expira em 3 dias | Mesmo mecanismo |
| RN008 — Dados de cartão nunca no servidor | Tokenização 100% no browser via `MercadoPago.createCardToken()` |
| D-03 — Polling de 5 segundos | `setInterval(5000)` em `pagamento/[orderId]/page.tsx` — detecta PAID e redireciona |
| D-10 — Cron job cancelar expirados | `CronSchedulerService` registra job repetível Bull `*/5 * * * *` no startup |
| SDD 13.7 — Webhook sempre 200 OK | try/catch no controller — nunca deixa propagar erro para o MP |
| T-PAG-06 — Idempotência webhook | `if (payment.status === APPROVED) return` antes da transação |
| SDD 17.9 — HMAC X-Signature | `validateHmac` com `timingSafeEqual` — pulado apenas em sandbox sem secret |

---

## 5. Decisões técnicas desta sprint

| Decisão | Arquivo |
|---|---|
| D-17 — CheckoutService chama PaymentsService após criar pedido | `docs/DECISIONS.md` |
| D-18 — Webhook sempre 200 OK (SDD 13.7) — erros logados mas nunca propagados | `docs/DECISIONS.md` |
| D-19 — HMAC pulado em sandbox sem secret configurado (log de aviso) | `docs/DECISIONS.md` |
| D-20 — Dados do MP passados via query string para evitar chamada extra de API | `docs/DECISIONS.md` |

---

## 6. Testes unitários

```bash
cd apps/api && npx jest "payments.service.spec" --no-coverage --forceExit --runInBand
```

| Teste | Cenário | Status |
|---|---|---|
| T-PAG-01 | PIX aprovado via webhook → PAID, estoque decrementado, e-mail enviado | ✅ Passa |
| T-PAG-02 | PIX cancelado/expirado → CANCELLED, estoque revertido | ✅ Passa |
| T-PAG-03 | Cartão válido aprovado → chama MP com token, retorna status approved | ✅ Passa |
| T-PAG-04 | Cartão recusado → retorna status rejected sem exceção | ✅ Passa |
| T-PAG-05 | Cartão sem token → lança BadRequestException (RN008) | ✅ Passa |
| T-PAG-06 | Webhook duplicado → idempotência: não chama transação nem e-mail | ✅ Passa |
| T-EST-01 | Decremento correto stock=10, qty=2 → stock=8 | ✅ Passa |
| T-EST-02 | Cancelamento reverte stock=8, qty=2 → stock=10 | ✅ Passa |
| T-EST-03 | Cron D-10 cancela pedidos expirados | ✅ Passa |
| T-EST-03b | Cron D-10 não cancela nada se não há expirados | ✅ Passa |

---

## 7. Pendências e observações

### ⚠️ MERCADOPAGO_WEBHOOK_SECRET precisa ser configurado em produção
O webhook secret é gerado no painel do Mercado Pago (Developers → Webhooks → Assinatura).
Em sandbox, a validação HMAC é pulada com aviso de log. Em produção é **obrigatória**.

### ⚠️ URL do webhook precisa ser registrada no painel MP
Registrar `https://seudominio.com.br/api/v1/payments/webhook` no painel de desenvolvedores do MP.
Em sandbox, usar ngrok ou similar para expor localhost.

### ⚠️ NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY precisa estar no .env do frontend
```env
# apps/web/.env.local
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=TEST-bdc3f963-...
```

### ⚠️ Erros TypeScript pré-existentes (Sprint 5 — não relacionados)
```
app/(loja)/produtos/page.tsx — sort?: string vs union type
components/loja/variant-selector.tsx — MapIterator iteration
```

### ℹ️ Redis obrigatório para Bull
As filas Bull requerem Redis rodando. `docker compose up -d` deve incluir o serviço Redis.

### ℹ️ Cartão de débito no MP sandbox
No ambiente sandbox do MP, débito pode ter comportamento diferente de produção.
Testar com cartões de teste do MP: https://www.mercadopago.com.br/developers/pt/docs/testing

---

## 8. Variáveis novas no .env.example

```env
# Mercado Pago (Sprint 8)
MERCADOPAGO_ACCESS_TOKEN=TEST-your_access_token
MERCADOPAGO_PUBLIC_KEY=TEST-your_public_key
MERCADOPAGO_WEBHOOK_SECRET=your_webhook_secret
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=TEST-your_public_key  # Frontend

# CEP de origem (Frete)
STORE_CEP=01310100
```

---

## 9. Comandos para rodar o projeto

```bash
# Pré-requisito: Docker Desktop rodando
docker compose up -d

# 1. Instalar dependências (após esta sprint)
pnpm install

# 2. Aplicar migration (apenas se ainda não aplicada)
pnpm --filter api prisma:migrate:dev -- --name init

# 3. Rodar API
pnpm dev:api

# 4. Rodar Web
pnpm dev:web

# 5. Rodar testes de pagamentos
cd apps/api && npx jest "payments.service.spec" --no-coverage --forceExit --runInBand

# 6. Verificar TypeScript backend
cd apps/api && npx tsc --noEmit

# 7. Para testar webhooks localmente: usar ngrok
# ngrok http 3001
# Registrar URL ngrok no painel MP como: https://xxx.ngrok.io/api/v1/payments/webhook
```

---

## 10. O que a Sprint 9 (Minha Conta) precisa saber

1. **Rota de status de pedido:** `GET /api/v1/payments/orders/:orderId/status` já existe para polling.
   A Sprint 9 pode criar `GET /api/v1/orders/:id` para a área de conta do cliente (detalhes completos).

2. **Cancelamento de pedido:** `PaymentsService.cancelPayment(externalId, reason)` já reverte estoque.
   A Sprint 9 precisa de um endpoint `POST /orders/:id/cancel` que chame este método (apenas para PENDING/PAID, regra D-07).

3. **Pedido PAID não pode ser cancelado imediatamente:** Verificar regra D-07 — cancelamento bloqueado após SHIPPED.

4. **E-mail de cancelamento:** Adicionar `sendOrderCancelled` ao `MailService` para notificar o cliente.

5. **InventoryMovement type CANCELLATION:** Já implementado no `cancelPayment` — a Sprint 9 deve usar o mesmo fluxo para cancelamentos via área do cliente.

6. **Guest orders:** Pedidos sem userId têm `guestEmail` para envio de e-mail. Verificar ao implementar histórico de pedidos.
