import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { catchError, finalize, throwError } from 'rxjs';
import { MetricsService } from './metrics.service.js';

interface HttpRequest {
  method: string;
  baseUrl?: string;
  route?: { path?: string };
}

interface HttpResponse {
  statusCode: number;
}

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<HttpRequest>();
    const response = context.switchToHttp().getResponse<HttpResponse>();
    const startedAt = process.hrtime.bigint();
    let statusCode: number | undefined;

    return next.handle().pipe(
      catchError((error: unknown) => {
        statusCode =
          error instanceof HttpException
            ? error.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;
        return throwError(() => error);
      }),
      finalize(() => {
        const durationSeconds =
          Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
        const route = request.route?.path
          ? `${request.baseUrl ?? ''}${request.route.path}`
          : 'unmatched';
        this.metrics.recordHttp(
          request.method,
          route,
          statusCode ?? response.statusCode,
          durationSeconds,
        );
      }),
    );
  }
}
