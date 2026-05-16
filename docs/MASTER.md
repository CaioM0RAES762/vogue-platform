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
Status: PENDENTE

Prompt para executar:

Leia o SDD.md, o CLAUDE.md, o docs/MASTER.md e o docs/SPRINT-02-HANDOFF.md.
Confirme que entendeu o estado atual em 3 linhas antes de escrever codigo.

Agora execute a Sprint 3 — Banco de Dados:

Implemente o schema Prisma completo seguindo a Secao 12 do SDD.md
e as decisoes D-01, D-02 e D-04 do MASTER.md.

1. prisma/schema.prisma com:
   - Todos os enums: UserRole, ProductStatus, Gender, ProductSize,
     CouponType, OrderStatus, PaymentMethod, PaymentStatus, InventoryMovementType
   - Models do SDD: User, UserAddress, Category, Product, ProductImage,
     ProductVariant, Cart, CartItem, Coupon, Order, OrderItem,
     Payment, InventoryMovement, OrderStatusHistory
   - Models adicionais obrigatorios (D-04): password_reset_tokens, audit_logs, coupon_usages
   - Model adicional (D-02): refresh_tokens
   - Todos os relacionamentos, indices da Secao 24.5, campos unicos e timestamps
   - Campo phone obrigatorio em User (D-06)

2. Seed inicial:
   - Admin via .env (ADMIN_EMAIL, ADMIN_PASSWORD)
   - Categorias base: Vestidos, Blusas, Calcas, Saias, Conjuntos, Acessorios

3. Rodar: prisma validate, prisma generate, prisma migrate dev --name init

4. Se encontrar inconsistencia entre tabelas e regras de negocio:
   pare, documente em docs/DECISIONS.md e so entao continue.

Ao final gere o arquivo docs/SPRINT-03-HANDOFF.md.

---

## SPRINT 4 — AUTENTICACAO
Status: PENDENTE

Prompt para executar:

Leia o SDD.md, o CLAUDE.md, o docs/MASTER.md e o docs/SPRINT-03-HANDOFF.md.
Confirme que entendeu o estado atual em 3 linhas antes de escrever codigo.

Agora execute a Sprint 4 — Autenticacao:

Implemente o modulo de Autenticacao seguindo as Secoes 6.1, 7 e 17 do SDD.md
e as decisoes D-02, D-03, D-06 do MASTER.md.

Backend (apps/api/src/modules/auth/):
- Registro: nome, e-mail, CPF com validacao de digito verificador,
  telefone obrigatorio (D-06), senha, aceite de termos
- Login com resposta generica (nao revelar qual campo esta errado)
- JWT access token 15min em memoria
- Refresh token em cookie HttpOnly 7 dias com rotacao
  armazenado na tabela refresh_tokens como hash SHA-256 (D-02)
- Logout: invalida refresh token no banco e limpa cookie
- Forgot password: gera token UUID na tabela password_reset_tokens TTL 1h via Resend
- Reset password: valida token, troca senha, invalida todos refresh tokens do usuario
- Rate limit: 5 tentativas de login por IP em 15 minutos com @nestjs/throttler + Redis store
- Guard JwtAuthGuard, decorator @CurrentUser(), decorator @Roles()
- Roles: USER e ADMIN

Frontend (apps/web/app/(auth)/):
- Tela de login com validacao em tempo real
- Tela de cadastro com indicador de forca de senha e validacao de CPF
- Tela de recuperacao de senha
- Redirecionamento pos-login: USER para /loja, ADMIN para /admin/dashboard

Testes unitarios em apps/api/src/modules/auth/auth.service.spec.ts:
- AuthService: registro, login, logout, refresh
- Validacao de CPF (algoritmo digito verificador)
- Login com credenciais invalidas
- Rate limit (mock do throttler)
- Role guard

Ao final gere o arquivo docs/SPRINT-04-HANDOFF.md.

---

## SPRINT 5 — PRODUTOS E CATALOGO
Status: PENDENTE

Prompt para executar:

