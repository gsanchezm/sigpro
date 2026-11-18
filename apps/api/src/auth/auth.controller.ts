import { Body, Controller, Get, Headers, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { forgotSchema, loginSchema, mfaSchema, registerSchema, TENANT_HEADER, type ForgotInput, type LoginInput, type MfaInput, type RegisterInput } from '@sigpro/shared';
import { z } from 'zod';
import { CurrentUser, Public, type AuthUser } from '../common/auth.types';
import { fail } from '../common/errors';
import { ZodApiBody, ZodPipe } from '../common/zod.pipe';
import { ENV, type Env } from '../config/env';
import { AuthService } from './auth.service';
import { assertEmailAllowed } from './email-policy';

const refreshSchema = z.object({ refreshToken: z.string().min(1) });
const resendSchema = z.object({ email: z.string().min(1) });
const logoutSchema = z.object({ refreshToken: z.string().nullable().optional() });

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Inicia sesión. Devuelve tokens o, si el usuario tiene MFA, un `mfaToken` para canjear en /auth/mfa.' })
  @ZodApiBody(loginSchema)
  login(@Body(new ZodPipe(loginSchema)) body: LoginInput, @Headers(TENANT_HEADER) tenant: string | undefined) {
    return this.auth.login(body, tenant);
  }

  @Public()
  @Post('mfa')
  @HttpCode(200)
  @ApiOperation({ summary: 'Segundo paso: canjea el `mfaToken` con el código de 6 dígitos (123456 en el seed).' })
  @ZodApiBody(mfaSchema)
  mfa(@Body(new ZodPipe(mfaSchema)) body: MfaInput) {
    return this.auth.verifyMfa(body);
  }

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Solicita acceso. El usuario queda pendiente de aprobación. 409 si el correo ya existe. 422 si el despliegue solo admite correos ficticios (`RESTRICT_EMAIL_DOMAINS`) y el dominio no está permitido.',
  })
  @ZodApiBody(registerSchema)
  register(@Body(new ZodPipe(registerSchema)) body: RegisterInput, @Headers(TENANT_HEADER) tenant: string | undefined) {
    // Antes de leer o escribir nada: ningún correo real llega a la base de datos, a la auditoría ni a los logs
    assertEmailAllowed(body.email, this.env);
    return this.auth.register(body, tenant);
  }

  @Public()
  @Post('forgot')
  @HttpCode(202)
  @ApiOperation({ summary: 'Recuperar contraseña. Responde 202 siempre, exista o no el correo. 422 si el dominio no está permitido (`RESTRICT_EMAIL_DOMAINS`).' })
  @ZodApiBody(forgotSchema)
  forgot(@Body(new ZodPipe(forgotSchema)) body: ForgotInput): Record<string, never> {
    assertEmailAllowed(body.email, this.env);
    return {};
  }

  @Public()
  @Post('resend')
  @HttpCode(202)
  @ApiOperation({ summary: 'Reenvía el correo de verificación. 422 si el dominio no está permitido (`RESTRICT_EMAIL_DOMAINS`).' })
  @ZodApiBody(resendSchema)
  resend(@Body(new ZodPipe(resendSchema)) body: z.infer<typeof resendSchema>): Record<string, never> {
    assertEmailAllowed(body.email, this.env);
    return {};
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Renueva el access token con el refresh token.' })
  @ZodApiBody(refreshSchema)
  refresh(@Body(new ZodPipe(refreshSchema)) body: z.infer<typeof refreshSchema>) {
    return this.auth.refresh(body.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Cierra sesión (los tokens son sin estado: el cliente descarta los suyos).' })
  @ZodApiBody(logoutSchema)
  logout(@Body(new ZodPipe(logoutSchema)) _body: z.infer<typeof logoutSchema>): void {
    return undefined;
  }

  @Public()
  @Get('sso')
  @ApiOperation({ summary: 'Acceso con certificado digital / SSO. No disponible: 501.' })
  sso(): never {
    throw fail.notImplemented('sso_not_available', 'sso_not_available');
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Usuario de la sesión actual.' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.tenantId, user.id);
  }
}
