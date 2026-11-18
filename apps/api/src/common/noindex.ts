import type { NextFunction, Request, Response } from 'express';

/** Valor de `X-Robots-Tag` en los despliegues del curso (`ROBOTS_NOINDEX=true`). */
export const NOINDEX_VALUE = 'noindex, nofollow';

/** Cuerpo de `/robots.txt` de la API: prohíbe el rastreo completo. */
export const ROBOTS_TXT = 'User-agent: *\nDisallow: /\n';

/** Middleware global: marca TODAS las respuestas (JSON, Swagger, errores) como no indexables. */
export const noindexHeader = (_request: Request, response: Response, next: NextFunction): void => {
  response.setHeader('X-Robots-Tag', NOINDEX_VALUE);
  next();
};
