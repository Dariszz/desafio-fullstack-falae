import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from '@prometheus-io/client';

export type ReviewMetricOutcome =
  'created' | 'duplicate' | 'idempotency_conflict' | 'reprocessed';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly httpRequests = new Counter({
    name: 'falae_api_http_requests_total',
    help: 'Total de requisições HTTP recebidas pela API.',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [this.registry],
  });
  private readonly httpDuration = new Histogram({
    name: 'falae_api_http_request_duration_seconds',
    help: 'Duração das requisições HTTP recebidas pela API.',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });
  private readonly reviews = new Counter({
    name: 'falae_reviews_total',
    help: 'Total de avaliações recebidas e reprocessadas por resultado.',
    labelNames: ['outcome'] as const,
    registers: [this.registry],
  });

  constructor() {
    this.registry.setDefaultLabels({ service: 'api' });
    collectDefaultMetrics({
      prefix: 'falae_api_process_',
      register: this.registry,
    });
  }

  recordHttp(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
  ): void {
    const labels = {
      method,
      route,
      status_code: String(statusCode),
    };
    this.httpRequests.inc(labels);
    this.httpDuration.observe(labels, durationSeconds);
  }

  recordReview(outcome: ReviewMetricOutcome): void {
    this.reviews.inc({ outcome });
  }

  metrics(): Promise<string> {
    return this.registry.metrics();
  }
}
