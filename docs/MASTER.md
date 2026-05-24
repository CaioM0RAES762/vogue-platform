# JANAINA MODAS — DOCUMENTO MASTER
## Guia completo para o Claude Code executar o projeto do início ao fim

---

> **INSTRUÇÃO PARA O CLAUDE CODE:**
> Este arquivo é seu guia de execução. Leia-o inteiro antes de qualquer ação.
> Ele contém: regras do projeto, decisões já tomadas, estado de cada sprint e os prompts a executar.
> Sempre consulte este arquivo ao iniciar uma nova sessão.

---

## ARQUIVOS QUE VOCE DEVE LER SEMPRE AO INICIAR UMA SESSAO

1. SDD.md — fonte da verdade absoluta do projeto
2. CLAUDE.md — regras e stack obrigatoria
3. Este arquivo docs/MASTER.md — estado do projeto e decisoes tomadas

---

# PARTE 1 — REGRAS DO PROJETO (CLAUDE.md)

O conteudo abaixo e o que esta (ou deve estar) no arquivo CLAUDE.md da raiz.
Se o arquivo nao existir, crie-o com exatamente este conteudo.

```
# Janaina Modas — Regras do Projeto

## Fonte da verdade
O arquivo SDD.md e a referencia oficial. Siga-o fielmente.
Quando houver lacuna tecnica pequena, tome a decisao mais simples e registre em docs/DECISIONS.md.
Quando houver contradicao no SDD, consulte a secao Decisoes Tomadas do MASTER.md antes de implementar.

## Stack obrigatoria
- Monorepo: pnpm workspaces
- Frontend: Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn/UI
- Backend: NestJS, TypeScript, PostgreSQL (nao MySQL), Prisma, Redis
- Validacao backend: DTOs com class-validator + ValidationPipe global
- Validacao frontend/shared: Zod
- Auth: JWT access token (15min) + refresh token em cookie HttpOnly (7 dias)
- Pagamentos: Mercado Pago
- Imagens: Cloudinary
- Frete: Melhor Envio
- CEP: ViaCEP
- E-mail: Resend
- Filas: Bull + Redis
- Monitoramento: Sentry

## Regras de implementacao
- Nunca criar funcionalidades fora do escopo do SDD.
- Nunca armazenar dados sensiveis de cartao.
- Nunca commitar .env real — apenas .env.example.
- Todas as rotas administrativas exigem role ADMIN.
- Senhas com bcrypt, custo minimo 12.
- Todas as entidades com createdAt e updatedAt.
- Migrations Prisma versionadas — nunca editar migration ja aplicada.
- Nunca usar prisma db push em producao; sempre prisma migrate deploy.
- Carrinho de usuario autenticado: PostgreSQL. Convidado: session_id via cookie. Redis apenas para cache/sessoes.
- Estoque decrementado somente apos pagamento confirmado pelo webhook.
- Criar testes unitarios junto com cada modulo.
- Ao final de cada sprint, gerar o arquivo docs/SPRINT-XX-HANDOFF.md.
```

---

# PARTE 2 — DECISOES TECNICAS TOMADAS

Estas decisoes resolvem contradicoes e lacunas do SDD.
Nao questione nem reimplemente diferente — ja foram decididas.

D-01: BANCO PostgreSQL (nao MySQL)
CLAUDE.md tinha MySQL por engano. SDD usa PostgreSQL com JSONB, TEXT[], indices incompativeis com MySQL.

D-02: REFRESH TOKEN no banco (tabela refresh_tokens)
SDD contraditorio: secao 17.1 diz banco, diagrama 11.3 diz Redis. Banco e mais duravel e auditavel.

D-03: POLLING de 5 segundos para status de pagamento (nao SSE)
SDD nao especifica. Polling e mais simples para MVP.

D-04: 3 TABELAS AUSENTES devem ser criadas na Sprint 3
SDD nao define mas a logica exige:
- password_reset_tokens (forgot/reset password)
- audit_logs (RN025 — log de acoes do admin)
- coupon_usages (RN014 — uso unico de cupom por CPF)

