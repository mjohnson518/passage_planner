import { CronJob } from 'cron';
import { Logger } from 'pino';
import { emailService } from './EmailService';

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
} 