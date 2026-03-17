/**
 * 관리자 API 라우트
 * role='admin' 인 유저만 접근 가능
 */
import { Express } from "express";
import { db } from "./db";
import { items, users } from "@shared/schema";
import { desc, count, eq, sql } from "drizzle-orm";

function isAdmin(req: Express.Request, res: Express.Response, next: Express.NextFunction) {
  if (!req.isAuthenticated() || (req.user as any)?.role !== "admin") {
    return res.status(403).json({ message: "관리자 권한이 필요합니다" });
  }
  next();
}

export function registerAdminRoutes(app: Express) {
  // 전체 통계
  app.get("/api/admin/stats", isAdmin, async (req, res) => {
    try {
      const [totalItems] = await db.select({ count: count() }).from(items);
      const [totalUsers] = await db.select({ count: count() }).from(users);
      const [foundItems] = await db.select({ count: count() }).from(items).where(eq(items.reportType, "found"));
      const [lostItems] = await db.select({ count: count() }).from(items).where(eq(items.reportType, "lost"));
      const [resolvedItems] = await db.select({ count: count() }).from(items).where(eq(items.status, "resolved"));

      // 일별 등록 수 (최근 7일)
      const dailyStats = await db.execute(sql`
        SELECT DATE(date) as day, COUNT(*) as cnt
        FROM items
        WHERE date >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(date)
        ORDER BY day ASC
      `);

      // 카테고리별 분포
      const categoryStats = await db.execute(sql`
        SELECT item_category, COUNT(*) as cnt
        FROM items
        WHERE item_category IS NOT NULL
        GROUP BY item_category
        ORDER BY cnt DESC
        LIMIT 10
      `);

      res.json({
        totalItems: totalItems.count,
        totalUsers: totalUsers.count,
        foundItems: foundItems.count,
        lostItems: lostItems.count,
        resolvedItems: resolvedItems.count,
        dailyStats: dailyStats.rows,
        categoryStats: categoryStats.rows,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 전체 게시물 목록
  app.get("/api/admin/items", isAdmin, async (req, res) => {
    try {
      const page = Number(req.query.page ?? 1);
      const limit = 20;
      const offset = (page - 1) * limit;
      const rows = await db.select().from(items).orderBy(desc(items.date)).limit(limit).offset(offset);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 관리자 게시물 삭제
  app.delete("/api/admin/items/:id", isAdmin, async (req, res) => {
    try {
      await db.delete(items).where(eq(items.id, Number(req.params.id)));
      res.json({ message: "삭제되었습니다" });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // 유저 목록
  app.get("/api/admin/users", isAdmin, async (req, res) => {
    try {
      const rows = await db.select({ id: users.id, username: users.username, name: users.name, createdAt: users.createdAt, role: users.role, provider: users.provider }).from(users).orderBy(desc(users.createdAt));
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