Leia o SDD.md, o CLAUDE.md, o docs/MASTER.md e o docs/SPRINT-04-HANDOFF.md.
Confirme que entendeu o estado atual em 3 linhas antes de escrever codigo.

Agora execute a Sprint 5 — Produtos e Catalogo:

Implemente o modulo de Produtos seguindo as Secoes 6.2.1, 6.2.2, 7, 12, 13 e 24 do SDD.md.

Backend (apps/api/src/modules/products/):
- CRUD admin: criar, editar, ativar/inativar, excluir produto
- Gestao de variantes: product_variants (tamanho x cor x estoque)
- Upload de imagens: multipart para Cloudinary, salvar URLs em product_images
- Listagem publica: apenas produtos ACTIVE
- Filtros: category, sizes[], colors[], min_price, max_price, on_sale, is_new, in_stock
- Ordenacao: price_asc, price_desc, newest, best_sellers, relevance
- Busca por texto nos campos name e tags
- Paginacao cursor-based conforme Secao 24.1 do SDD
- Cache Redis conforme Secao 24.3: products:catalog TTL 2min, products:popular TTL 5min,
  categories:active TTL 1h, product:{id} TTL 10min

Frontend (apps/web/app/(loja)/):
- Tela principal: header fixo, banner rotativo, grid responsivo
  (2 colunas mobile / 3 tablet / 4 desktop)
- Cards: imagem, badge NOVO/OFERTA, nome, preco, preco riscado
- Filtros laterais no desktop e drawer no mobile
- Skeleton loading e estado vazio
- Tela de detalhe: galeria com swipe/zoom, seletor de cor (swatches),
  seletor de tamanho, indicador estoque baixo (5 ou menos unidades),
  seletor de quantidade, simulacao de frete por CEP, produtos relacionados
- Botao Adicionar ao carrinho desabilitado sem tamanho selecionado
- Identidade visual: preto #000000, dourado #C9A84C, Playfair Display nos titulos

Testes unitarios: ProductsService, filtros, paginacao cursor-based, upload Cloudinary (mock).

Ao final gere o arquivo docs/SPRINT-05-HANDOFF.md.

---

## SPRINT 6 — CARRINHO
Status: PENDENTE

Prompt para executar:

Leia o SDD.md, o CLAUDE.md, o docs/MASTER.md e o docs/SPRINT-05-HANDOFF.md.
Confirme que entendeu o estado atual em 3 linhas antes de escrever codigo.

Agora execute a Sprint 6 — Carrinho:

Implemente o modulo de Carrinho seguindo as Secoes 6.2.3, 7, 9, 12 e 13 do SDD.md.

Regra fundamental (CLAUDE.md e MASTER.md):
- Usuario autenticado: carrinho persistido no PostgreSQL (carts + cart_items)
- Convidado: session_id via cookie, tambem persistido no PostgreSQL
- Redis: apenas para cache — NAO para persistir o carrinho

Backend (apps/api/src/modules/cart/):
- GET /api/v1/cart
- POST /api/v1/cart/items (valida estoque)
- PUT /api/v1/cart/items/:id (valida estoque)
- DELETE /api/v1/cart/items/:id
- DELETE /api/v1/cart
- POST /api/v1/cart/coupon com validacoes:
  cupom ativo, nao expirado, nao atingiu max_uses,
  CPF do usuario nao esta em coupon_usages (D-04, RN014),
  subtotal >= min_order_value
- DELETE /api/v1/cart/coupon
- Revalidacao de estoque ao abrir carrinho apos 1h de inatividade (RN021)

Frontend (apps/web/app/(loja)/carrinho/):
- Lista de itens com thumbnail, nome, variante, preco, seletor de quantidade, subtotal, remover
- Aviso inline de estoque baixo (menos de 3 unidades)
- Campo de cupom com feedback de sucesso/erro
- Resumo: subtotal, desconto, campo CEP para frete, total
- Estado vazio com CTA
- Botoes: Continuar comprando e Finalizar compra

