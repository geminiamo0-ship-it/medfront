import {
  Controller,
  Get,
  Patch,
  Query,
  Param,
  ParseIntPipe,
  Request,
  UseGuards,
  Body,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../entities/user.entity";
import { AdminGateGuard } from "./admin-gate.guard";
import { AdminHistoryService } from "./admin-history.service";
import { AdminCouponsService } from "./admin-coupons.service";
import { UpdateAdminCouponDto } from "./dto/update-admin-coupon.dto";

@ApiTags("Admin - Coupons")
@Controller("admin/coupons")
@UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminCouponsController {
  constructor(
    private readonly adminCouponsService: AdminCouponsService,
    private readonly historyService: AdminHistoryService,
  ) {}

  @Get('users')
  @ApiOperation({ summary: 'Get coupon and referral analytics for users' })
  async getUsersCouponAnalytics(
    @Request() req,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string,
  ) {
    const parsedLimit = Math.max(1, Number(limit) || 50);
    const parsedOffset = Math.max(0, Number(offset) || 0);
    const result = await this.adminCouponsService.getUsersCouponAnalytics(
      parsedLimit,
      parsedOffset,
      search,
    );
    return result;
  }

  @Get('users/:userId')
  @ApiOperation({
    summary: 'Get coupon and referral analytics for a single user',
  })
  async getUserCouponAnalytics(
    @Request() req,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    const result = await this.adminCouponsService.getUserCouponAnalytics(userId);
    return result;
  }

  @Patch(":couponId")
  @ApiOperation({ summary: "Update another user coupon" })
  async updateCoupon(
    @Request() req,
    @Param("couponId", ParseIntPipe) couponId: number,
    @Body() body: UpdateAdminCouponDto,
  ) {
    const result = await this.adminCouponsService.updateCoupon(couponId, body);

    await this.historyService.record(
      this.getAdminActor(req),
      "UPDATE_USER_COUPON",
      "AffiliateCoupon",
      couponId.toString(),
      {
        description: "Updated a user's personal affiliate coupon",
        targetUser: result.data.targetUser,
        changes: result.data.changes,
        before: {
          code: result.data.before.code,
          discountPercent: result.data.before.discountPercent,
        },
        after: {
          code: result.data.after.code,
          discountPercent: result.data.after.discountPercent,
        },
      },
      "Coupons",
    );

    return result;
  }

  private getAdminActor(req: any) {
    return (
      req.user.email || req.user.userId?.toString() || req.user.id?.toString()
    );
  }
}
