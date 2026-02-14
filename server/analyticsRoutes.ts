/**
 * analyticsRoutes.ts — Express routes for analytics CSV/PDF export.
 * These are REST routes (not tRPC) because they return file downloads.
 */

import { Router, Request, Response } from "express";
import { generateAnalyticsCsv, generateAnalyticsPdfHtml } from "./analyticsExport";

const router = Router();

/**
 * GET /api/v1/analytics/export/csv
 * Download analytics data as CSV file.
 * Query params: dateFrom, dateTo (ISO strings, optional)
 */
router.get("/api/v1/analytics/export/csv", async (req: Request, res: Response) => {
  try {
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

    const csv = await generateAnalyticsCsv(dateFrom, dateTo);

    const filename = `analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    // Add BOM for Excel UTF-8 compatibility
    res.send("\uFEFF" + csv);
  } catch (error: any) {
    console.error("[Analytics] CSV export failed:", error);
    res.status(500).json({ detail: error.message || "CSV export failed" });
  }
});

/**
 * GET /api/v1/analytics/export/pdf
 * Download analytics report as PDF (rendered from HTML).
 * Query params: dateFrom, dateTo (ISO strings, optional)
 */
router.get("/api/v1/analytics/export/pdf", async (req: Request, res: Response) => {
  try {
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

    const html = await generateAnalyticsPdfHtml(dateFrom, dateTo);

    const filename = `analytics-${new Date().toISOString().slice(0, 10)}.html`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(html);
  } catch (error: any) {
    console.error("[Analytics] PDF export failed:", error);
    res.status(500).json({ detail: error.message || "PDF export failed" });
  }
});

/**
 * GET /api/v1/analytics/export/json
 * Download analytics data as JSON file.
 * Query params: dateFrom, dateTo (ISO strings, optional)
 */
router.get("/api/v1/analytics/export/json", async (req: Request, res: Response) => {
  try {
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

    const csv = await generateAnalyticsCsv(dateFrom, dateTo);

    // Parse CSV back to structured data
    const lines = csv.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.replace(/"/g, ""));
    const presentations = lines.slice(1).map(line => {
      const values = line.match(/("[^"]*"|[^,]+)/g) || [];
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = (values[i] || "").replace(/^"|"$/g, "");
      });
      return obj;
    });

    const jsonData = {
      exportedAt: new Date().toISOString(),
      overview: {
        total: presentations.length,
        dateFrom: dateFrom?.toISOString() || null,
        dateTo: dateTo?.toISOString() || null,
      },
      presentations,
    };

    const filename = `analytics-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.json(jsonData);
  } catch (error: any) {
    console.error("[Analytics] JSON export failed:", error);
    res.status(500).json({ detail: error.message || "JSON export failed" });
  }
});

export function registerAnalyticsRoutes(app: Router) {
  app.use(router);
}
