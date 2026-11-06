import { HttpException } from '@nestjs/common';
import { HTTP_STATUS_TEXT, type ApiErrorBody } from '@sigpro/shared';

/** Excepción HTTP con el cuerpo `ApiErrorBody` de la API (code estable para la UI). */
export class ApiException extends HttpException {
  constructor(status: number, code: string, message: string, extra: Partial<ApiErrorBody> = {}) {
    super({ statusCode: status, error: HTTP_STATUS_TEXT[status] ?? 'Error', message, code, ...extra }, status);
  }
}

type Extra = Partial<ApiErrorBody>;

export const fail = {
  badRequest: (code: string, message: string, extra?: Extra) => new ApiException(400, code, message, extra),
  unauthorized: (code: string, message: string, extra?: Extra) => new ApiException(401, code, message, extra),
  forbidden: (code: string, message: string, extra?: Extra) => new ApiException(403, code, message, extra),
  notFound: (code: string, message: string, extra?: Extra) => new ApiException(404, code, message, extra),
  conflict: (code: string, message: string, extra?: Extra) => new ApiException(409, code, message, extra),
  unprocessable: (code: string, message: string, errors: Readonly<Record<string, string>>) => new ApiException(422, code, message, { errors }),
  locked: (code: string, message: string, extra?: Extra) => new ApiException(423, code, message, extra),
  internal: (code: string, message: string) => new ApiException(500, code, message),
  notImplemented: (code: string, message: string) => new ApiException(501, code, message),
} as const;
