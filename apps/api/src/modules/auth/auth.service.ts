import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'crypto';
import { Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  // ─── Registro ─────────────────────────────────────────────────────────────

  async register(dto: RegisterDto, res: Response) {
    if (!dto.acceptTerms) {
      throw new BadRequestException('Aceite dos termos é obrigatório');
    }

    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (exists) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const cpfExists = await this.prisma.user.findUnique({
      where: { cpf: dto.cpf.replace(/\D/g, '') },
      select: { id: true },
    });
    if (cpfExists) {
      throw new ConflictException('CPF já cadastrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        cpf: dto.cpf.replace(/\D/g, ''),
        phone: dto.phone,
        passwordHash,
      },
      select: { id: true, email: true, role: true, name: true },
    });

    this.logger.log({ event: 'REGISTER', userId: user.id });

    return this.issueTokens(user, res);
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  async login(dto: LoginDto, res: Response, ip: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, role: true, name: true, passwordHash: true, deletedAt: true },
    });

    // Resposta genérica — não revela qual campo está errado (SDD 6.1.1)
    if (!user || user.deletedAt) {
      this.logger.warn({ event: 'LOGIN_FAILED', email: dto.email, ip, reason: 'user_not_found' });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      this.logger.warn({ event: 'LOGIN_FAILED', email: dto.email, ip, reason: 'wrong_password' });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    this.logger.log({ event: 'LOGIN_SUCCESS', userId: user.id, ip });

    return this.issueTokens(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      res,
    );
  }

  // ─── Refresh ──────────────────────────────────────────────────────────────

  async refresh(req: Request, res: Response) {
    const rawToken = req.cookies?.refresh_token as string | undefined;
    if (!rawToken) throw new UnauthorizedException('Refresh token ausente');

    const tokenHash = sha256(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, role: true, name: true, deletedAt: true } } },
    });

    if (!stored || stored.expiresAt < new Date() || stored.user.deletedAt) {
      res.clearCookie('refresh_token');
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    // Rotação: invalida o token atual e emite novo par
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    return this.issueTokens(stored.user, res);
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  async logout(req: Request, res: Response) {
    const rawToken = req.cookies?.refresh_token as string | undefined;
    if (rawToken) {
      const tokenHash = sha256(rawToken);
      await this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
    }
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
    return { message: 'Logout realizado com sucesso' };
  }

  // ─── Forgot Password ──────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, deletedAt: true },
    });

    // Sempre retorna a mesma mensagem — não revela se e-mail existe (SDD 6.1.3)
    const genericResponse = {
      message: 'Se o e-mail estiver cadastrado, você receberá as instruções em breve',
    };

    if (!user || user.deletedAt) return genericResponse;

    // Invalida tokens anteriores do mesmo usuário
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    const rawToken = randomUUID();
    // D-02 aplicado também ao reset token: armazenamos o hash SHA-256, não o valor bruto
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, token: tokenHash, expiresAt },
    });

    await this.mailService.sendPasswordReset(email, rawToken);

    this.logger.log({ event: 'PASSWORD_RESET_REQUESTED', userId: user.id });

    return genericResponse;
  }

  // ─── Reset Password ───────────────────────────────────────────────────────

  async resetPassword(rawToken: string, newPassword: string, res: Response) {
    const tokenHash = sha256(rawToken);
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token: tokenHash },
      include: { user: { select: { id: true, email: true, role: true, name: true } } },
    });

    if (!resetToken) throw new NotFoundException('Token inválido');
    if (resetToken.usedAt) throw new BadRequestException('Token já utilizado');
    if (resetToken.expiresAt < new Date()) throw new BadRequestException('Token expirado');

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // RF008 — invalida TODOS os refresh tokens do usuário após reset de senha
      this.prisma.refreshToken.deleteMany({ where: { userId: resetToken.userId } }),
    ]);

    this.logger.log({ event: 'PASSWORD_RESET_SUCCESS', userId: resetToken.userId });

    // Limpa cookie de refresh token caso o usuário estivesse logado
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });

    return { message: 'Senha redefinida com sucesso. Faça login para continuar.' };
  }

  // ─── Helper: emite access token + refresh token ───────────────────────────

  private async issueTokens(
    user: { id: string; email: string; role: string; name?: string },
    res: Response,
  ) {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_EXPIRY });

    const rawRefreshToken = randomUUID();
    const tokenHash = sha256(rawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const isProduction = this.configService.get('NODE_ENV') === 'production';
    res.cookie('refresh_token', rawRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: REFRESH_TOKEN_EXPIRY_MS,
    });

    return {
      accessToken,
      user: { id: user.id, email: user.email, role: user.role, name: user.name },
    };
  }
}
