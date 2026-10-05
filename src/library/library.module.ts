import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LibraryController } from "./library.controller";
import { AdminLibraryController } from "./admin-library.controller";
import { LibraryService } from "./library.service";
import { LibraryCacheService } from "./library-cache.service";
import { AIService } from "./ai.service";
import { DeepSeekService } from "./deepseek.service";
import { AIGeminiDraftedService } from "./ai-gemini-drafted.service";
import { LibraryArticle } from "../entities/library-article.entity";
import { LibraryArticleLocation } from "../entities/library-article-location.entity";
import { LibraryTooltip } from "../entities/library-tooltip.entity";
import { ArticleProgress } from "../entities/article-progress.entity";
import { ArticleHighlight } from "../entities/article-highlight.entity";
import { ArticleAiSummary } from "../entities/article-ai-summary.entity";
import { AiUsageLog } from "../entities/ai-usage-log.entity";
import { LibraryBookmarkState } from "../entities/library-bookmark-state.entity";
import { AdminModule } from "../admin/admin.module";
import { ActivityModule } from "../activity/activity.module";
import { SecurityModule } from "../security/security.module";
import { SettingsModule } from "../settings/settings.module";
import { TelegramService } from "../integrations/telegram.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LibraryArticle,
      LibraryArticleLocation,
      LibraryTooltip,
      ArticleProgress,
      ArticleHighlight,
      ArticleAiSummary,
      AiUsageLog,
      LibraryBookmarkState,
    ]),
    AdminModule,
    ActivityModule,
    SecurityModule,
    SettingsModule,
  ],
  controllers: [LibraryController, AdminLibraryController],
  providers: [
    LibraryService, 
    LibraryCacheService, 
    DeepSeekService, 
    AIGeminiDraftedService,
    AIService,
    TelegramService,
  ],
  exports: [LibraryService, AIService, DeepSeekService],
})
export class LibraryModule {}
