import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly resend: Resend;
  private readonly logger = new Logger(MailService.name);
  private readonly from = 'Janaina Modas <no-reply@janainamodas.com.br>';

  constructor(private readonly configService: ConfigService) {
    this.resend = new Resend(configService.get<string>('RESEND_API_KEY'));
  }

  async sendOrderConfirmed(to: string, orderNumber: string, total: number): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const orderUrl = `${frontendUrl}/minha-conta/pedidos`;

    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject: `Pedido confirmado ${orderNumber} — Janaina Modas`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #000000;">Pagamento Confirmado!</h2>
            <p>Seu pedido <strong>${orderNumber}</strong> foi confirmado com sucesso.</p>
            <p>Total pago: <strong>R$ ${total.toFixed(2).replace('.', ',')}</strong></p>
            <p>Em breve você receberá informações sobre o envio.</p>
            <a href="${orderUrl}"
               style="display:inline-block;padding:12px 24px;background:#C9A84C;color:#fff;text-decoration:none;border-radius:4px;font-weight:bold;margin:16px 0;">
              Ver Meus Pedidos
            </a>
            <p style="color:#666;font-size:12px;">Obrigada por comprar na Janaina Modas!</p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.error('Erro ao enviar e-mail de confirmação de pedido', { to, orderNumber, error });
    }
  }

  async sendOrderCancelled(to: string, orderNumber: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const ordersUrl = `${frontendUrl}/minha-conta/pedidos`;

    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject: `Pedido ${orderNumber} cancelado — Janaina Modas`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #000000;">Pedido Cancelado</h2>
            <p>Seu pedido <strong>${orderNumber}</strong> foi cancelado conforme solicitado.</p>
            <p>Se o pagamento já havia sido confirmado, o estorno será processado em até 5 dias úteis.</p>
            <a href="${ordersUrl}"
               style="display:inline-block;padding:12px 24px;background:#C9A84C;color:#fff;text-decoration:none;border-radius:4px;font-weight:bold;margin:16px 0;">
              Ver Meus Pedidos
            </a>
            <p style="color:#666;font-size:12px;">Obrigada por comprar na Janaina Modas!</p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.error('Erro ao enviar e-mail de cancelamento de pedido', { to, orderNumber, error });
    }
  }

  async sendPasswordReset(email: string, rawToken: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const resetUrl = `${frontendUrl}/auth/redefinir-senha?token=${rawToken}`;

    try {
      await this.resend.emails.send({
        from: this.from,
        to: email,
        subject: 'Redefinição de Senha — Janaina Modas',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #000000;">Redefinição de Senha</h2>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
            <p>Clique no botão abaixo para criar uma nova senha. O link é válido por <strong>1 hora</strong>.</p>
            <a href="${resetUrl}"
               style="display:inline-block;padding:12px 24px;background:#C9A84C;color:#fff;text-decoration:none;border-radius:4px;font-weight:bold;margin:16px 0;">
              Redefinir Senha
            </a>
            <p style="color:#666;font-size:14px;">
              Se você não solicitou a redefinição, ignore este e-mail. Sua senha permanece inalterada.
            </p>
            <p style="color:#666;font-size:12px;">
              Caso o botão não funcione, copie e cole o link:<br/>
              <a href="${resetUrl}">${resetUrl}</a>
            </p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.error('Erro ao enviar e-mail de recuperação de senha', { email, error });
      // Não propaga o erro para não revelar se o e-mail existe (segurança SDD 6.1.3)
    }
  }
}
