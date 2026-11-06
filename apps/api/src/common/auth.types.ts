import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Permission, Role } from '@sigpro/shared';
import type { Request } from 'express';

/** Usuario autenticado que el guard deja en `req.user`. */
export interface AuthUser {
  readonly id: string;
  readonly tenantId: string;
  readonly role: Role;
  readonly name: string;
  readonly email: string;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
  /** `true` si la petición se autenticó con `X-Admin-Key`. */
  adminKey?: boolean;
}

export const IS_PUBLIC = 'sigpro:public';
export const PERMISSION = 'sigpro:permission';
export const ALLOW_ADMIN_KEY = 'sigpro:admin-key';

export const Public = () => SetMetadata(IS_PUBLIC, true);
export const RequirePermission = (permission: Permission) => SetMetadata(PERMISSION, permission);
/** La ruta acepta `X-Admin-Key` como alternativa al JWT (cron de reset nocturno). */
export const AllowAdminKey = () => SetMetadata(ALLOW_ADMIN_KEY, true);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<AuthedRequest>();
  return request.user as AuthUser;
});

export interface AccessPayload {
  readonly sub: string;
  readonly tenant: string;
  readonly role: Role;
  readonly name: string;
  readonly email: string;
  readonly type: 'access';
}
export interface RefreshPayload {
  readonly sub: string;
  readonly tenant: string;
  readonly type: 'refresh';
  readonly remember: boolean;
}
export interface MfaPayload {
  readonly sub: string;
  readonly tenant: string;
  readonly type: 'mfa';
  readonly remember: boolean;
}
