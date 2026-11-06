import type { PipeTransform } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { flattenIssues } from '@sigpro/shared';
import type { z, ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { fail } from './errors';

/** Valida el cuerpo con el mismo esquema Zod que usa la web. Errores → 422 con `errors: { campo: claveI18n }`. */
export class ZodPipe<T extends ZodTypeAny> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value ?? {});
    if (result.success) return result.data as z.infer<T>;
    throw fail.unprocessable('validation_failed', 'validation_failed', flattenIssues(result.error.issues));
  }
}

/** Documenta el cuerpo en OpenAPI a partir del esquema Zod. */
export const ZodApiBody = (schema: ZodTypeAny): MethodDecorator =>
  ApiBody({ schema: zodToJsonSchema(schema, { target: 'openApi3', $refStrategy: 'none' }) as Record<string, unknown> });
