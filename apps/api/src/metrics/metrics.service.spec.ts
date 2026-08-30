import { describe, expect, it } from '@jest/globals';
import { MetricsService } from './metrics.service.js';

describe('MetricsService', () => {
  it('exports HTTP and review metrics in Prometheus format', async () => {
    const service = new MetricsService();

    service.recordReview('created');
    service.recordHttp('POST', '/reviews', 202, 0.125);

    const output = await service.metrics();

    expect(output).toContain('falae_reviews_total');
    expect(output).toContain('outcome="created"');
    expect(output).toContain('falae_api_http_requests_total');
    expect(output).toContain('method="POST"');
    expect(output).toContain('route="/reviews"');
    expect(output).toContain('status_code="202"');
    expect(output).toContain('falae_api_http_request_duration_seconds');
  });
});
