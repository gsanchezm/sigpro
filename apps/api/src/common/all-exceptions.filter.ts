import { Catch, HttpException, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { HTTP_STATUS_TEXT, type ApiErrorBody } from '@sigpro/shared';
import { randomBytes } from 'node:crypto';
import type { Response } from 'express';

/** `7f3a-c21d`: identificador de traza que la UI muestra junto al error. */
const newTraceId = (): string => {
  const hex = randomBytes(4).toString('hex');
  return `${hex.slice(0, 4)}-${hex.slice(4)}`;
};

const isBody = (value: unknown): value is Partial<ApiErrorBody> => typeof value === 'object' && value !== null;

/** Normaliza cualquier excepción a `ApiErrorBody` y añade `traceId`. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const raw = exception instanceof HttpException ? exception.getResponse() : undefined;
    const base: Partial<ApiErrorBody> = isBody(raw) ? raw : { message: typeof raw === 'string' ? raw : undefined };

    if (status >= 500 && !(exception instanceof HttpException)) this.logger.error(exception instanceof Error ? exception.stack : String(exception));

    const body: ApiErrorBody = {
      ...base,
      statusCode: status,
      error: HTTP_STATUS_TEXT[status] ?? base.error ?? 'Error',
      message: typeof base.message === 'string' ? base.message : status >= 500 ? 'internal_error' : 'error',
      traceId: newTraceId(),
    };
    response.status(status).json(body);
  }
}
