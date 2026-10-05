import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionService } from './subscription.service';

export const REQUIRES_STEP_KEY = 'requiresStep';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private subscriptionService: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredStep = this.reflector.getAllAndOverride<number>(REQUIRES_STEP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no step requirement is set, allow access
    if (!requiredStep) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const userId = user?.id ?? user?.userId;
    if (!user || !userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    // ✅ Pass the full user object instead of just userId
    const accessCheck = await this.subscriptionService.hasAccessToStep(
      user, // Pass entire user object (already fetched by JwtAuthGuard)
      requiredStep,
    );

    if (!accessCheck.hasAccess) {
      throw new ForbiddenException({
        message: accessCheck.reason,
        requiresUpgrade: accessCheck.requiresUpgrade,
        step: requiredStep,
      });
    }

    return true;
  }
}
