import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin/admin.controller';
import { AuditService } from './audit/audit.service';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { TokenService } from './auth/token.service';
import { ChaosInterceptor } from './chaos/chaos.interceptor';
import { ChaosService } from './chaos/chaos.service';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { ConfigController } from './config/config.controller';
import { DocumentsController } from './documents/documents.controller';
import { DocumentsService } from './documents/documents.service';
import { ENV, loadEnv } from './config/env';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma/prisma.service';
import { ProgramsController } from './programs/programs.controller';
import { ProgramsService } from './programs/programs.service';
import { RequirementsController } from './requirements/requirements.controller';
import { RequirementsService } from './requirements/requirements.service';
import { SeedService } from './seed/seed.service';
import { UsersController } from './users/users.controller';
import { VerificationController } from './verification/verification.controller';
import { VerificationService } from './verification/verification.service';

const env = loadEnv();

@Module({
  imports: [JwtModule.register({ global: true, secret: env.JWT_SECRET })],
  controllers: [HealthController, ConfigController, AuthController, ProgramsController, RequirementsController, VerificationController, DocumentsController, UsersController, AdminController],
  providers: [
    { provide: ENV, useValue: env },
    PrismaService,
    AuditService,
    ChaosService,
    SeedService,
    TokenService,
    AuthService,
    ProgramsService,
    RequirementsService,
    VerificationService,
    DocumentsService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: ChaosInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
