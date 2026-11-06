import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import type { SessionResponse, SessionUser } from '@sigpro/shared';
import { ENV, type Env } from '../config/env';
import { fail } from '../common/errors';
import type { AccessPayload, MfaPayload, RefreshPayload } from '../common/auth.types';

const MFA_TTL_S = 5 * 60;
const REFRESH_REMEMBER_TTL_S = 7 * 24 * 3600;
const REFRESH_SESSION_TTL_S = 12 * 3600;

export const toSessionUser = (user: Pick<User, 'id' | 'name' | 'email' | 'role' | 'mfaCode' | 'tenantId'>): SessionUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  mfa: user.mfaCode !== null,
  tenant: user.tenantId,
});

type PayloadType = 'refresh' | 'mfa';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Access JWT corto + refresh (7 días con "recordar", 12 h sin él). */
  issueSession(user: User, remember: boolean): SessionResponse {
    const access: AccessPayload = { sub: user.id, tenant: user.tenantId, role: user.role, name: user.name, email: user.email, type: 'access' };
    const refresh: RefreshPayload = { sub: user.id, tenant: user.tenantId, type: 'refresh', remember };
    return {
      user: toSessionUser(user),
      accessToken: this.jwt.sign(access, { expiresIn: this.env.ACCESS_TOKEN_TTL_S }),
      refreshToken: this.jwt.sign(refresh, { expiresIn: remember ? REFRESH_REMEMBER_TTL_S : REFRESH_SESSION_TTL_S }),
      expiresIn: this.env.ACCESS_TOKEN_TTL_S,
    };
  }

  issueMfaToken(user: User, remember: boolean): string {
    const payload: MfaPayload = { sub: user.id, tenant: user.tenantId, type: 'mfa', remember };
    return this.jwt.sign(payload, { expiresIn: MFA_TTL_S });
  }

  verify<T extends RefreshPayload | MfaPayload>(token: string, type: PayloadType): T {
    try {
      const payload = this.jwt.verify<T>(token);
      if (payload.type !== type) throw new Error('tipo de token incorrecto');
      return payload;
    } catch {
      throw fail.unauthorized(type === 'mfa' ? 'invalid_mfa' : 'invalid_token', type === 'mfa' ? 'invalid_mfa' : 'invalid_token');
    }
  }
}
