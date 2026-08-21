import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const authHeader = client.handshake.headers.authorization || client.handshake.auth?.token;
      if (!authHeader) {
        client.disconnect();
        return;
      }

      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
      const payload = this.jwtService.verify(token);

      client.data.user = payload;

      // Join user specific room
      client.join(`user:${payload.sub}`);

      // Join tenant specific room if tenantId present
      if (payload.tenantId) {
        client.join(`tenant:${payload.tenantId}`);
      }

      this.logger.log(`⚡ Client connected: User ${payload.sub} (Socket: ${client.id})`);
    } catch (e) {
      this.logger.warn(`WebSocket auth failed: ${e.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`⚡ Client disconnected: ${client.id}`);
  }

  sendToUser(userId: string, event: string, payload: any) {
    if (this.server) {
      this.server.to(`user:${userId}`).emit(event, payload);
    }
  }

  sendToTenant(tenantId: string, event: string, payload: any) {
    if (this.server) {
      this.server.to(`tenant:${tenantId}`).emit(event, payload);
    }
  }
}