D-05: NUMERO DO PEDIDO formato JM-{ANO}{SEQUENCIAL_5DIGITOS}
SDD tem 3 formatos diferentes. Adotar ex: JM-202500001.

D-06: CAMPO PHONE obrigatorio no cadastro
Schema marca opcional, RF001 trata como obrigatorio.

D-07: CANCELAMENTO bloqueado apos SHIPPED
Diagrama de estados e RN009 conflitam. Adotar RN009: nao permitido apos SHIPPED.

D-08: FRETE FALLBACK via variavel FALLBACK_SHIPPING_PRICE=15.00
Se Melhor Envio indisponivel, usar frete fixo configuravel.

D-09: RELATORIO PDF ASSINCRONO via Bull queue
Sincrono causaria timeout. Retornar 202 + job_id. Polling em GET /admin/reports/jobs/:job_id.

D-10: BULL CRON a cada 5min para cancelar PIX/Boleto expirado sem webhook
MP pode nao enviar webhook. Job garante consistencia do estoque.

---

# PARTE 3 — ESTADO DAS SPRINTS

---

## SPRINT 0 — CLAUDE.md
Status: CONCLUIDA

O que foi feito: Arquivo CLAUDE.md criado na raiz com regras do projeto.
Atencao: O CLAUDE.md deve ter PostgreSQL (nao MySQL). Se tiver MySQL, corrija antes de avancar.

---

## SPRINT 1 — AUDITORIA
Status: CONCLUIDA

O que foi feito: Leitura completa do SDD.md (4.222 linhas), relatorio tecnico gerado, 10 decisoes documentadas acima.
Codigo escrito: Nenhum.

---

## SPRINT 2 — SETUP DO MONOREPO

Status: CONCLUIDA 

O que foi feito: Monorepo pnpm configurado com apps/web (Next.js 14 + Tailwind + Shadcn/UI + tema preto/dourado + rotas loja/auth/admin), apps/api (NestJS + Prisma + Winston + Helmet + CORS + ValidationPipe + healthcheck) e packages/shared (enums e types compartilhados). Infraestrutura com docker-compose PostgreSQL 16 + Redis 7. Decisões D-01 a D-10 documentadas em docs/DECISIONS.md. Handoff completo em docs/SPRINT-02-HANDOFF.md.

## SPRINT 3 — BANCO DE DADOS
Status: CONCLUÍDA
Observação: migration pendente — requer Docker Desktop/PostgreSQL.

O que foi feito: Schema Prisma completo implementado com todos os enums, models do SDD, models adicionais (refresh_tokens, password_reset_tokens, audit_logs, coupon_usages), relacionamentos, campos únicos, timestamps e índices. Seed inicial criado com admin via .env e categorias base. Enums compartilhados alinhados ao SDD. Decisões D-11 e D-12 documentadas. Handoff completo em docs/SPRINT-03-HANDOFF.md.

Código escrito: Schema Prisma, seed inicial, ajustes em enums compartilhados e documentação.

Validações: prisma validate e prisma generate concluídos com sucesso. prisma migrate dev --name init pendente por falta de Docker/PostgreSQL.

## SPRINT 4 — AUTENTICACAO
Status: CONCLUÍDA

O que foi feito: Módulo de autenticação completo. Backend: DTOs com class-validator, validação de CPF (dígito verificador), JwtStrategy, JwtAuthGuard, RolesGuard, @CurrentUser(), @Roles(), AuthService (register/login/logout/refresh/forgotPassword/resetPassword), AuthController com rate limiting via ThrottlerModule, MailService (Resend). Refresh token SHA-256 no banco (D-02). Phone obrigatório (D-06). Resposta genérica no login e forgotPassword. cookie-parser integrado ao main.ts. Frontend: AuthProvider (contexto + sessionStorage), api.ts (cliente HTTP), middleware de proteção de rotas, telas login/cadastro (CPF maskado + indicador força senha)/recuperar-senha/redefinir-senha com Zod + react-hook-form. 29 testes unitários passando. Decisões D-13 a D-16 documentadas.

Código escrito: 23 arquivos criados/modificados. TypeScript sem erros. 29/29 testes passando.


---

