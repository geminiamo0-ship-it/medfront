import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../entities/user.entity';

@Injectable()
export class AdminGateGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN)) {
      throw new ForbiddenException('Admin access required');
    }

    const headerValue = request.headers['x-admin-gate'];
    const token = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!token) {
      throw new UnauthorizedException({
        code: 'ADMIN_GATE_REQUIRED',
        message: 'Admin gate required',
      });
    }

    const secret = this.configService.get<string>('ADMIN_GATE_SECRET');
    
    if (!secret) {
      throw new Error('ADMIN_GATE_SECRET must be configured');
    }

    try {
      const payload = this.jwtService.verify(token, { secret }) as {
        type?: string;
        sub?: number | string;
      };

      if (!payload || payload.type !== 'admin_gate') {
        throw new Error('Invalid admin gate token');
      }

      const requestUserId = user?.id || user?.userId;
      if (payload.sub && requestUserId && Number(payload.sub) !== Number(requestUserId)) {
        throw new Error('Admin gate token mismatch');
      }

      return true;
    } catch (error) {
      throw new UnauthorizedException({
        code: 'ADMIN_GATE_REQUIRED',
        message: 'Admin gate required',
      });
    }
  }
}
