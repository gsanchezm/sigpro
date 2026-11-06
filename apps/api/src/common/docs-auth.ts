import type { NextFunction, Request, Response } from 'express';

/** Comprueba la cabecera `Authorization: Basic …` contra `usuario:contraseña`. */
export const hasBasicCredentials = (header: string | undefined, credentials: string): boolean => {
  const [scheme, encoded] = (header ?? '').split(' ');
  const provided = scheme?.toLowerCase() === 'basic' && encoded ? Buffer.from(encoded, 'base64').toString('utf8') : '';
  return provided === credentials;
};

/** Basic auth opcional de la documentación (`/api/docs` y `/api/docs-json`). Sin credenciales válidas → 401 + `WWW-Authenticate`. */
export const docsBasicAuth = (credentials: string) => (request: Request, response: Response, next: NextFunction) => {
  if (hasBasicCredentials(request.headers.authorization, credentials)) return next();
  response.setHeader('WWW-Authenticate', 'Basic realm="SIGPRO API docs"');
  response.status(401).send('Authentication required');
};