Testes unitarios dos cenarios T-CART-01 a T-CART-08 da Secao 23 do SDD.

Ao final gere o arquivo docs/SPRINT-06-HANDOFF.md.

---

## SPRINT 7 — CHECKOUT
Status: PENDENTE

Prompt para executar:

Leia o SDD.md, o CLAUDE.md, o docs/MASTER.md e o docs/SPRINT-06-HANDOFF.md.
Confirme que entendeu o estado atual em 3 linhas antes de escrever codigo.

Agora execute a Sprint 7 — Checkout:

Implemente o modulo de Checkout seguindo as Secoes 6.2.4, 7, 9, 12, 13 e 16 do SDD.md.

Backend (apps/api/src/modules/checkout/):
- POST /api/v1/checkout/shipping-options:
  Recebe CEP + itens, consulta Melhor Envio, retorna opcoes de frete.
  Se Melhor Envio indisponivel: usar FALLBACK_SHIPPING_PRICE do .env (D-08)

- POST /api/v1/checkout:
  1. Validar todos os dados (cliente, endereco, frete, pagamento)
  2. Iniciar transacao Prisma
  3. SELECT FOR UPDATE nas variantes (RN026 — controle de concorrencia)
  4. Verificar estoque novamente dentro da transacao
  5. Criar order com status PENDING
  6. Criar order_items com product_snapshot em JSONB (imutavel)
  7. NAO decrementar estoque ainda (RN004)
  8. Gerar numero do pedido no formato JM-{ANO}{SEQUENCIAL_5DIGITOS} (D-05)
  9. Retornar order_id + dados para criacao do pagamento

- Suporte a guest checkout (RF067):
  coletar nome, e-mail, CPF nos campos guest_* da tabela orders

- Proxy ViaCEP: GET /api/v1/cep/:zipCode

- Se implementar reserva temporaria de estoque:
  documentar a estrategia COMPLETA em docs/DECISIONS.md antes de implementar

Frontend (apps/web/app/(loja)/checkout/):
- Barra de progresso: Dados Pessoais, Entrega, Pagamento, Revisao
- Etapa 1: dados do cliente (preenchimento automatico se logado)
- Etapa 2: endereco com busca ViaCEP + lista de opcoes de frete
- Etapa 3: selecao de forma de pagamento (UI preparada; integracao MP na Sprint 8)
- Etapa 4: revisao completa + botao Finalizar pedido
- Layout: formulario 65% + resumo colapsavel 35%

Testes unitarios: criacao de pedido, concorrencia (mock), snapshot de produto.

Ao final gere o arquivo docs/SPRINT-07-HANDOFF.md.

---

## SPRINT 8 — PAGAMENTOS
Status: PENDENTE

ATENCAO antes de iniciar: Credenciais Mercado Pago sandbox devem estar no .env.
Sem elas esta sprint nao pode ser concluida. Se nao estiverem, pare e informe.

Prompt para executar:

Leia o SDD.md, o CLAUDE.md, o docs/MASTER.md e o docs/SPRINT-07-HANDOFF.md.
Confirme que entendeu o estado atual em 3 linhas antes de escrever codigo.

Verifique se MERCADOPAGO_ACCESS_TOKEN esta no .env antes de continuar.
Se nao estiver, pare e informe que a sprint esta bloqueada.

Agora execute a Sprint 8 — Pagamentos:

Implemente o modulo de Pagamentos seguindo as Secoes 6.2.4, 7, 9, 13, 16 e 17 do SDD.md
e as decisoes D-03, D-09, D-10 do MASTER.md.

Backend (apps/api/src/modules/payments/):

1. Integracao Mercado Pago:
   - PIX: QR Code base64 + codigo copia-e-cola, expiracao 30 minutos
   - Boleto: codigo de barras, vencimento 3 dias uteis
   - Cartao: tokenizacao via SDK do MP no frontend;
     nunca trafegar dados de cartao pelo servidor (RN008)