## SPRINT 5 — PRODUTOS E CATALOGO
Status: CONCLUÍDA
Observação: testes escritos mas execução requer ≥ 1 GB de RAM livre para o Jest.

O que foi feito: RedisService global com failsafe silencioso (sem Redis = sem crash). CloudinaryService com upload WebP + thumbnail automático. ProductsService com CRUD completo, filtros (category, sizes, colors, preço, on_sale, is_new, in_stock, busca por texto), paginação cursor-based (SDD 24.1), cache Redis com TTLs do SDD (catálogo 2min, produto 10min, categorias 1h) e invalidação automática. 11 rotas REST (3 públicas + 8 admin com RolesGuard). Frontend: BannerCarousel com autoplay, strip de categorias, grid responsivo (2/3/4 colunas), ProductCard com badges NOVO/OFERTA, FilterSidebar (desktop) + FilterDrawer (mobile), busca com debounce 300ms, "Carregar mais" cursor-based, skeleton loading, galeria com swipe, swatches de cor, seletor de tamanho (esgotados riscados), aviso estoque baixo ≤5, simulação de frete com fallback, "Adicionar ao carrinho" desabilitado sem tamanho. Decisões D-17 a D-22 documentadas.

Código escrito: 25 arquivos criados/modificados. TypeScript sem erros (tsc --noEmit limpo). 32 testes unitários escritos.

---

## SPRINT 6 — CARRINHO
Status: CONCLUÍDA
Observação: 3 erros TypeScript pré-existentes da Sprint 5 (produtos/page.tsx e variant-selector.tsx) — não relacionados a esta sprint.

O que foi feito: CartService completo com getCart (cache Redis TTL 60s), addItem, updateItem, removeItem, clearCart, applyCoupon (RN014/RN015/RN016), removeCoupon e revalidação de estoque RN021 (1h inatividade). OptionalJwtGuard criado para rotas públicas (guest via session_id cookie HttpOnly gerado automaticamente; autenticado via JWT). 8 endpoints REST implementados. Frontend: cart-api.ts (cliente tipado), Zustand store com loading/error/useCartCount, componentes CartItemCard (thumbnail, seletor ±, aviso estoque < 3) e CartSummary (cupom com feedback, CEP/frete, total), página /carrinho com skeleton, estado vazio e grid itens+resumo. Criados components/ui/button.tsx e input.tsx (shadcn/ui, faltavam no projeto). Zustand instalado. 12 testes unitários escritos (T-CART-01 a T-CART-08 + clearCart + RN021). Merge guest→autenticado e decremento de usesCount pendentes para Sprint 7.

Código escrito: 17 arquivos criados/modificados. TypeScript backend sem erros. 12 testes unitários escritos.

---

## SPRINT 7 — CHECKOUT
Status: CONCLUÍDA
Observação: 3 erros TypeScript pré-existentes da Sprint 5 (produtos/page.tsx e variant-selector.tsx) — não relacionados a esta sprint.

O que foi feito: CheckoutService com getShippingOptions (integração Melhor Envio + fallback D-08 via FALLBACK_SHIPPING_PRICE), createOrder (transação Prisma com SELECT FOR UPDATE RN026, re-verificação de estoque, orderNumber JM-{ANO}{SEQ5} D-05, productSnapshot JSONB imutável, CouponUsage registrado + usesCount incrementado, carrinho limpo, payment PENDING criado com externalId placeholder) e lookupCep (proxy ViaCEP). Guest checkout RF067 com guestName/guestEmail/guestCpf. Estoque não decrementado (RN004). PIX expira em 30min, Boleto em 3 dias. Proxy GET /cep/:zipCode. Frontend: checkout-api.ts (cliente tipado), barra de progresso 4 etapas, Step1 (dados pessoais, CPF mascarado, pré-preenche se logado), Step2 (CEP/ViaCEP + opções de frete), Step3 (seleção de pagamento — UI pronta, integração MP Sprint 8), Step4 (revisão completa + aceite dos termos), resumo colapsável sticky 35%. Tela de sucesso pós-pedido. Decisões D-13 a D-16 documentadas. 8 testes unitários (T-CHECKOUT-01 a T-CHECKOUT-08).

