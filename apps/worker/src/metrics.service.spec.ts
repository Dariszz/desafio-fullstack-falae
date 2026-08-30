import { describe, expect, it } from '@jest/globals';
import { MetricsService } from './metrics.service.js';

describe('MetricsService', () => {
  it('exports outbox and analysis metrics in Prometheus format', async () => {
    const service = new MetricsService();

    service.recordOutbox('published');
    service.analysisStarted();
    service.recordNegativeAlert();
    service.analysisFinished('completed', 0.75);
    service.analysisEnded();

    const output = await service.metrics();

    expect(output).toContain('falae_worker_outbox_events_total');
    expect(output).toContain('outcome="published"');
    expect(output).toContain('falae_worker_analysis_attempts_total');
    expect(output).toContain('falae_worker_analysis_results_total');
    expect(output).toContain('outcome="completed"');
    expect(output).toContain('falae_worker_analysis_duration_seconds');
    expect(output).toContain('falae_worker_analyses_in_progress');
    expect(output).toContain(
      'falae_worker_analyses_in_progress{service="worker"} 0',
    );
    expect(output).toContain('falae_worker_negative_alerts_total');
  });
});