2. Webhook POST /api/v1/payments/webhook:
   - Validar assinatura HMAC X-Signature com MERCADOPAGO_WEBHOOK_SECRET
   - Idempotencia: se payment.external_id ja esta APPROVED, ignorar
   - Pagamento APPROVED:
     BEGIN TRANSACTION
     UPDATE orders SET status = PAID
     UPDATE payments SET status = APPROVED, paid_at = now()
     Para cada order_item: UPDATE product_variants SET stock = stock - quantity
     INSERT inventory_movements (type: SALE)
     COMMIT
     Adicionar job na fila emailQueue: order-confirmed
   - PIX/Boleto CANCELLED ou EXPIRED:
     UPDATE orders SET status = CANCELLED
     Reverter estoque de todas as variantes
     INSERT inventory_movements (type: CANCELLATION)
   - Responder sempre 200 OK para evitar retries desnecessarios

3. Bull cron job (D-10) CancelExpiredOrdersJob:
   Roda a cada 5 minutos.
   Busca pedidos PENDING com expires_at menor que now().
   Cancela e reverte estoque.

4. Frontend: polling de 5 segundos (D-03) enquanto pedido PENDING
   GET /api/v1/orders/:id, se status mudou para PAID redirecionar para confirmacao.

5. Tela de PIX: QR Code + codigo copia-e-cola + contador regressivo 30min
   (vermelho quando menos de 5 minutos restantes)

Testes: T-PAG-01 a T-PAG-06 e T-EST-01 a T-EST-03 da Secao 23 do SDD.

Ao final gere o arquivo docs/SPRINT-08-HANDOFF.md.

---

## SPRINT 9 — MINHA CONTA
Status: PENDENTE

Prompt para executar:

Leia o SDD.md, o CLAUDE.md, o docs/MASTER.md e o docs/SPRINT-08-HANDOFF.md.
Confirme que entendeu o estado atual em 3 linhas antes de escrever codigo.

Agora execute a Sprint 9 — Area do Cliente (Minha Conta):

Implemente a area Minha Conta seguindo as Secoes 6.2.5 e 7 do SDD.md.

Backend (apps/api/src/modules/users/):
- GET /api/v1/users/me
- PUT /api/v1/users/me (editar nome e telefone; CPF nao editavel)
- GET, POST, PUT, DELETE /api/v1/users/me/addresses
- PATCH /api/v1/users/me/addresses/:id/default
- GET /api/v1/users/me/orders com filtros
- GET /api/v1/orders/:id
- POST /api/v1/orders/:id/cancel (status PENDING ou PAID apenas, D-07)
- DELETE /api/v1/users/me (exclusao LGPD, RN023):
  anonimizar dados pessoais, manter pedidos por 5 anos

Frontend (apps/web/app/(loja)/minha-conta/):
- Layout: sidebar de navegacao (desktop) + tabs (mobile)
- Secao Dados Pessoais: visualizar e editar com Zod
- Secao Enderecos: lista + formulario com ViaCEP
- Secao Pedidos: tabela com numero, data, total, status
- Tela de detalhe do pedido: itens, endereco, historico de status, rastreamento
- Botao cancelar pedido visivel apenas para PENDING e PAID
- Toda a area protegida: redirecionar para /auth/login se nao autenticado

Ao final gere o arquivo docs/SPRINT-09-HANDOFF.md.

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
Sprint 3:  Banco de Dados         — PENDENTE
Sprint 4:  Autenticacao           — PENDENTE
Sprint 5:  Produtos e Catalogo    — PENDENTE
Sprint 6:  Carrinho               — PENDENTE
Sprint 7:  Checkout               — PENDENTE
Sprint 8:  Pagamentos             — PENDENTE (requer credenciais MP sandbox)
Sprint 9:  Minha Conta            — PENDENTE
Sprint 10: Painel Admin           — PENDENTE
Sprint 11: Relatorios             — PENDENTE
Sprint 12: Testes E2E + Deploy    — PENDENTE

---

Documento gerado para uso exclusivo no projeto Janaina Modas. Versao 1.0.