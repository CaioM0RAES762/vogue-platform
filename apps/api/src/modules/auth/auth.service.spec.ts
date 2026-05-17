import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';

import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { validateCpf } from './validators/is-cpf.validator';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function makeMockRes() {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as import('express').Response;
}

function makeMockReq(cookieValue?: string) {
  return {
    cookies: cookieValue ? { refresh_token: cookieValue } : {},
    socket: { remoteAddress: '127.0.0.1' },
    headers: {},
  } as unknown as import('express').Request;
}

// ─── Mock de usuário base ─────────────────────────────────────────────────────

const MOCK_USER = {
  id: 'user-id-123',
  email: 'maria@example.com',
  name: 'Maria Silva',
  role: 'USER',
  cpf: '52998224725',
  passwordHash: bcrypt.hashSync('SenhaForte1', 12),
  deletedAt: null,
};

// ─── Suite Principal ──────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let mailService: jest.Mocked<MailService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            refreshToken: {
              create: jest.fn(),
              findUnique: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn(),
            },
            passwordResetToken: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              deleteMany: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-access-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, string> = {
                NODE_ENV: 'test',
                JWT_SECRET: 'test-secret',
                FRONTEND_URL: 'http://localhost:3000',
              };
              return map[key];
            }),
            getOrThrow: jest.fn().mockReturnValue('test-secret'),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendPasswordReset: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    jwtService = module.get(JwtService) as jest.Mocked<JwtService>;
    mailService = module.get(MailService) as jest.Mocked<MailService>;
  });

  // ─── Validação de CPF ───────────────────────────────────────────────────────

  describe('validateCpf', () => {
    it('aceita CPF válido sem máscara', () => {
      expect(validateCpf('52998224725')).toBe(true);
    });

    it('aceita CPF válido com máscara', () => {
      expect(validateCpf('529.982.247-25')).toBe(true);
    });

    it('rejeita CPF com todos os dígitos iguais', () => {
      expect(validateCpf('11111111111')).toBe(false);
      expect(validateCpf('00000000000')).toBe(false);
    });

    it('rejeita CPF com menos de 11 dígitos', () => {
      expect(validateCpf('1234567890')).toBe(false);
    });

    it('rejeita CPF com dígito verificador incorreto', () => {
      expect(validateCpf('52998224726')).toBe(false);
      expect(validateCpf('12345678900')).toBe(false);
    });

    it('rejeita string vazia', () => {
      expect(validateCpf('')).toBe(false);
    });
  });

  // ─── Registro ───────────────────────────────────────────────────────────────

  describe('register', () => {
    const dto = {
      name: 'Maria Silva',
      email: 'maria@example.com',
      cpf: '529.982.247-25',
      phone: '(11) 9 8765-4321',
      password: 'SenhaForte1',
      acceptTerms: true as const,
    };

    beforeEach(() => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'user-id-123',
        email: dto.email,
        role: 'USER',
        name: dto.name,
      });
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
    });

    it('cria usuário e retorna access token', async () => {
      const res = makeMockRes();
      const result = await service.register(dto, res);

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.user.email).toBe(dto.email);
      expect(prisma.user.create).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(String),
        expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
      );
    });

    it('lança ConflictException se e-mail já existe', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'existing' });

      await expect(service.register(dto, makeMockRes())).rejects.toThrow(ConflictException);
    });

    it('lança BadRequestException se acceptTerms=false', async () => {
      await expect(
        service.register({ ...dto, acceptTerms: false }, makeMockRes()),
      ).rejects.toThrow(BadRequestException);
    });

    it('armazena senha como hash bcrypt (nunca em claro)', async () => {
      const res = makeMockRes();
      await service.register(dto, res);

      const callArg = (prisma.user.create as jest.Mock).mock.calls[0][0];
      expect(callArg.data.passwordHash).not.toBe(dto.password);
      expect(callArg.data.passwordHash).toMatch(/^\$2[ab]\$/);
    });
  });

  // ─── Login ──────────────────────────────────────────────────────────────────

  describe('login', () => {
    beforeEach(() => {
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
    });

    it('retorna token quando credenciais corretas', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_USER);
      const res = makeMockRes();

      const result = await service.login(
        { email: MOCK_USER.email, password: 'SenhaForte1' },
        res,
        '127.0.0.1',
      );

      expect(result.accessToken).toBe('mock-access-token');
      expect(res.cookie).toHaveBeenCalled();
    });

    it('lança UnauthorizedException com mensagem genérica para usuário inexistente', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.login({ email: 'nao@existe.com', password: 'qualquer' }, makeMockRes(), 'ip'),
      ).rejects.toThrow(new UnauthorizedException('Credenciais inválidas'));
    });

    it('lança UnauthorizedException com mesma mensagem para senha errada', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_USER);

      await expect(
        service.login({ email: MOCK_USER.email, password: 'SenhaErrada1' }, makeMockRes(), 'ip'),
      ).rejects.toThrow(new UnauthorizedException('Credenciais inválidas'));
    });

    it('não revela se o campo errado é e-mail ou senha (mensagem genérica)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      let error1: UnauthorizedException | null = null;
      try {
        await service.login({ email: 'nao@existe.com', password: 'x' }, makeMockRes(), 'ip');
      } catch (e) {
        error1 = e as UnauthorizedException;
      }

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(MOCK_USER);
      let error2: UnauthorizedException | null = null;
      try {
        await service.login({ email: MOCK_USER.email, password: 'errada' }, makeMockRes(), 'ip');
      } catch (e) {
        error2 = e as UnauthorizedException;
      }

      expect(error1?.message).toBe(error2?.message);
    });

    it('rejeita usuário deletado (LGPD)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...MOCK_USER,
        deletedAt: new Date(),
      });

      await expect(
        service.login({ email: MOCK_USER.email, password: 'SenhaForte1' }, makeMockRes(), 'ip'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── Logout ─────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('deleta refresh token do banco e limpa cookie', async () => {
      (prisma.refreshToken.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
      const rawToken = randomUUID();
      const req = makeMockReq(rawToken);
      const res = makeMockRes();

      await service.logout(req, res);

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { tokenHash: sha256(rawToken) },
      });
      expect(res.clearCookie).toHaveBeenCalled();
    });

    it('não falha se não houver cookie de refresh', async () => {
      const req = makeMockReq();
      const res = makeMockRes();
      await expect(service.logout(req, res)).resolves.not.toThrow();
    });
  });

  // ─── Refresh ────────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('rotaciona refresh token e emite novo access token', async () => {
      const rawToken = randomUUID();
      const storedToken = {
        id: 'token-id',
        token: sha256(rawToken),
        expiresAt: new Date(Date.now() + 86_400_000),
        user: { id: 'user-id', email: 'x@x.com', role: 'USER', name: 'X', deletedAt: null },
      };
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(storedToken);
      (prisma.refreshToken.delete as jest.Mock).mockResolvedValue({});
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const req = makeMockReq(rawToken);
      const res = makeMockRes();
      const result = await service.refresh(req, res);

      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: storedToken.id } });
      expect(prisma.refreshToken.create).toHaveBeenCalled();
      expect(result.accessToken).toBe('mock-access-token');
    });

    it('lança UnauthorizedException se token expirado', async () => {
      const rawToken = randomUUID();
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'token-id',
        expiresAt: new Date(Date.now() - 1000),
        user: { ...MOCK_USER, deletedAt: null },
      });

      await expect(service.refresh(makeMockReq(rawToken), makeMockRes())).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('lança UnauthorizedException se não há cookie', async () => {
      await expect(service.refresh(makeMockReq(), makeMockRes())).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── Forgot Password ─────────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('retorna mensagem genérica mesmo para e-mail inexistente', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.forgotPassword('nao@existe.com');
      expect(result.message).toContain('e-mail');
      expect(mailService.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('cria token e envia e-mail para usuário existente', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-id', deletedAt: null });
      (prisma.passwordResetToken.deleteMany as jest.Mock).mockResolvedValue({});
      (prisma.passwordResetToken.create as jest.Mock).mockResolvedValue({});

      const result = await service.forgotPassword(MOCK_USER.email);

      expect(prisma.passwordResetToken.create).toHaveBeenCalled();
      expect(mailService.sendPasswordReset).toHaveBeenCalledWith(
        MOCK_USER.email,
        expect.any(String),
      );
      expect(result.message).toContain('e-mail');
    });

    it('retorna mesma mensagem independente de o e-mail existir', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      const result1 = await service.forgotPassword('nao@existe.com');

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'id', deletedAt: null });
      (prisma.passwordResetToken.deleteMany as jest.Mock).mockResolvedValue({});
      (prisma.passwordResetToken.create as jest.Mock).mockResolvedValue({});
      const result2 = await service.forgotPassword(MOCK_USER.email);

      expect(result1.message).toBe(result2.message);
    });
  });

  // ─── Reset Password ──────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    const rawToken = randomUUID();
    const validStoredToken = {
      id: 'reset-id',
      userId: 'user-id',
      token: sha256(rawToken),
      expiresAt: new Date(Date.now() + 3_600_000),
      usedAt: null,
      user: { id: 'user-id', email: 'x@x.com', role: 'USER', name: 'X' },
    };

    it('troca senha e invalida refresh tokens', async () => {
      (prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue(validStoredToken);
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);

      const res = makeMockRes();
      const result = await service.resetPassword(rawToken, 'NovaSenha1', res);

      expect(prisma.$transaction).toHaveBeenCalled();
      const txCalls = (prisma.$transaction as jest.Mock).mock.calls[0][0];
      expect(txCalls).toHaveLength(3); // update user, mark token used, deleteMany refresh tokens
      expect(result.message).toContain('redefinida');
      expect(res.clearCookie).toHaveBeenCalled();
    });

    it('lança NotFoundException para token inválido', async () => {
      (prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.resetPassword('token-invalido', 'NovaSenha1', makeMockRes()),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança BadRequestException para token já utilizado', async () => {
      (prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue({
        ...validStoredToken,
        usedAt: new Date(),
      });

      await expect(service.resetPassword(rawToken, 'NovaSenha1', makeMockRes())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lança BadRequestException para token expirado', async () => {
      (prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue({
        ...validStoredToken,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.resetPassword(rawToken, 'NovaSenha1', makeMockRes())).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── RolesGuard ──────────────────────────────────────────────────────────────

  describe('RolesGuard', () => {
    it('(descrição) deve bloquear USER tentando acessar rota ADMIN', () => {
      // O guard é testado de forma isolada — a lógica:
      // requiredRoles = ['ADMIN'], user.role = 'USER' → ForbiddenException
      const { RolesGuard } = require('./guards/roles.guard');
      const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']) };
      const guard = new RolesGuard(reflector);
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({ user: { role: 'USER' } }),
        }),
      };

      expect(() => guard.canActivate(mockContext)).toThrow();
    });

    it('(descrição) deve permitir ADMIN em rota ADMIN', () => {
      const { RolesGuard } = require('./guards/roles.guard');
      const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']) };
      const guard = new RolesGuard(reflector);
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({ user: { role: 'ADMIN' } }),
        }),
      };

      expect(guard.canActivate(mockContext)).toBe(true);
    });
  });
});
