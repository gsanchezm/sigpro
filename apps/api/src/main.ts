import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ADMIN_KEY_HEADER, TENANT_HEADER } from '@sigpro/shared';
import { AppModule } from './app.module';
import { docsBasicAuth } from './common/docs-auth';
import { API_VERSION } from './config/config.controller';
import { loadEnv, type Env } from './config/env';

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
  // Basic auth opcional (entorno del curso): protege Swagger UI y también el JSON de OpenAPI
  if (env.DOCS_BASIC_AUTH) app.use(['/api/docs', '/api/docs-json'], docsBasicAuth(env.DOCS_BASIC_AUTH));
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
