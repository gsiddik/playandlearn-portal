import { Injectable } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets';
import type { IncomingMessage } from 'http';
import type { WebSocket } from 'ws';
import { verifyAccess } from './auth';

export interface LiveEvent {
  classId: string; studentId: string; alias: string; activityId: string;
  type: string; level: number | null; ts: string;
}

/**
 * Hub dalam-proses: meneruskan event bermain murid ke guru sekolah yang sama (isolasi per tenant).
 * Satu instance saja; untuk beberapa instance server perlu broker pesan (mis. RabbitMQ/Redis) — belum dikerjakan.
 */
@Injectable()
export class LiveHub {
  private subs = new Map<string, Set<WebSocket>>();
  add(tenantId: string, ws: WebSocket) {
    if (!this.subs.has(tenantId)) this.subs.set(tenantId, new Set());
    this.subs.get(tenantId)!.add(ws);
  }
  remove(ws: WebSocket) { for (const s of this.subs.values()) s.delete(ws); }
  publish(tenantId: string, e: LiveEvent) {
    const msg = JSON.stringify(e);
    for (const ws of this.subs.get(tenantId) ?? []) if (ws.readyState === 1) ws.send(msg);
  }
  count(tenantId: string) { return this.subs.get(tenantId)?.size ?? 0; }
}

@WebSocketGateway({ path: '/v1/live' })
export class LiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private hub: LiveHub) {}
  handleConnection(client: WebSocket, req: IncomingMessage) {
    const token = new URL(req.url ?? '', 'http://x').searchParams.get('token');
    const u = verifyAccess(token);
    if (!u || !['teacher', 'school_admin'].includes(u.role)) { client.close(4401, 'unauthorized'); return; }
    this.hub.add(u.tenantId, client);
  }
  handleDisconnect(client: WebSocket) { this.hub.remove(client); }
}
