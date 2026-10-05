import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Test } from '../../entities/test.entity';
import { SubscriptionService } from '../../subscriptions/subscription.service';

@Injectable()
export class TestAccessGuard implements CanActivate {
  constructor(
    private subscriptionService: SubscriptionService,
    @InjectRepository(Test)
    private testRepository: Repository<Test>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      return true; // Let JwtAuthGuard handle authentication
    }

    // Extract step number or test ID
    let step = request.body?.step || request.query?.step;
    const testId = request.params?.id || request.body?.testId || request.query?.testId;

    // If we have a testId but no step, look up the test to find its step
    if (testId && !step) {
      const test = await this.testRepository.findOne({
        where: { id: parseInt(testId.toString()) },
        select: ['id', 'step'],
      });
      if (test) {
        step = test.step;
      }
    }

    if (!step) {
      // If no step can be determined, allow (might be general metadata)
      return true;
    }

    const stepNumber = typeof step === 'string' ? parseInt(step) : step;

    // Check step access
    const accessCheck = await this.subscriptionService.hasAccessToStep(
      user, // ✅ Pass full user object
      stepNumber,
    );

    if (!accessCheck.hasAccess) {
      throw new ForbiddenException({
        message: accessCheck.reason,
        requiresUpgrade: accessCheck.requiresUpgrade,
        step: stepNumber,
      });
    }

    // Check question bank access if questionBankIds are provided in body (for creating/filtering)
    const questionBankIds = request.body?.filters?.questionBankIds || [];
    
    if (questionBankIds && questionBankIds.length > 0) {
      for (const qbankId of questionBankIds) {
        const qbankAccess = await this.subscriptionService.hasAccessToQuestionBank(
          user, 
          Number(qbankId),
        );

        if (!qbankAccess.hasAccess) {
          throw new ForbiddenException({
            message: qbankAccess.reason,
            requiresUpgrade: qbankAccess.requiresUpgrade,
            questionBankId: qbankId,
          });
        }
      }
    }

    return true;
  }
}
