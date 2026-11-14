import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import type { ReportQueryDto } from './dto/admin.dto.js';
import { OrderStatusEnum, PaymentStatusEnum, ReviewStatusEnum } from '../../dependency/value/database.enum.js';
import { SystemRoleEnum } from '../../dependency/value/security.enum.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const PAID = PaymentStatusEnum.SUCCEEDED;

/** Defaults to the last 30 days. */
const rangeOf = ({ from, to }: ReportQueryDto) => {
  const end = to ?? new Date();
  return { from: from ?? new Date(end.getTime() - 30 * DAY_MS), to: end };
};

const num = (value: unknown) => Number(value ?? 0);

/**
 * Read-only aggregates for the admin dashboard. Plain SQL keeps each report readable in one place.
 * "Revenue" = totals of orders whose payment succeeded (refunded orders are excluded).
 */
@Injectable()
export class ReportService {
  constructor(private readonly db: DataSource) {}

  async dashboard() {
    const [[sales], [orders], [customers], [stock], [reviews], recentOrders] = await Promise.all([
      this.db.query(
        `SELECT
           COALESCE(SUM(total), 0)                                                    AS "totalRevenue",
           COALESCE(SUM(total) FILTER (WHERE paid_at >= date_trunc('day', now())), 0)  AS "revenueToday",
           COALESCE(SUM(total) FILTER (WHERE paid_at >= now() - interval '30 days'), 0) AS "revenueLast30Days"
         FROM orders WHERE payment_status = $1`,
        [PAID],
      ),
      this.db.query(
        `SELECT
           COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now())) AS "ordersToday",
           COUNT(*) FILTER (WHERE status = $1)                             AS "pendingPayment",
           COUNT(*) FILTER (WHERE status IN ($2, $3))                      AS "toFulfil",
           COUNT(*) FILTER (WHERE status = $4)                             AS "returnRequests"
         FROM orders`,
        [OrderStatusEnum.PENDING, OrderStatusEnum.CONFIRMED, OrderStatusEnum.PROCESSING, OrderStatusEnum.RETURN_REQUESTED],
      ),
      this.db.query(
        `SELECT COUNT(*) AS "totalCustomers", COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days') AS "newLast30Days"
         FROM users WHERE role = $1`,
        [SystemRoleEnum.CUSTOMER],
      ),
      this.db.query(
        `SELECT COUNT(*) FILTER (WHERE available_quantity <= low_stock_threshold AND available_quantity > 0) AS "lowStock",
                COUNT(*) FILTER (WHERE available_quantity = 0) AS "outOfStock"
         FROM inventories`,
      ),
      this.db.query(`SELECT COUNT(*) AS "pendingReviews" FROM reviews WHERE status = $1`, [ReviewStatusEnum.PENDING]),
      this.db.query(
        `SELECT o.id, o.order_number AS "orderNumber", o.total, o.currency, o.status, o.payment_status AS "paymentStatus", o.created_at AS "createdAt", u.name AS "customerName"
         FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC LIMIT 5`,
      ),
    ]);

    return {
      sales: { totalRevenue: num(sales.totalRevenue), revenueToday: num(sales.revenueToday), revenueLast30Days: num(sales.revenueLast30Days) },
      orders: {
        ordersToday: num(orders.ordersToday),
        pendingPayment: num(orders.pendingPayment),
        toFulfil: num(orders.toFulfil),
        returnRequests: num(orders.returnRequests),
      },
      customers: { total: num(customers.totalCustomers), newLast30Days: num(customers.newLast30Days) },
      inventory: { lowStock: num(stock.lowStock), outOfStock: num(stock.outOfStock) },
      reviews: { pending: num(reviews.pendingReviews) },
      recentOrders: recentOrders.map((row: Record<string, unknown>) => ({ ...row, total: num(row.total) })),
    };
  }

  /** Revenue per day/week/month. */
  async sales(query: ReportQueryDto) {
    const { from, to } = rangeOf(query);
    const groupBy = query.groupBy ?? 'day';
    const rows: Record<string, unknown>[] = await this.db.query(
      `SELECT date_trunc($1, paid_at) AS period, COUNT(*) AS orders, SUM(total) AS revenue, SUM(discount) AS discounts,
              SUM(shipping_cost) AS shipping, ROUND(AVG(total), 2) AS "averageOrderValue"
       FROM orders WHERE payment_status = $2 AND paid_at BETWEEN $3 AND $4
       GROUP BY 1 ORDER BY 1`,
      [groupBy, PAID, from, to],
    );
    const series = rows.map((row) => ({
      period: row.period,
      orders: num(row.orders),
      revenue: num(row.revenue),
      discounts: num(row.discounts),
      shipping: num(row.shipping),
      averageOrderValue: num(row.averageOrderValue),
    }));
    return {
      from,
      to,
      groupBy,
      totals: {
        orders: series.reduce((sum, row) => sum + row.orders, 0),
        revenue: series.reduce((sum, row) => sum + row.revenue, 0),
        discounts: series.reduce((sum, row) => sum + row.discounts, 0),
      },
      series,
    };
  }

