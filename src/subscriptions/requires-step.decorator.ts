import { SetMetadata } from '@nestjs/common';
import { REQUIRES_STEP_KEY } from './subscription.guard';

export const RequiresStep = (step: number) => SetMetadata(REQUIRES_STEP_KEY, step);
