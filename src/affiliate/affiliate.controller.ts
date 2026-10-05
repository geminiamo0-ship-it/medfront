import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { AffiliateService } from "./affiliate.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("Affiliate")
@Controller("affiliate")
@ApiBearerAuth()
export class AffiliateController {
  constructor(private readonly affiliateService: AffiliateService) {}

  @Get("my-stats")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Get affiliate program stats and personal affiliate code",
  })
  async getMyStats(
    @Request() req,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const safePage = Math.max(1, parseInt(page || "1", 10) || 1);
    const safePageSize = Math.min(
      100,
      Math.max(1, parseInt(pageSize || "20", 10) || 20),
    );
    return this.affiliateService.getMyAffiliateStats(
      req.user.id,
      safePage,
      safePageSize,
    );
  }

  @Post("apply-code")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Apply a referral code to your account (one-time, gives that affiliate coupon discount)",
  })
  async applyCode(@Request() req, @Body() body: { referralCode: string }) {
    return this.affiliateService.applyReferralCode(
      req.user.id,
      body.referralCode,
    );
  }

  @Post("clear-code")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Clear an applied referral code (only if unpaid).",
  })
  async clearCode(@Request() req) {
    return this.affiliateService.clearReferralCode(req.user.id);
  }
}