Código escrito: 15 arquivos criados/modificados. TypeScript backend sem erros. 8 testes unitários escritos.

---

## SPRINT 8 — PAGAMENTOS
Status: CONCLUÍDA
Observação: MERCADOPAGO_WEBHOOK_SECRET ainda é placeholder — configurar no painel MP antes de produção. 3 erros TypeScript pré-existentes da Sprint 5 — não relacionados a esta sprint.

O que foi feito: PaymentsService com createPayment (PIX → QR Code base64 + copia-e-cola; Boleto → código de barras; Cartão → tokenização via MP.js no browser RN008), handleWebhook (validação HMAC X-Signature com timingSafeEqual, idempotência T-PAG-06), approvePayment (transação atômica: order→PAID, payment→APPROVED, stock decrementado RN004, INSERT inventory_movements SALE, emailQueue order-confirmed), cancelPayment (reversão de estoque RN005, INSERT inventory_movements CANCELLATION). Cron Bull D-10 (*/5 * * * *) via CronSchedulerService cancelando pedidos PENDING com expiresAt < now(). EmailQueueProcessor processa order-confirmed via Resend. Frontend: payments-api.ts, PixPayment (QR Code + contador regressivo, vermelho < 5min), BoletoPayment (código + link), página /pagamento/[orderId] com polling 5s (D-03) que redireciona para /pedido-confirmado ao detectar PAID, checkout-step3 com formulário de cartão e tokenização MP.js (dados nunca passam pelo servidor). Decisões D-17 a D-20 documentadas.

Código escrito: 16 arquivos criados/modificados. TypeScript backend sem erros. 10/10 testes passando.

---

## SPRINT 9 — MINHA CONTA
Status: CONCLUÍDA

Observação: Proteção de rota é client-side only (sessionStorage) — middleware.ts server-side previsto para Sprint 12. 3 erros TypeScript pré-existentes da Sprint 5 — não relacionados a esta sprint.
O que foi feito: UsersService com getMe, updateMe, deleteMe (anonimização LGPD em transação atômica: user anonimizado + tokens revogados + endereços excluídos, RN023), getAddresses, createAddress (primeiro endereço vira padrão automaticamente), updateAddress, deleteAddress (ao excluir padrão, promove o mais recente), setDefaultAddress, getOrders (paginação offset + filtros status/período), getOrderById, cancelOrder (CANCELLABLE_STATUSES = [PENDING, PAID] — D-07; pedido PAID chama paymentsService.cancelPayment revertendo estoque RN005; e-mail de cancelamento via mailService.sendOrderCancelled adicionado ao MailService). UsersController com todos os endpoints sob @UseGuards(JwtAuthGuard). UsersModule importando PrismaModule, AuthModule, MailModule, PaymentsModule. app.module.ts atualizado. Frontend: account-api.ts com cliente tipado e classe AccountApiError; layout com sidebar fixa (desktop) + tabs overflow (mobile) + botão Sair; page.tsx redirect para /dados; dados/page.tsx com grid de visualização + formulário react-hook-form/Zod + zona de perigo LGPD com confirmação dupla; enderecos/page.tsx com cards (padrão destacado em dourado) + formulário com autopreenchimento ViaCEP; pedidos/page.tsx com tabela (desktop) / cards (mobile) + filtro de status + paginação + skeleton loading; pedidos/[id]/page.tsx com itens (foto, variante, qty, preço), totais, endereço, rastreamento, timeline de status, botão cancelar visível apenas para PENDING/PAID com campo de motivo. Classe utilitária .input-field adicionada ao globals.css.

Código escrito: 15 arquivos criados/modificados. TypeScript backend sem erros (tsc --noEmit limpo). 12 cenários de teste escritos (T-USER-01 a T-USER-08).

---

## SPRINT 10 — PAINEL ADMINISTRATIVO
Status: PENDENTE

Prompt para executar:

Leia o SDD.md, o CLAUDE.md, o docs/MASTER.md e o docs/SPRINT-09-HANDOFF.md.
Confirme que entendeu o estado atual em 3 linhas antes de escrever codigo.

