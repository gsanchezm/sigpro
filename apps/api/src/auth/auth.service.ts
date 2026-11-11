import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { LoginInput, MfaInput, RegisterInput } from '@sigpro/shared';
import type { LoginResponse, RegisterResponse, SessionResponse, SessionUser } from '@sigpro/shared';
import { compare, hashSync } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import type { MfaPayload, RefreshPayload } from '../common/auth.types';
import { fail } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { accountBlock, registerFailure, resolveTenantId, unknownUserAttempts, type AccountBlock } from './lockout';
import { TokenService, toSessionUser } from './token.service';

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/** Bloqueada → 423; pendiente de aprobación o desactivada → 403 (el `code` es el motivo). */
const blockError = (block: AccountBlock) => (block === 'account_locked' ? fail.locked(block, block) : fail.forbidden(block, block));

@Injectable()
export class AuthService {
  private readonly unknownAttempts = unknownUserAttempts();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  private async tenantFor(header: string | undefined, email: string): Promise<string> {
    if (header?.trim()) return header.trim();
    const owners = await this.prisma.user.findMany({ where: { email }, select: { tenantId: true }, take: 3 });
    return resolveTenantId(undefined, owners.map((o) => o.tenantId));
  }

  /** 401 con nº de intentos · 423 al 5.º fallo o cuenta bloqueada · 403 pendiente de aprobación · MFA en dos pasos. */
  async login(input: LoginInput, tenantHeader: string | undefined): Promise<LoginResponse> {
    const email = normalizeEmail(input.email);
    const tenantId = await this.tenantFor(tenantHeader, email);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) throw fail.notFound('tenant_not_found', 'tenant_not_found');

    const user = await this.prisma.user.findUnique({ where: { tenantId_email: { tenantId, email } } });
    if (!user) throw this.invalidCredentials(this.unknownAttempts.fail(tenantId, email));
    if (user.lockedAt) throw fail.locked('account_locked', 'account_locked');

    const passwordOk = await compare(input.password, user.passwordHash);
    if (!passwordOk) throw await this.registerBadPassword(user);

    if (user.failedAttempts > 0) await this.prisma.user.update({ where: { tenantId_id: { tenantId, id: user.id } }, data: { failedAttempts: 0 } });
    this.unknownAttempts.clear(tenantId, email);

    const block = accountBlock(user);
    if (block) throw blockError(block);

    if (user.mfaCode) return { mfaRequired: true, mfaToken: this.tokens.issueMfaToken(user, input.remember), email: user.email };
    return { mfaRequired: false, ...this.tokens.issueSession(user, input.remember) };
  }

  private invalidCredentials(attempts: number) {
    return fail.unauthorized('invalid_credentials', 'invalid_credentials', { attempts });
  }

  private async registerBadPassword(user: User) {
    const { attempts, locked } = registerFailure(user.failedAttempts);
    await this.prisma.user.update({
      where: { tenantId_id: { tenantId: user.tenantId, id: user.id } },
      data: { failedAttempts: attempts, ...(locked ? { lockedAt: new Date() } : {}) },
    });
    return locked ? fail.locked('account_locked', 'account_locked') : this.invalidCredentials(attempts);
  }

  async verifyMfa(input: MfaInput): Promise<SessionResponse> {
    const payload = this.tokens.verify<MfaPayload>(input.mfaToken, 'mfa');
    const user = await this.prisma.user.findUnique({ where: { tenantId_id: { tenantId: payload.tenant, id: payload.sub } } });
    if (!user || user.mfaCode !== input.code) throw fail.unauthorized('invalid_mfa', 'invalid_mfa');
    // La cuenta pudo bloquearse o desactivarse entre el paso 1 y el 2 (el mfaToken dura 5 min): mismo criterio que el login
    const block = accountBlock(user);
    if (block) throw blockError(block);
    return this.tokens.issueSession(user, payload.remember);
  }

  async refresh(refreshToken: string): Promise<SessionResponse> {
    const payload = this.tokens.verify<RefreshPayload>(refreshToken, 'refresh');
    const user = await this.prisma.user.findUnique({ where: { tenantId_id: { tenantId: payload.tenant, id: payload.sub } } });
    if (!user || accountBlock(user)) throw fail.unauthorized('invalid_token', 'invalid_token');
    return this.tokens.issueSession(user, payload.remember);
  }

  async me(tenantId: string, userId: string): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({ where: { tenantId_id: { tenantId, id: userId } } });
    if (!user) throw fail.unauthorized('invalid_token', 'invalid_token');
    return toSessionUser(user);
  }

  /** Solicitud de acceso: crea el usuario pendiente de aprobación. 409 si el correo ya existe. */
  async register(input: RegisterInput, tenantHeader: string | undefined): Promise<RegisterResponse> {
    const tenantId = tenantHeader?.trim() || 'demo';
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) throw fail.notFound('tenant_not_found', 'tenant_not_found');

    const email = normalizeEmail(input.email);
    const existing = await this.prisma.user.findUnique({ where: { tenantId_email: { tenantId, email } }, select: { id: true } });
    if (existing) throw fail.conflict('email_exists', 'email_exists');

    const id = `r${randomBytes(4).toString('hex')}`;
    await this.prisma.user.create({
      data: {
        tenantId,
        id,
        name: `${input.first.trim()} ${input.last.trim()}`,
        email,
        passwordHash: hashSync(input.password, 10),
        role: input.role,
        org: input.org.trim(),
        pendingApproval: true,
      },
    });
    await this.audit.record({ tenantId, actorId: null, action: 'auth.register', entity: 'user', entityId: id, diff: { email, role: input.role } });
    const pending = await this.prisma.user.count({ where: { tenantId, pendingApproval: true } });
    return { requestId: `REQ-${new Date().getUTCFullYear()}-${String(400 + pending).padStart(4, '0')}`, status: 'pending_approval', email, role: input.role };
  }
}
