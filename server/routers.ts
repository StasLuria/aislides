import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getOverviewMetrics,
  getDailyCreationCounts,
  getStatusDistribution,
  getThemeDistribution,
  getModeDistribution,
  getSlideCountDistribution,
  getRecentPresentations,
} from "./analyticsDb";

const dateRangeInput = z.object({
  dateFrom: z.string().optional(), // ISO date string
  dateTo: z.string().optional(),
});

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  analytics: router({
    /** Overview metrics: total, completed, failed, avg slides, success rate */
    overview: protectedProcedure.input(dateRangeInput).query(async ({ input }) => {
      const dateFrom = input.dateFrom ? new Date(input.dateFrom) : undefined;
      const dateTo = input.dateTo ? new Date(input.dateTo) : undefined;
      return getOverviewMetrics(dateFrom, dateTo);
    }),

    /** Daily creation counts for a date range (for line/bar chart) */
    dailyCounts: protectedProcedure
      .input(
        z.object({
          dateFrom: z.string(),
          dateTo: z.string(),
        })
      )
      .query(async ({ input }) => {
        return getDailyCreationCounts(new Date(input.dateFrom), new Date(input.dateTo));
      }),

    /** Presentation count grouped by status (for pie chart) */
    statusDistribution: protectedProcedure.input(dateRangeInput).query(async ({ input }) => {
      const dateFrom = input.dateFrom ? new Date(input.dateFrom) : undefined;
      const dateTo = input.dateTo ? new Date(input.dateTo) : undefined;
      return getStatusDistribution(dateFrom, dateTo);
    }),

    /** Presentation count grouped by theme (for bar chart) */
    themeDistribution: protectedProcedure.input(dateRangeInput).query(async ({ input }) => {
      const dateFrom = input.dateFrom ? new Date(input.dateFrom) : undefined;
      const dateTo = input.dateTo ? new Date(input.dateTo) : undefined;
      return getThemeDistribution(dateFrom, dateTo);
    }),

    /** Presentation count grouped by mode (batch vs interactive) */
    modeDistribution: protectedProcedure.input(dateRangeInput).query(async ({ input }) => {
      const dateFrom = input.dateFrom ? new Date(input.dateFrom) : undefined;
      const dateTo = input.dateTo ? new Date(input.dateTo) : undefined;
      return getModeDistribution(dateFrom, dateTo);
    }),

    /** Slide count distribution (how many presentations have N slides) */
    slideCountDistribution: protectedProcedure.input(dateRangeInput).query(async ({ input }) => {
      const dateFrom = input.dateFrom ? new Date(input.dateFrom) : undefined;
      const dateTo = input.dateTo ? new Date(input.dateTo) : undefined;
      return getSlideCountDistribution(dateFrom, dateTo);
    }),

    /** Recent presentations (activity feed) */
    recentPresentations: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
      .query(async ({ input }) => {
        return getRecentPresentations(input.limit);
      }),
  }),
});

export type AppRouter = typeof appRouter;
