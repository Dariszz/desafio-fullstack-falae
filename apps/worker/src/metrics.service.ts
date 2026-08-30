import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from '@prometheus-io/client';

export type AnalysisMetricOutcome = 'completed' | 'retry' | 'failed';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly outboxEvents = new Counter({
    name: 'falae_worker_outbox_events_total',
    help: 'Total de eventos do outbox processados por resultado.',
    labelNames: ['outcome'] as const,
    registers: [this.registry],
  });
  private readonly analysisAttempts = new Counter({
    name: 'falae_worker_analysis_attempts_total',
    help: 'Total de tentativas de análise iniciadas.',
    registers: [this.registry],
  });
  private readonly analysisResults = new Counter({
    name: 'falae_worker_analysis_results_total',
    help: 'Total de tentativas de análise finalizadas por resultado.',
    labelNames: ['outcome'] as const,
    registers: [this.registry],
  });
  private readonly analysisDuration = new Histogram({
    name: 'falae_worker_analysis_duration_seconds',
    help: 'Duração de cada tentativa de análise.',
    labelNames: ['outcome'] as const,
    buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
    registers: [this.registry],
  });
  private readonly analysesInProgress = new Gauge({
    name: 'falae_worker_analyses_in_progress',
    help: 'Quantidade atual de análises em execução.',
    registers: [this.registry],
  });

  constructor() {
    this.registry.setDefaultLabels({ service: 'worker' });
    collectDefaultMetrics({
      prefix: 'falae_worker_process_',
      register: this.registry,
    });
  }

  recordOutbox(outcome: 'published' | 'failed'): void {
    this.outboxEvents.inc({ outcome });
  }

  analysisStarted(): void {
    this.analysisAttempts.inc();
    this.analysesInProgress.inc();
  }

  analysisFinished(
    outcome: AnalysisMetricOutcome,
    durationSeconds: number,
  ): void {
    this.analysesInProgress.dec();
    this.analysisResults.inc({ outcome });
    this.analysisDuration.observe({ outcome }, durationSeconds);
  }

  metrics(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
