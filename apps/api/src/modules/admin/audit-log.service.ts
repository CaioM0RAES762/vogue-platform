import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditContext {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(
    ctx: AuditContext,
    action: string,
    resource: string,
    resourceId?: string,
    oldData?: unknown,
    newData?: unknown,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: ctx.userId,
          action,
          resource,
          resourceId: resourceId ?? null,
          oldData: oldData ? (oldData as object) : undefined,
          newData: newData ? (newData as object) : undefined,
          ipAddress: ctx.ipAddress ?? null,
          userAgent: ctx.userAgent ?? null,
        },
      });
    } catch (err) {
      // Audit failure should not crash the request
      this.logger.error('Failed to write audit log', err);
    }
  }
}
