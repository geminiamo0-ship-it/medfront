import { Injectable } from '@nestjs/common';
import { DeepSeekService } from './deepseek.service';

export { QuestionContext } from './deepseek.service';

/**
 * AIService now uses DeepSeek v4 as the primary engine.
 * This class acts as a proxy to maintain compatibility with existing injections.
 */
@Injectable()
export class AIService extends DeepSeekService {}
