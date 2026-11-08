import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WebSocketGateway, WebSocketServer, type OnGatewayConnection, type OnGatewayDisconnect, type OnGatewayInit } from '@nestjs/websockets';
import { MISSION_SOCKET_EVENT, MISSION_SOCKET_PATH } from '@sigpro/shared';
import type { Server, Socket } from 'socket.io';
import type { AccessPayload } from '../common/auth.types';
import { loadEnv } from '../config/env';
import { MissionEventsService } from './mission-events.service';

/** Room de cada tenant: solo recibe los eventos de su tenant (el aislamiento del lab también vale en tiempo real). */
export const tenantRoom = (tenantId: string): string => `tenant:${tenantId}`;

/**
 * Gateway de Socket.IO del panel de misión. El JWT viaja en el handshake (`auth.token`); cada cliente entra en el room
 * de su tenant y recibe `mission:event`. El prefijo global `/api` no afecta a Socket.IO: el camino es `/socket.io`.
 */
@WebSocketGateway({
  path: MISSION_SOCKET_PATH,
  cors: { origin: loadEnv().CORS_ORIGIN.split(',').map((origin) => origin.trim()) },
})
export class MissionGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(MissionGateway.name);
  private readonly tenantBySocket = new Map<string, string>();
  private readonly clientsByTenant = new Map<string, number>();

  @WebSocketServer() private server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly events: MissionEventsService,
  ) {}

  /** El JWT se valida en el handshake: un token falso recibe `connect_error` y nunca llega a conectar. */
  afterInit(server: Server): void {
    server.use((socket, next) => {
      const auth: unknown = socket.handshake.auth;
      const token = typeof auth === 'object' && auth !== null && 'token' in auth ? (auth as { token?: unknown }).token : undefined;
      const payload = this.verify(typeof token === 'string' ? token : null);
      if (!payload) return next(new Error('invalid_token'));
      socket.data.tenantId = payload.tenant;
      return next();
    });
    this.events.attach((tenantId, event) => {
      this.server.to(tenantRoom(tenantId)).emit(MISSION_SOCKET_EVENT, event);
    });
  }

  handleConnection(client: Socket): void {
    const tenantId = client.data.tenantId as string | undefined;
    if (!tenantId) {
      client.disconnect(true);
      return;
    }
    void client.join(tenantRoom(tenantId));
    this.tenantBySocket.set(client.id, tenantId);
    this.clientsByTenant.set(tenantId, (this.clientsByTenant.get(tenantId) ?? 0) + 1);
  }

  handleDisconnect(client: Socket): void {
    const tenantId = this.tenantBySocket.get(client.id);
    if (!tenantId) return;
    this.tenantBySocket.delete(client.id);
    const left = (this.clientsByTenant.get(tenantId) ?? 1) - 1;
    if (left <= 0) this.clientsByTenant.delete(tenantId);
    else this.clientsByTenant.set(tenantId, left);
  }

  /** Tenants con algún cliente conectado: el simulador solo emite para ellos. */
  connectedTenants(): readonly string[] {
    return Array.from(this.clientsByTenant.keys());
  }

  private verify(token: string | null): AccessPayload | null {
    if (!token) return null;
    try {
      const payload = this.jwt.verify<AccessPayload>(token);
      return payload.type === 'access' ? payload : null;
    } catch (error) {
      this.logger.debug(`Handshake rechazado: ${error instanceof Error ? error.message : 'token inválido'}`);
      return null;
    }
  }
}
