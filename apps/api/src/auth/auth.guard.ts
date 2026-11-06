import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ADMIN_KEY_HEADER, can, type Permission } from '@sigpro/shared';
import { ENV, type Env } from '../config/env';
import { ALLOW_ADMIN_KEY, IS_PUBLIC, PERMISSION, type AccessPayload, type AuthedRequest } from '../common/auth.types';
import { fail } from '../common/errors';

const bearerOf = (header: string | undefined): string | null => {
  const [scheme, token] = (header ?? '').split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
};

/** Guard global: JWT en `Authorization: Bearer`, rutas `@Public()` y permisos por rol (`@RequirePermission`). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();

    const adminKey = request.headers[ADMIN_KEY_HEADER];
    if (this.reflector.getAllAndOverride<boolean>(ALLOW_ADMIN_KEY, targets) && adminKey === this.env.ADMIN_KEY) {
      request.adminKey = true;
      return true;
    }

    const payload = this.verify(bearerOf(request.headers.authorization));
    request.user = { id: payload.sub, tenantId: payload.tenant, role: payload.role, name: payload.name, email: payload.email };

    const permission = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSION, targets);
    if (permission && !can(payload.role, permission)) throw fail.forbidden('forbidden', 'forbidden');
    return true;
  }

  private verify(token: string | null): AccessPayload {
    if (!token) throw fail.unauthorized('missing_token', 'missing_token');
    try {
      const payload = this.jwt.verify<AccessPayload>(token);
      if (payload.type !== 'access') throw new Error('tipo de token incorrecto');
      return payload;
    } catch {
      throw fail.unauthorized('invalid_token', 'invalid_token');
    }
  }
}
