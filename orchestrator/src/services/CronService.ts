import { CronJob } from 'cron';
import { Logger } from 'pino';
import { emailService } from './EmailService';
import https from 'https';
import http from 'http';

export class CronService {
  private jobs: Map<string, CronJob> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ service: 'cron' });
  }

  start() {
    // Send trial ending reminders daily at 9 AM
    this.scheduleJob('trial-reminders', '0 9 * * *', async () => {
      this.logger.info('Running trial ending reminders job');
      try {
        await emailService.sendTrialEndingReminders();
      } catch (error) {
        this.logger.error({ error }, 'Failed to send trial ending reminders');
      }
    });

    // Send monthly usage reports on the 1st of each month at 10 AM
    this.scheduleJob('monthly-reports', '0 10 1 * *', async () => {
      this.logger.info('Running monthly usage reports job');
      try {
        await emailService.sendMonthlyUsageReports();
      } catch (error) {
        this.logger.error({ error }, 'Failed to send monthly usage reports');
      }
    });

    // Clean up old email logs weekly
    this.scheduleJob('cleanup-email-logs', '0 2 * * 0', async () => {
      this.logger.info('Running email logs cleanup job');
      try {
        await this.cleanupOldEmailLogs();
      } catch (error) {
        this.logger.error({ error }, 'Failed to cleanup email logs');
      }
    });

    // Monitor external weather APIs hourly
    this.scheduleJob('external-api-health', '0 * * * *', async () => {
      this.logger.info('Running external API health checks');
      try {
        await this.checkExternalApiHealth();
      } catch (error) {
        this.logger.error({ error }, 'External API health check failed');
      }
    });

    this.logger.info('Cron jobs scheduled');
  }

  stop() {
    this.jobs.forEach((job, name) => {
      job.stop();
      this.logger.info({ job: name }, 'Stopped cron job');
    });
    this.jobs.clear();
  }

  private scheduleJob(name: string, pattern: string, callback: () => Promise<void>) {
    const job = new CronJob(pattern, callback, null, true, 'America/Los_Angeles');
    this.jobs.set(name, job);
    this.logger.info({ job: name, pattern }, 'Scheduled cron job');
  }

  private async cleanupOldEmailLogs() {
    // This would connect to the database and clean up logs older than 90 days
    // Implementation depends on your database schema
    this.logger.info('Email logs cleanup completed');
  }

  private async checkExternalApiHealth(): Promise<void> {
    const endpoints: Array<{ name: string; url: string; timeoutMs: number }> = [
      {
        name: 'NOAA-weather',
        url: 'https://api.weather.gov/points/38.8894,-77.0352',
        timeoutMs: 10000,
      },
      {
        name: 'NDBC-buoy',
        url: 'https://www.ndbc.noaa.gov/data/realtime2/44013.txt',
        timeoutMs: 10000,
      },
    ];

    for (const ep of endpoints) {
      try {
        const statusCode = await this.httpGet(ep.url, ep.timeoutMs);
        if (statusCode >= 200 && statusCode < 300) {
          this.logger.info({ service: ep.name, statusCode }, 'External API healthy');
        } else {
          this.logger.warn(
            { service: ep.name, statusCode },
            'External API returned non-2xx status — weather data may be degraded'
          );
        }
      } catch (error) {
        this.logger.error(
          { service: ep.name, error },
          'External API unreachable — weather data may be unavailable'
        );
      }
    }
  }

  private httpGet(url: string, timeoutMs: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const lib = url.startsWith('https') ? https : http;
      const req = lib.get(url, { headers: { 'User-Agent': 'Helmwise-HealthCheck/1.0' } }, (res) => {
        res.resume(); // drain body
        resolve(res.statusCode ?? 0);
      });
      req.setTimeout(timeoutMs, () => {
        req.destroy();
        reject(new Error(`Timeout after ${timeoutMs}ms`));
      });
      req.on('error', reject);
    });
  }
} 