import { Injectable } from '@nestjs/common';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      todayOrders,
      todayRevenue,
      monthOrders,
      monthRevenue,
      recentOrders,
      topProducts,
      lowStockVariants,
      dailyRevenue,
    ] = await Promise.all([
      // KPI: vendas do dia
      this.prisma.order.count({
        where: {
          status: { in: [OrderStatus.PAID, OrderStatus.PREPARING, OrderStatus.SHIPPED, OrderStatus.DELIVERED] },
          createdAt: { gte: todayStart },
        },
      }),

      // KPI: faturamento do dia
      this.prisma.order.aggregate({
        where: {
          status: { in: [OrderStatus.PAID, OrderStatus.PREPARING, OrderStatus.SHIPPED, OrderStatus.DELIVERED] },
          createdAt: { gte: todayStart },
        },
        _sum: { total: true },
      }),

      // KPI: total pedidos do mês
      this.prisma.order.count({
        where: {
          status: { in: [OrderStatus.PAID, OrderStatus.PREPARING, OrderStatus.SHIPPED, OrderStatus.DELIVERED] },
          createdAt: { gte: monthStart },
        },
      }),

      // KPI: ticket médio do mês
      this.prisma.order.aggregate({
        where: {
          status: { in: [OrderStatus.PAID, OrderStatus.PREPARING, OrderStatus.SHIPPED, OrderStatus.DELIVERED] },
          createdAt: { gte: monthStart },
        },
        _avg: { total: true },
        _sum: { total: true },
      }),

      // Últimos 10 pedidos
      this.prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
          payments: { select: { method: true, status: true }, take: 1 },
        },
      }),

      // Top 5 produtos mais vendidos (30 dias)
      this.prisma.orderItem.groupBy({
        by: ['variantId'],
        where: {
          order: {
            createdAt: { gte: thirtyDaysAgo },
            status: { in: [OrderStatus.PAID, OrderStatus.PREPARING, OrderStatus.SHIPPED, OrderStatus.DELIVERED] },
          },
        },
        _sum: { quantity: true, totalPrice: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),

      // Alertas de estoque baixo
      this.prisma.productVariant.findMany({
        where: { stock: { lte: this.prisma.$queryRaw`"min_stock"` as unknown as number } },
        include: { product: { select: { name: true } } },
        take: 20,
      }),

      // Faturamento diário 30 dias (raw aggregation por dia)
      this.prisma.$queryRaw<{ day: Date; revenue: number }[]>`
        SELECT
          date_trunc('day', created_at) AS day,
          SUM(total)::float AS revenue
        FROM orders
        WHERE
          status IN ('PAID','PREPARING','SHIPPED','DELIVERED')
          AND created_at >= ${thirtyDaysAgo}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
    ]);

    // Resolve top products with product names from snapshots
    const topProductsWithNames = await Promise.all(
      topProducts.map(async (tp) => {
        const variant = await this.prisma.productVariant.findUnique({
          where: { id: tp.variantId },
          include: { product: { select: { name: true, sku: true } } },
        });
        return {
          variantId: tp.variantId,
          productName: variant?.product.name ?? 'Desconhecido',
          sku: variant?.product.sku ?? '',
          totalQty: tp._sum.quantity ?? 0,
          totalRevenue: Number(tp._sum.totalPrice ?? 0),
        };
      }),
    );

    // Fix low stock: use JS-side comparison since raw $queryRaw inside where is not standard
    const lowStockFixed = await this.prisma.productVariant.findMany({
      where: {
        product: { status: 'ACTIVE' },
      },
      include: { product: { select: { name: true } } },
    }).then((variants) =>
      variants
        .filter((v) => v.stock <= v.minStock)
        .slice(0, 20)
        .map((v) => ({
          variantId: v.id,
          productName: v.product.name,
          size: v.size,
          colorName: v.colorName,
          stock: v.stock,
          minStock: v.minStock,
        })),
    );

    return {
      kpis: {
        todaySales: todayOrders,
        todayRevenue: Number(todayRevenue._sum.total ?? 0),
        monthOrders,
        averageTicket: Number(monthRevenue._avg.total ?? 0),
      },
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        createdAt: o.createdAt,
        customerName: o.user?.name ?? o.guestName ?? 'Convidado',
        customerEmail: o.user?.email ?? o.guestEmail ?? '',
        total: Number(o.total),
        paymentMethod: o.payments[0]?.method ?? null,
        paymentStatus: o.payments[0]?.status ?? null,
        status: o.status,
      })),
      topProducts: topProductsWithNames,
      lowStockAlerts: lowStockFixed,
      dailyRevenue: (dailyRevenue as { day: Date; revenue: number }[]).map((d) => ({
        day: d.day,
        revenue: Number(d.revenue),
      })),
    };
  }
}
