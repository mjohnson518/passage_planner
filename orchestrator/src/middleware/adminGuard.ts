import { Request, Response, NextFunction } from 'express'
import { Logger } from 'pino'

export function createAdminGuard(logger: Logger) {
  const allowedCountries = (process.env.ADMIN_ALLOWED_COUNTRIES || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)

  const allowedIps = (process.env.ADMIN_IP_ALLOWLIST || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  return function adminGuard(req: Request, res: Response, next: NextFunction) {
    // Country check via Cloudflare header if present
    const country = (req.headers['cf-ipcountry'] as string | undefined)?.toUpperCase()
    if (allowedCountries.length > 0 && country && !allowedCountries.includes(country)) {
      logger.warn({ country }, 'Admin access blocked by country policy')
      return res.status(403).json({ error: 'Access denied' })
    }

    // IP allowlist check
    if (allowedIps.length > 0) {
      const ipHeader = req.headers['cf-connecting-ip'] as string | undefined
      const ip: string = (typeof ipHeader === 'string' && ipHeader.length > 0) ? ipHeader : (req.ip || '')
      if (!allowedIps.includes(ip)) {
        logger.warn({ ip }, 'Admin access blocked by IP policy')
        return res.status(403).json({ error: 'Access denied' })
      }
    }

    return next()
  }
}


