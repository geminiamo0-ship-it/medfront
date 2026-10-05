import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class UpdateAdminCouponDto {
  @ApiPropertyOptional({
    description: "Personal affiliate code",
    example: "MP-FK6WRE",
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    description: "Discount percentage applied by this affiliate coupon",
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({
    description: "Commission percentage earned by the referrer",
    example: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  commissionPercent?: number;
}