  /** Order counts by status and payment status. */
  async orders(query: ReportQueryDto) {
    const { from, to } = rangeOf(query);
    const [byStatus, byPayment] = await Promise.all([
      this.db.query(`SELECT status, COUNT(*) AS count FROM orders WHERE created_at BETWEEN $1 AND $2 GROUP BY status ORDER BY count DESC`, [from, to]),
      this.db.query(`SELECT payment_status AS "paymentStatus", COUNT(*) AS count FROM orders WHERE created_at BETWEEN $1 AND $2 GROUP BY payment_status`, [
        from,
        to,
      ]),
    ]);
    const counted = (rows: Record<string, unknown>[]) => rows.map((row) => ({ ...row, count: num(row.count) }));
    return { from, to, byStatus: counted(byStatus), byPaymentStatus: counted(byPayment) };
  }

  /** Best-selling watches by units and revenue. */
  async products(query: ReportQueryDto) {
    const { from, to } = rangeOf(query);
    const rows: Record<string, unknown>[] = await this.db.query(
      `SELECT i.watch_id AS "watchId", MAX(i.watch_name) AS "watchName", SUM(i.quantity) AS "unitsSold", SUM(i.total_price) AS revenue, COUNT(DISTINCT o.id) AS orders
       FROM order_items i JOIN orders o ON o.id = i.order_id
       WHERE o.payment_status = $1 AND o.paid_at BETWEEN $2 AND $3
       GROUP BY i.watch_id ORDER BY "unitsSold" DESC LIMIT $4`,
      [PAID, from, to, query.limit ?? 10],
    );
    return { from, to, topWatches: rows.map((row) => ({ ...row, unitsSold: num(row.unitsSold), revenue: num(row.revenue), orders: num(row.orders) })) };
  }

  /** Stock totals, stock value and the variants that need restocking. */
  async inventory(query: ReportQueryDto) {
    const [[totals], lowStock] = await Promise.all([
      this.db.query(
        `SELECT COUNT(*) AS variants, COALESCE(SUM(i.available_quantity), 0) AS available, COALESCE(SUM(i.reserved_quantity), 0) AS reserved,
                COALESCE(SUM(i.available_quantity * v.price), 0) AS "stockValue",
                COUNT(*) FILTER (WHERE i.available_quantity = 0) AS "outOfStock",
                COUNT(*) FILTER (WHERE i.available_quantity <= i.low_stock_threshold) AS "lowStock"
         FROM inventories i JOIN watch_variants v ON v.id = i.variant_id`,
      ),
      this.db.query(
        `SELECT i.variant_id AS "variantId", v.sku, w.name AS "watchName", i.available_quantity AS "availableQuantity", i.low_stock_threshold AS "lowStockThreshold"
         FROM inventories i JOIN watch_variants v ON v.id = i.variant_id JOIN watches w ON w.id = v.watch_id
         WHERE i.available_quantity <= i.low_stock_threshold ORDER BY i.available_quantity ASC LIMIT $1`,
        [query.limit ?? 20],
      ),
    ]);
    return {
      totals: Object.fromEntries(Object.entries(totals as Record<string, unknown>).map(([key, value]) => [key, num(value)])),
      needsRestock: lowStock,
    };
  }

  /** New customers over time, repeat buyers and top spenders. */
  async customers(query: ReportQueryDto) {
    const { from, to } = rangeOf(query);
    const groupBy = query.groupBy ?? 'day';
    const [signups, [repeat], topCustomers] = await Promise.all([
      this.db.query(
        `SELECT date_trunc($1, created_at) AS period, COUNT(*) AS customers FROM users
         WHERE role = $2 AND created_at BETWEEN $3 AND $4 GROUP BY 1 ORDER BY 1`,
        [groupBy, SystemRoleEnum.CUSTOMER, from, to],
      ),
      this.db.query(
        `SELECT COUNT(*) FILTER (WHERE paid_orders > 1) AS "repeatCustomers", COUNT(*) AS "payingCustomers"
         FROM (SELECT user_id, COUNT(*) AS paid_orders FROM orders WHERE payment_status = $1 GROUP BY user_id) t`,
        [PAID],
      ),
      this.db.query(
        `SELECT u.id, u.name, u.email, COUNT(o.id) AS orders, SUM(o.total) AS spent
         FROM orders o JOIN users u ON u.id = o.user_id
         WHERE o.payment_status = $1 AND o.paid_at BETWEEN $2 AND $3
         GROUP BY u.id ORDER BY spent DESC LIMIT $4`,
        [PAID, from, to, query.limit ?? 10],
      ),
    ]);
    return {
      from,
      to,
      groupBy,
      newCustomers: signups.map((row: Record<string, unknown>) => ({ period: row.period, customers: num(row.customers) })),
      repeatCustomers: num(repeat.repeatCustomers),
      payingCustomers: num(repeat.payingCustomers),
      topCustomers: topCustomers.map((row: Record<string, unknown>) => ({ ...row, orders: num(row.orders), spent: num(row.spent) })),
    };
  }
}
