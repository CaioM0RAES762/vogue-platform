# SPRINT 04 — HANDOFF: Autenticação

**Data de conclusão:** 2026-05-17
**Status:** CONCLUÍDA
**Testes:** 29/29 passando

---

## 1. O que foi implementado

### Backend — `apps/api/src/modules/auth/`

| Arquivo | Descrição |
|---|---|
| `validators/is-cpf.validator.ts` | Algoritmo completo de dígito verificador CPF + decorator `@IsCpf()` |
| `dto/register.dto.ts` | Registro: nome, e-mail, CPF, telefone (D-06), senha, acceptTerms |
| `dto/login.dto.ts` | Login: e-mail + senha |
| `dto/forgot-password.dto.ts` | Recuperação de senha: e-mail |
| `dto/reset-password.dto.ts` | Redefinição: token + nova senha |
| `strategies/jwt.strategy.ts` | JwtStrategy (passport-jwt), payload `{ sub, email, role }`, interface `AuthUser` |
| `guards/jwt-auth.guard.ts` | JwtAuthGuard — herda de `AuthGuard('jwt')` |
| `guards/roles.guard.ts` | RolesGuard — verifica `@Roles()` via Reflector, lança ForbiddenException |
| `decorators/current-user.decorator.ts` | `@CurrentUser()` — extrai `req.user` (AuthUser) |
| `decorators/roles.decorator.ts` | `@Roles(...roles)` + enum `Role.USER / Role.ADMIN` |
| `auth.service.ts` | register, login, logout, refresh, forgotPassword, resetPassword |
| `auth.controller.ts` | POST /auth/register, /login, /refresh, /logout, /forgot-password, /reset-password |
| `auth.module.ts` | AuthModule com JwtModule, PassportModule, PrismaModule, MailModule |
| `auth.service.spec.ts` | **29 testes unitários** (CPF, register, login, logout, refresh, forgotPassword, resetPassword, RolesGuard) |

### Backend — `apps/api/src/modules/mail/`

| Arquivo | Descrição |
|---|---|
| `mail.service.ts` | MailService com Resend — envia e-mail HTML de recuperação de senha |
| `mail.module.ts` | MailModule exportado para AuthModule |

### Arquivos atualizados

| Arquivo | O que mudou |
|---|---|
| `apps/api/src/app.module.ts` | Adicionados `ThrottlerModule` (in-memory, 100 req/min) e `AuthModule` |
| `apps/api/src/main.ts` | Adicionado `cookie-parser` com `COOKIE_SECRET` |
| `apps/api/src/config/env.validation.ts` | Adicionados `RESEND_API_KEY` (opcional) e `FRONTEND_URL` (opcional) |

### Frontend — `apps/web/`

| Arquivo | Descrição |
|---|---|
| `lib/api.ts` | Cliente HTTP tipado (`authApi` — register, login, logout, refresh, forgotPassword, resetPassword) |
| `lib/auth-context.tsx` | `AuthProvider` + `useAuth()` — token em memória (sessionStorage), renovação automática via cookie |
| `middleware.ts` | Proteção de rotas: `/auth/*`, `/minha-conta/*`, `/checkout/*`, `/admin/*` |
| `app/layout.tsx` | `AuthProvider` wrapping toda a aplicação |
| `app/auth/login/page.tsx` | Formulário com react-hook-form + Zod, redirecionamento USER→/loja, ADMIN→/admin/dashboard |
| `app/auth/cadastro/page.tsx` | Formulário completo: CPF com máscara e validação, indicador de força de senha (5 segmentos), telefone obrigatório |
| `app/auth/recuperar-senha/page.tsx` | Formulário + estado "enviado" com mensagem genérica (SDD 6.1.3) |
| `app/auth/redefinir-senha/page.tsx` | Lê `?token=` da URL, valida nova senha, estado de sucesso |

---

## 2. Decisões técnicas tomadas nesta sprint

### D-13 — `crypto.randomUUID()` em vez de pacote `uuid`
O pacote `uuid@14` é ESM-only e causava falha no Jest (CommonJS). Substituído por `crypto.randomUUID()` nativo do Node.js 15+ — mesmo formato UUID v4, sem dependência extra. Nenhum impacto funcional.

### D-14 — ThrottlerModule em memória para desenvolvimento
O SDD 17.7 especifica Redis store para o throttler. Para o ambiente de desenvolvimento (sem Docker), o `ThrottlerModule` usa store em memória. Em produção, substituir por:
```typescript
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
// ... storage: new ThrottlerStorageRedisService(redisClient)
```

