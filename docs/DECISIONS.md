# Decisões Técnicas — Janaina Modas

Registro de decisões que resolvem contradições e lacunas do SDD.
Não questionar nem reimplementar diferente — já foram decididas e documentadas.

---

## D-01 — BANCO: PostgreSQL (não MySQL)

**Data:** 2025-05-15 | **Sprint:** 1

**Decisão:** Usar PostgreSQL como banco de dados relacional.

**Motivo:** CLAUDE.md inicial citava MySQL por engano. O SDD usa recursos como JSONB (product_snapshot em order_items), TEXT[] e índices GIN que são incompatíveis com MySQL. Toda a arquitetura e exemplos do SDD pressupõem PostgreSQL.

**Impacto:** `DATABASE_URL` aponta para PostgreSQL. Prisma schema usa `provider = "postgresql"`. Docker Compose sobe `postgres:16-alpine`.

---

## D-02 — REFRESH TOKEN: Banco de dados (tabela refresh_tokens)

**Data:** 2025-05-15 | **Sprint:** 1

**Decisão:** Armazenar refresh tokens na tabela `refresh_tokens` do PostgreSQL, como hash SHA-256.

**Motivo:** SDD contraditório — seção 17.1 especifica banco, diagrama 11.3 sugere Redis. Banco é mais durável, auditável e permite invalidação individual por usuário ou invalidação em massa (logout de todos os dispositivos).

**Impacto:** Sprint 3 cria tabela `refresh_tokens`. Sprint 4 implementa lógica de rotação.

---

## D-03 — STATUS PAGAMENTO: Polling de 5 segundos (não SSE)

**Data:** 2025-05-15 | **Sprint:** 1

**Decisão:** Frontend faz polling a cada 5 segundos em `GET /api/v1/orders/:id` enquanto pedido está `PENDING`.

**Motivo:** SDD não especifica o mecanismo de notificação em tempo real. Polling é mais simples para MVP e elimina complexidade de WebSocket/SSE no deploy inicial.

**Impacto:** Sprint 8 implementa o polling no componente de status de pagamento.

---

## D-04 — TABELAS AUSENTES: Criar na Sprint 3

**Data:** 2025-05-15 | **Sprint:** 1

**Decisão:** Criar três tabelas não descritas explicitamente no SDD mas exigidas pelas regras de negócio:

- `password_reset_tokens` — recuperação de senha (RF007), TTL de 1 hora
- `audit_logs` — log de ações do admin (RN025)
- `coupon_usages` — controle de uso único por CPF (RN014)

**Motivo:** Sem essas tabelas não é possível implementar as RNs correspondentes.

**Impacto:** Sprint 3 adiciona os três models ao schema Prisma.

---

## D-05 — NÚMERO DO PEDIDO: Formato JM-{ANO}{SEQUENCIAL_5DÍGITOS}

**Data:** 2025-05-15 | **Sprint:** 1

**Decisão:** Número do pedido no formato `JM-AAAA#####`, ex: `JM-202500001`.

**Motivo:** SDD apresenta 3 formatos distintos em seções diferentes. Escolhido o mais legível, incluindo o ano para facilitar auditoria.

**Impacto:** Sprint 7 gera o número via sequence PostgreSQL no momento de criação do pedido.

---

## D-06 — CAMPO PHONE: Obrigatório no cadastro

**Data:** 2025-05-15 | **Sprint:** 1

**Decisão:** Campo `phone` é obrigatório no cadastro de usuário (`NOT NULL` no banco).

**Motivo:** Schema Prisma do SDD o marca como opcional, mas RF001 trata como obrigatório. Adotar a regra funcional é o comportamento correto.

**Impacto:** DTO de cadastro tem `@IsNotEmpty()` no campo phone. Sprint 4 implementa validação de formato.

---

## D-07 — CANCELAMENTO: Bloqueado após SHIPPED

**Data:** 2025-05-15 | **Sprint:** 1

**Decisão:** Pedido não pode ser cancelado pelo cliente após status `SHIPPED`.

**Motivo:** Diagrama de estados (seção 11.x) e RN009 conflitam. RN009 é mais restritivo e faz sentido operacional — não é possível cancelar um pedido já enviado.

**Impacto:** Sprint 9 implementa validação no endpoint `POST /api/v1/orders/:id/cancel`.

---

## D-08 — FRETE FALLBACK: Variável FALLBACK_SHIPPING_PRICE

**Data:** 2025-05-15 | **Sprint:** 1

**Decisão:** Se a API Melhor Envio estiver indisponível, usar frete fixo configurado em `FALLBACK_SHIPPING_PRICE=15.00`.

**Motivo:** Sem fallback, o checkout ficaria bloqueado se a API de frete cair, gerando perda de vendas.

**Impacto:** Sprint 7 implementa o fallback no `ShippingService`. `.env.example` já inclui a variável.

---

## D-09 — RELATÓRIO PDF: Assíncrono via Bull queue

**Data:** 2025-05-15 | **Sprint:** 1

**Decisão:** Geração de PDF é assíncrona. Endpoint retorna `202 Accepted + { job_id }`. Cliente faz polling em `GET /api/v1/admin/reports/jobs/:job_id` até `status === 'completed'`.

**Motivo:** Geração síncrona de PDF com grandes volumes causaria timeout HTTP (>30s).

**Impacto:** Sprint 11 implementa a fila `reportQueue` e o worker de geração com pdfmake ou puppeteer.

---

## D-10 — BULL CRON: Cancelar PIX/Boleto expirado a cada 5 minutos

**Data:** 2025-05-15 | **Sprint:** 1

**Decisão:** Job Bull CRON roda a cada 5 minutos, busca pedidos `PENDING` com `expires_at < NOW()` e os cancela, revertendo estoque.

**Motivo:** Mercado Pago pode não enviar webhook de expiração em alguns cenários. O cron garante consistência do estoque e dos pedidos sem depender exclusivamente de webhooks.

**Impacto:** Sprint 8 implementa `CancelExpiredOrdersJob` no módulo de pagamentos.