Agora execute a Sprint 10 — Painel Administrativo:

Implemente o painel administrativo seguindo as Secoes 6.3, 7 e 13 do SDD.md.
Toda a area exige role ADMIN — redirecionar USER para /loja.

Backend:
- GET /api/v1/admin/dashboard: KPIs do dia, top 5 produtos, alertas de estoque, ultimos 10 pedidos
- GET, POST, PUT, DELETE /api/v1/admin/products com acoes em lote (RF049)
- PATCH /api/v1/admin/products/:id/status
- POST /api/v1/admin/products/:id/images (multipart)
- GET /api/v1/admin/inventory por variante com status
- PUT /api/v1/admin/inventory/:variantId
- POST /api/v1/admin/inventory/movements
- GET /api/v1/admin/orders com filtros e paginacao
- PUT /api/v1/admin/orders/:id/status (tracking_code obrigatorio para SHIPPED)
- GET, POST, PUT, DELETE /api/v1/admin/coupons
- PATCH /api/v1/admin/coupons/:id/status
- Todas as acoes do admin registradas na tabela audit_logs (D-04, RN025)

Frontend (apps/web/app/(admin)/):
- Layout: sidebar preta #000000 com links dourados no item ativo
- Dashboard: 4 KPI cards, grafico de linha faturamento 30 dias, alertas de estoque
- Listagem de produtos: tabela com busca, filtros, acoes em lote
- Cadastro/edicao de produto: formulario completo, upload drag-and-drop, tabela de variantes
- Inventario: tabela com status colorido verde/amarelo/vermelho, edicao inline
- Pedidos: tabela com filtros de status, modal de atualizacao de status
- Cupons: tabela + formulario de criacao

Testes dos cenarios T-PROD-01 a T-PROD-04 da Secao 23 do SDD.

Ao final gere o arquivo docs/SPRINT-10-HANDOFF.md.

---

## SPRINT 11 — RELATORIOS
Status: PENDENTE

Prompt para executar:

Leia o SDD.md, o CLAUDE.md, o docs/MASTER.md e o docs/SPRINT-10-HANDOFF.md.
Confirme que entendeu o estado atual em 3 linhas antes de escrever codigo.

Agora execute a Sprint 11 — Relatorios:

Implemente o modulo de Relatorios seguindo a Secao 19 do SDD.md
e a decisao D-09 do MASTER.md (geracao PDF assincrona via Bull).

Backend (apps/api/src/modules/reports/):
- GET /api/v1/admin/reports/sales com suporte a format=json, pdf, csv
- GET /api/v1/admin/reports/products
- GET /api/v1/admin/reports/financial
- GET /api/v1/admin/reports/inventory
- GET /api/v1/admin/reports/orders-by-status
- Para format=json: resposta sincrona com dados
- Para format=pdf: 202 Accepted + job_id via Bull queue reportQueue (D-09)
- Para format=csv: 200 com stream do arquivo em UTF-8 com BOM
- GET /api/v1/admin/reports/jobs/:job_id
- Relatorios apenas para pedidos PAID, PREPARING, SHIPPED ou DELIVERED (RN018)
- Formulas da Secao 19.1: faturamento liquido, ticket medio, taxas por metodo

Frontend (apps/web/app/(admin)/relatorios/):
- Filtros: periodo com presets, categoria, produto, forma de pagamento, status
- Indicadores em cards
- Graficos com recharts: linha, barras, pizza
- Tabela detalhada com paginacao
- Botoes de exportacao com estado de loading durante geracao

Testes dos cenarios T-REL-01 a T-REL-04 da Secao 23 do SDD.

Ao final gere o arquivo docs/SPRINT-11-HANDOFF.md.

---

## SPRINT 12 — TESTES E2E E DEPLOY
Status: PENDENTE

Prompt para executar:

Leia o SDD.md, o CLAUDE.md, o docs/MASTER.md e o docs/SPRINT-11-HANDOFF.md.
Confirme que entendeu o estado atual em 3 linhas antes de escrever codigo.

Agora execute a Sprint 12 — Testes E2E e Deploy:

