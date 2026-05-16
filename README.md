# Janaina Modas — Loja Virtual

Plataforma de e-commerce de moda feminina. Monorepo com Next.js 14 (frontend) e NestJS (backend).

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Shadcn/UI |
| Backend | NestJS, TypeScript, Prisma ORM |
| Banco | PostgreSQL 16 |
| Cache / Filas | Redis 7 + Bull |
| Pagamento | Mercado Pago |
| Imagens | Cloudinary |
| Frete | Melhor Envio |
| E-mail | Resend |
| Monitoramento | Sentry |

---

## Pré-requisitos

- Node.js >= 20
- pnpm >= 9 (`npm install -g pnpm`)
- Docker + Docker Compose

---

## Setup inicial

### 1. Clone e instale dependências

```bash
git clone <repo-url>
cd janainamoda
pnpm install
```

### 2. Configure variáveis de ambiente

```bash
cp .env.example .env
# Edite .env com suas credenciais reais
```

### 3. Suba os serviços de infraestrutura

```bash
docker compose up -d
```

Isso sobe:
- PostgreSQL 16 em `localhost:5432`
- Redis 7 em `localhost:6379`

Verifique que estão saudáveis:

```bash
docker compose ps
```

### 4. Configure o banco de dados

```bash
# Gerar o cliente Prisma
pnpm prisma:generate

# Rodar migrations (após Sprint 3)
pnpm prisma:migrate:dev
```

---

## Execução em desenvolvimento

### Rodar API e frontend separadamente (recomendado)

```bash
# Terminal 1 — Backend NestJS (porta 3001)
pnpm dev:api

# Terminal 2 — Frontend Next.js (porta 3000)
pnpm dev:web
```

### URLs locais

| Serviço | URL |
|---|---|
| Frontend (Loja) | http://localhost:3000 |
| Backend (API) | http://localhost:3001/api/v1 |
| Prisma Studio | http://localhost:5555 (via `pnpm prisma:studio`) |

---

## Estrutura do Monorepo

```
janainamoda/
├── apps/
│   ├── api/              # NestJS — API REST
│   │   ├── src/
│   │   │   ├── modules/  # Módulos de negócio
│   │   │   ├── config/   # Configuração tipada
│   │   │   └── common/   # Logger, filtros, guards
│   │   └── prisma/       # Schema e migrations
│   └── web/              # Next.js 14 — Frontend
│       ├── app/
│       │   ├── (loja)/   # Rotas da loja
│       │   ├── auth/     # Autenticação
│       │   └── admin/    # Painel administrativo
│       └── components/   # Componentes UI
├── packages/
│   └── shared/           # Tipos, enums e schemas Zod compartilhados
├── docs/                 # Documentação do projeto
├── docker-compose.yml
├── .env.example
└── pnpm-workspace.yaml
```

---

## Comandos úteis

```bash
# Formatação
pnpm format

# Lint
pnpm lint

# Testes
pnpm test

# Prisma Studio (GUI do banco)
pnpm prisma:studio

# Parar containers Docker
docker compose down

# Parar e remover volumes (reset completo do banco)
docker compose down -v
```

---

## Documentação

- [SDD.md](./SDD.md) — Software Design Document (fonte da verdade)
- [CLAUDE.md](./CLAUDE.md) — Regras do projeto para o Claude Code
- [docs/MASTER.md](./docs/MASTER.md) — Guia de execução das sprints
- [docs/DECISIONS.md](./docs/DECISIONS.md) — Decisões técnicas tomadas

---

## Identidade Visual

| Token | Cor | Hex |
|---|---|---|
| `brand-black` | Preto | `#000000` |
| `brand-gold` | Dourado | `#C9A84C` |
| `brand-white` | Branco | `#FFFFFF` |
| `brand-gray-light` | Cinza Claro | `#F5F5F5` |
| Fonte Títulos | Playfair Display | — |
| Fonte Corpo | Inter | — |
