import { CallHandler, ExecutionContext, Injectable, NestInterceptor, HttpException, HttpStatus } from '@nestjs/common';
import { Observable } from 'rxjs';
import { SettingsService } from './settings.service';
import { UserRole } from '../entities/user.entity';

@Injectable()
export class MaintenanceInterceptor implements NestInterceptor {
  constructor(private readonly settingsService: SettingsService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    
    // Skip checking public config route to avoid infinite loops or blocking the frontend from knowing it's maintenance mode
    // Also skip authentication routes so admins can still log in
    if (request.path && (request.path.includes('/settings/public') || request.path.includes('/auth/'))) {
      return next.handle();
    }

    const rawMaintenanceMode = await this.settingsService.getString('MAINTENANCE_MODE', 'false');
    const isMaintenanceMode = rawMaintenanceMode.toLowerCase() === 'true';

    if (isMaintenanceMode) {
      const user = request.user;
      
      // Allow admins and super admins to bypass maintenance mode
      const isAdmin = user && (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN);
      
      if (!isAdmin) {
        throw new HttpException(
          {
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            message: 'Maintenance Mode Active',
            code: 'MAINTENANCE_MODE',
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    }

    return next.handle();
  }
}