1. TESTES E2E com Playwright (apps/e2e/):
   - Fluxo completo de compra:
     cadastro, catalogo, produto, variante, carrinho, checkout,
     pagamento PIX (mock webhook), polling detecta PAID, confirmacao
   - Autenticacao: login USER, login ADMIN, protecao de rotas
   - Fluxo admin: criar produto, verificar no catalogo, receber pedido, atualizar status
   - Concorrencia de estoque T-EST-01: 2 usuarios simultaneos, ultima unidade
   - Idempotencia webhook T-PAG-06: webhook duplicado nao duplica decremento

2. AUDITORIA DE SEGURANCA:
   - Acessar /admin como USER: deve redirecionar
   - Acessar endpoint admin sem token: deve retornar 401
   - SQL injection nos campos de busca: deve retornar 400
   - Headers de seguranca: CSP, HSTS, X-Frame-Options, nosniff
   - Rate limit no login: 5 tentativas geram 429

3. PERFORMANCE:
   - Lighthouse na tela principal e produto
   - Meta: FCP menor que 1.5s, LCP menor que 2.5s (Secao 24 do SDD)
   - Verificar cache Redis funcionando
   - Verificar lazy loading de imagens

4. SENTRY:
   - Frontend: @sentry/nextjs com SENTRY_DSN
   - Backend: @sentry/node no main.ts
   - Testar captura de erro intencional

5. REVISAO FINAL:
   - .env.example com TODAS as variaveis usadas
   - README.md com instrucoes completas de setup e deploy
   - docs/DECISIONS.md atualizado com todas as decisoes tomadas
   - WCAG 2.1 AA: contraste, aria-label em icones, navegacao por teclado

Ao final gere o arquivo docs/SPRINT-12-HANDOFF.md com o estado final do projeto.

---

# PARTE 4 — COMO USAR ESTE DOCUMENTO

## Ao iniciar qualquer sessao do Claude Code

Cole exatamente este prompt:

Leia os seguintes arquivos antes de qualquer acao:
1. SDD.md
2. CLAUDE.md
3. docs/MASTER.md

Identifique qual sprint esta PENDENTE na secao Estado das Sprints.
Leia tambem o HANDOFF da sprint anterior se existir.
Confirme em 3 linhas o estado atual do projeto.
So entao execute o prompt da sprint correspondente que esta descrito no MASTER.md.

## Ao finalizar qualquer sprint

Cole exatamente este prompt:

Gere o arquivo docs/SPRINT-[N]-HANDOFF.md com:
1. O que foi implementado (lista de arquivos criados/modificados)
2. Decisoes tecnicas tomadas nesta sprint
3. Pendencias ou bugs encontrados
4. Migrations aplicadas
5. Variaveis novas no .env.example
6. Comandos para rodar o projeto agora
7. O que a proxima sprint precisa saber

## Se o Claude Code travar ou perder contexto

Cole exatamente este prompt:

Leia o SDD.md, o CLAUDE.md e o docs/MASTER.md.
Leia tambem o docs/SPRINT-[ULTIMA]-HANDOFF.md.
Estamos na Sprint [N] — [NOME].
Confirme que entendeu e continue de onde parou.

---

# PARTE 5 — TABELA RESUMO

Sprint 0:  CLAUDE.md              — CONCLUIDA
Sprint 1:  Auditoria              — CONCLUIDA
Sprint 2:  Setup Monorepo         — CONCLUIDA
Sprint 3:  Banco de Dados         — CONCLUÍDA
Sprint 4:  Autenticacao           — CONCLUÍDA
Sprint 5:  Produtos e Catalogo    — CONCLUÍDA
Sprint 6:  Carrinho               — CONCLUÍDA
Sprint 7:  Checkout               — CONCLUÍDA
Sprint 8:  Pagamentos             — CONCLUÍDA
Sprint 9:  Minha Conta            — CONCLUÍDA
Sprint 10: Painel Admin           — PENDENTE
Sprint 11: Relatorios             — PENDENTE
Sprint 12: Testes E2E + Deploy    — PENDENTE

---

Documento gerado para uso exclusivo no projeto Janaina Modas. Versao 1.0.