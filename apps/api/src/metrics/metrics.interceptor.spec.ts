import { describe, expect, it, jest } from '@jest/globals';
import {
  BadRequestException,
  type CallHandler,
  type ExecutionContext,
} from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import type { MetricsService } from './metrics.service.js';
import { MetricsInterceptor } from './metrics.interceptor.js';

function setup(responseStatus = 200) {
  const recordHttp = jest.fn<MetricsService['recordHttp']>();
  const metrics = { recordHttp } as unknown as MetricsService;
  const context = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'GET',
        baseUrl: '/reviews',
        route: { path: '/:id' },
      }),
      getResponse: () => ({ statusCode: responseStatus }),
    }),
  } as unknown as ExecutionContext;

  return {
    interceptor: new MetricsInterceptor(metrics),
    context,
    recordHttp,
  };
}

describe('MetricsInterceptor', () => {
  it('records the response status for successful requests', async () => {
    const { interceptor, context, recordHttp } = setup(202);
    const next = { handle: () => of(undefined) } as CallHandler;

    await lastValueFrom(interceptor.intercept(context, next));

    expect(recordHttp).toHaveBeenCalledWith(
      'GET',
      '/reviews/:id',
      202,
      expect.any(Number),
    );
  });

  it('records the status from an HTTP exception and rethrows it', async () => {
    const { interceptor, context, recordHttp } = setup();
    const error = new BadRequestException('Identificador inválido.');
    const next = {
      handle: () => throwError(() => error),
    } as CallHandler;

    await expect(
      lastValueFrom(interceptor.intercept(context, next)),
    ).rejects.toBe(error);

    expect(recordHttp).toHaveBeenCalledWith(
      'GET',
      '/reviews/:id',
      400,
      expect.any(Number),
    );
  });

  it('records unexpected errors as internal server errors', async () => {
    const { interceptor, context, recordHttp } = setup();
    const error = new Error('unexpected');
    const next = {
      handle: () => throwError(() => error),
    } as CallHandler;

    await expect(
      lastValueFrom(interceptor.intercept(context, next)),
    ).rejects.toBe(error);

    expect(recordHttp).toHaveBeenCalledWith(
      'GET',
      '/reviews/:id',
      500,
      expect.any(Number),
    );
  });
});
