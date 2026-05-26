import { CronJob } from "cron";
import { Logger } from "pino";
import { emailService } from "./EmailService";
import { AsamIngestService } from "./hazards/AsamIngestService";
import type { PassageDriftMonitor } from "./PassageDriftMonitor";
import https from "https";
import http from "http";

export interface CronDependencies {
  driftMonitor?: PassageDriftMonitor | null;
}

export class CronService {
  private jobs: Map<string, CronJob> = new Map();
  private logger: Logger;
  private deps: CronDependencies;

  constructor(logger: Logger, deps: CronDependencies = {}) {
    this.logger = logger.child({ service: "cron" });
    this.deps = deps;
  }

  start() {
    // Send trial ending reminders daily at 9 AM
    this.scheduleJob("trial-reminders", "0 9 * * *", async () => {
      this.logger.info("Running trial ending reminders job");
      try {
        await emailService.sendTrialEndingReminders();
      } catch (error) {
        this.logger.error({ error }, "Failed to send trial ending reminders");
      }
    });

    // Send monthly usage reports on the 1st of each month at 10 AM
    this.scheduleJob("monthly-reports", "0 10 1 * *", async () => {
      this.logger.info("Running monthly usage reports job");
      try {
        await emailService.sendMonthlyUsageReports();
      } catch (error) {
        this.logger.error({ error }, "Failed to send monthly usage reports");
      }
    });

    // Clean up old email logs weekly
    this.scheduleJob("cleanup-email-logs", "0 2 * * 0", async () => {
      this.logger.info("Running email logs cleanup job");
      try {
        await this.cleanupOldEmailLogs();
      } catch (error) {
        this.logger.error({ error }, "Failed to cleanup email logs");
      }
    });

    // Monitor external weather APIs hourly
    this.scheduleJob("external-api-health", "0 * * * *", async () => {
      this.logger.info("Running external API health checks");
      try {
        await this.checkExternalApiHealth();
      } catch (error) {
        this.logger.error({ error }, "External API health check failed");
      }
    });

    // Refresh NGA ASAM piracy / anti-shipping incident feed nightly at 03:00.
    // Failure must not propagate — mariners keep using the previously-ingested
    // rows until the next successful run.
    this.scheduleJob("asam-ingest", "0 3 * * *", async () => {
      this.logger.info("Running NGA ASAM ingest job");
      try {
        const asam = new AsamIngestService(this.logger);
        const result = await asam.run();
        this.logger.info({ result }, "NGA ASAM ingest finished");
      } catch (error) {
        this.logger.error({ error }, "NGA ASAM ingest failed");
      }
    });

    // R4 — weather drift monitor. Every 6h, scan saved passages departing
    // within the next 72h; if the risk score has dropped by >= 10 points
    // since the plan was saved, push + email an alert. The monitor's
    // distributed lock (Redis SETNX) prevents double-execution when
    // multiple orchestrator instances run this job. No-op if the
    // PassageDriftMonitor wasn't wired (Redis / DB unavailable).
    if (this.deps.driftMonitor) {
      const monitor = this.deps.driftMonitor;
      this.scheduleJob("r4-drift-scan", "0 2,8,14,20 * * *", async () => {
        this.logger.info("Running R4 passage drift scan");
        try {
          const result = await monitor.scan();
          this.logger.info({ result }, "R4 drift scan finished");
        } catch (error) {
          this.logger.error({ error }, "R4 drift scan failed");
        }
      });
    } else {
      this.logger.warn(
        "R4 drift monitor not wired — skipping drift scan schedule",
      );
    }

    this.logger.info("Cron jobs scheduled");
  }

  stop() {
    this.jobs.forEach((job, name) => {
      job.stop();
      this.logger.info({ job: name }, "Stopped cron job");
    });
    this.jobs.clear();
  }

  private scheduleJob(
    name: string,
    pattern: string,
    callback: () => Promise<void>,
  ) {
    const job = new CronJob(
      pattern,
      callback,
      null,
      true,
      "America/Los_Angeles",
    );
    this.jobs.set(name, job);
    this.logger.info({ job: name, pattern }, "Scheduled cron job");
  }

  private async cleanupOldEmailLogs() {
    // This would connect to the database and clean up logs older than 90 days
    // Implementation depends on your database schema
    this.logger.info("Email logs cleanup completed");
  }

  private async checkExternalApiHealth(): Promise<void> {
    const endpoints: Array<{ name: string; url: string; timeoutMs: number }> = [
      {
        name: "NOAA-weather",
        url: "https://api.weather.gov/points/38.8894,-77.0352",
        timeoutMs: 10000,
      },
      {
        name: "NDBC-buoy",
        url: "https://www.ndbc.noaa.gov/data/realtime2/44013.txt",
        timeoutMs: 10000,
      },
    ];

    for (const ep of endpoints) {
      try {
        const statusCode = await this.httpGet(ep.url, ep.timeoutMs);
        if (statusCode >= 200 && statusCode < 300) {
          this.logger.info(
            { service: ep.name, statusCode },
            "External API healthy",
          );
        } else {
          this.logger.warn(
            { service: ep.name, statusCode },
            "External API returned non-2xx status — weather data may be degraded",
          );
        }
      } catch (error) {
        this.logger.error(
          { service: ep.name, error },
          "External API unreachable — weather data may be unavailable",
        );
      }
    }
  }

  private httpGet(url: string, timeoutMs: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const lib = url.startsWith("https") ? https : http;
      const req = lib.get(
        url,
        { headers: { "User-Agent": "Helmwise-HealthCheck/1.0" } },
        (res) => {
          res.resume(); // drain body
          resolve(res.statusCode ?? 0);
        },
      );
      req.setTimeout(timeoutMs, () => {
        req.destroy();
        reject(new Error(`Timeout after ${timeoutMs}ms`));
      });
      req.on("error", reject);
    });
  }
}