### D-15 — Campo `token` na tabela `password_reset_tokens`
O schema Prisma (Sprint 3) usa o campo `token` (não `tokenHash`) para armazenar o hash SHA-256 do token de reset. O AuthService armazena o hash neste campo e jamais o valor bruto.

### D-16 — Refresh token cookie path `/api/v1/auth`
O cookie `refresh_token` tem `path: '/api/v1/auth'` para limitar o escopo de envio automático pelo browser apenas para os endpoints de autenticação, reduzindo superfície de ataque CSRF.

---

## 3. Fluxo de segurança implementado

```
Registro      → hash SHA-256 (cpf strip mask) → bcrypt cost 12 (senha) → RefreshToken (hash SHA-256 em DB)
Login         → mensagem genérica ("Credenciais inválidas") → cookie HttpOnly SameSite=Strict
Refresh       → valida hash do cookie → rotação (delete old, create new)
Logout        → deleteMany por hash → clearCookie
ForgotPwd     → mensagem genérica → hash SHA-256 do UUID em password_reset_tokens
ResetPwd      → valida token + TTL 1h + usedAt null → update senha → deleteMany refresh_tokens (RF008)
```

---

## 4. Pendências e observações

### ⚠️ Migration ainda não aplicada
A migration da Sprint 3 (`init`) ainda não foi rodada — requer Docker Desktop. Os tokens de auth **não podem ser testados** sem banco de dados rodando.

### ⚠️ ThrottlerModule precisa de Redis em produção
Configurar `@nest-lab/throttler-storage-redis` antes do deploy para garantir rate limiting distribuído entre instâncias (SDD 17.7).

### ⚠️ RESEND_API_KEY necessária para e-mails
Sem `RESEND_API_KEY` no `.env`, o `sendPasswordReset` loga o erro mas não propaga — a recuperação de senha falha silenciosamente. Em produção, esta variável é obrigatória.

### FRONTEND_URL
A URL do link de reset senha no e-mail usa `FRONTEND_URL` da env (padrão: `http://localhost:3000`). Atualizar para o domínio de produção antes do deploy.

---

## 5. Migrations aplicadas

**Nenhuma nova migration** — a Sprint 4 usa apenas os models definidos na Sprint 3 (`users`, `refresh_tokens`, `password_reset_tokens`). A migration `init` da Sprint 3 ainda está pendente.

---

## 6. Variáveis novas no .env.example

```bash
# Autenticação (Sprint 4)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FRONTEND_URL=http://localhost:3000
```

As variáveis `JWT_SECRET`, `REFRESH_TOKEN_SECRET` e `COOKIE_SECRET` já estavam no `.env.example` desde a Sprint 2.

---

## 7. Comandos para rodar o projeto

```bash
# Pré-requisito: Docker Desktop rodando (para banco e Redis)
docker compose up -d

# 1. Aplicar migration (apenas na primeira vez)
pnpm --filter api prisma:migrate:dev -- --name init

# 2. Rodar API
pnpm dev:api

# 3. Rodar Web
pnpm dev:web

# 4. Rodar testes unitários de auth
cd apps/api && npx jest "auth.service.spec" --no-coverage
```

---

## 8. O que a Sprint 5 precisa saber

1. **JwtAuthGuard e RolesGuard** estão prontos para uso em qualquer módulo:
   ```typescript
   @UseGuards(JwtAuthGuard, RolesGuard)
   @Roles(Role.ADMIN)
   @Get('admin/products')
   ```

2. **@CurrentUser()** retorna `{ id: string, email: string, role: string }`.

3. **Importar de auth module:**
   ```typescript
   import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
   import { RolesGuard } from '../auth/guards/roles.guard';
   import { Roles, Role } from '../auth/decorators/roles.decorator';
   import { CurrentUser } from '../auth/decorators/current-user.decorator';
   ```

4. **O AuthModule exporta** `JwtModule` e `PassportModule` — outros módulos que precisam de JwtService podem importar `AuthModule` ao invés de `JwtModule` diretamente.

5. **Frontend `useAuth()`** expõe `user`, `accessToken`, `isLoading`, `login`, `register`, `logout`, `setAuth`. Para rotas protegidas do cliente, verificar `isLoading` antes de renderizar.

6. **Middleware** redireciona `/admin/*` para `/auth/login` se não há cookie de refresh; a verificação de role (USER vs ADMIN) é responsabilidade do backend nas rotas `/api/v1/admin/*`.

7. **`crypto.randomUUID()`** é usado no lugar do pacote `uuid` — não adicionar `uuid` como dependência novamente.
