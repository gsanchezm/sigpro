import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ADMIN_KEY_HEADER, TENANT_HEADER } from '@sigpro/shared';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { API_VERSION } from './config/config.controller';
import { loadEnv, type Env } from './config/env';

/** Basic auth opcional para /api/docs (entorno del curso). Vacío = sin protección. */
const docsBasicAuth = (credentials: string) => (request: Request, response: Response, next: NextFunction) => {
  const [scheme, encoded] = (request.headers.authorization ?? '').split(' ');
  const provided = scheme?.toLowerCase() === 'basic' && encoded ? Buffer.from(encoded, 'base64').toString('utf8') : '';
  if (provided === credentials) return next();
  response.setHeader('WWW-Authenticate', 'Basic realm="SIGPRO API docs"');
  response.status(401).send('Authentication required');
};

const setupDocs = (app: Awaited<ReturnType<typeof NestFactory.create>>, env: Env): void => {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('SIGPRO API')
      .setDescription('API del laboratorio SIGPRO. Cada alumno trabaja en su tenant (cabecera `x-tenant` en los endpoints públicos).')
      .setVersion(API_VERSION)
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
      .addApiKey({ type: 'apiKey', in: 'header', name: ADMIN_KEY_HEADER }, 'admin-key')
      .addGlobalParameters({ name: TENANT_HEADER, in: 'header', required: false, description: 'Tenant (demo, alumno01…). Por defecto: demo.' })
      .build(),
  );
  if (env.DOCS_BASIC_AUTH) app.use('/api/docs', docsBasicAuth(env.DOCS_BASIC_AUTH));
  SwaggerModule.setup('api/docs', app, document, { jsonDocumentUrl: 'api/docs-json' });
};

const bootstrap = async (): Promise<void> => {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
    allowedHeaders: ['Content-Type', 'Authorization', TENANT_HEADER, ADMIN_KEY_HEADER],
    exposedHeaders: ['Content-Disposition'],
  });
  setupDocs(app, env);
  await app.listen(env.PORT, '0.0.0.0');
  new Logger('Bootstrap').log(`SIGPRO API en http://localhost:${env.PORT}/api (docs: /api/docs)`);
};

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
