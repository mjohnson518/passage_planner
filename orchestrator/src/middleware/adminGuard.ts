import { Request, Response, NextFunction } from "express";
import { Logger } from "pino";
import { Pool } from "pg";

/**
 * Role-check middleware — verifies the authenticated user has `role = 'admin'`
 * in the `users` table. Must be chained AFTER authentication so `req.user.id`
 * is populated. Replaces the inline DB-lookup-plus-compare pattern previously
 * repeated across 6+ admin endpoints; one missed call site would be a
 * privilege-escalation vector.
 */
export function createRequireAdminRole(pool: Pool, logger: Logger) {
  return async function requireAdminRole(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = (req as Request & { user?: { id?: string } }).user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const result = await pool.query("SELECT role FROM users WHERE id = $1", [
        userId,
      ]);
      if (!result.rows[0] || result.rows[0].role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      return next();
    } catch (error) {
      logger.error({ error }, "Admin role check failed");
      return res.status(500).json({ error: "Authorization check failed" });
    }
  };
}

export function createAdminGuard(logger: Logger) {
  const allowedCountries = (process.env.ADMIN_ALLOWED_COUNTRIES || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const allowedIps = (process.env.ADMIN_IP_ALLOWLIST || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return function adminGuard(req: Request, res: Response, next: NextFunction) {
    // Country check via Cloudflare header if present
    const country = (
      req.headers["cf-ipcountry"] as string | undefined
    )?.toUpperCase();
    if (
      allowedCountries.length > 0 &&
      country &&
      !allowedCountries.includes(country)
    ) {
      logger.warn({ country }, "Admin access blocked by country policy");
      return res.status(403).json({ error: "Access denied" });
    }

    // IP allowlist check
    if (allowedIps.length > 0) {
      const ipHeader = req.headers["cf-connecting-ip"] as string | undefined;
      const ip: string =
        typeof ipHeader === "string" && ipHeader.length > 0
          ? ipHeader
          : req.ip || "";
      if (!allowedIps.includes(ip)) {
        logger.warn({ ip }, "Admin access blocked by IP policy");
        return res.status(403).json({ error: "Access denied" });
      }
    }

    return next();
  };
}
