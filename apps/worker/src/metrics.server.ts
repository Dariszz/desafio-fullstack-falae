import {
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { createServer, type Server } from 'node:http';
import { loadWorkerConfig } from './config.js';
import { MetricsService } from './metrics.service.js';

@Injectable()
export class MetricsServer implements OnModuleInit, OnApplicationShutdown {
  private readonly config = loadWorkerConfig();
  private readonly logger = new Logger(MetricsServer.name);
  private server?: Server;

  constructor(private readonly metricsService: MetricsService) {}

  async onModuleInit(): Promise<void> {
    this.server = createServer((request, response) => {
      if (request.method !== 'GET' || request.url !== '/metrics') {
        response.writeHead(404).end('Not Found');
        return;
      }

      void this.metricsService
        .metrics()
        .then((body) => {
          response.writeHead(200, {
            'Content-Type': this.metricsService.contentType,
          });
          response.end(body);
        })
        .catch((error: unknown) => {
          this.logger.error({
            event: 'metrics.scrape_failed',
            error: error instanceof Error ? error.message : String(error),
          });
          response.writeHead(500).end('Metrics unavailable');
        });
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.once('error', reject);
      this.server?.listen(this.config.metricsPort, '0.0.0.0', () => {
        this.server?.off('error', reject);
        resolve();
      });
    });

    this.logger.log({
      event: 'metrics.server_started',
      port: this.config.metricsPort,
    });
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve, reject) => {
      this.server?.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
