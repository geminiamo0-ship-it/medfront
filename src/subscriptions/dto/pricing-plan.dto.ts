import {
  IsArray,
  ArrayNotEmpty,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SubscriptionPlan } from '../../entities/user.entity';

export class RegionalPriceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  currency: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  realPrice: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountedPrice: number;
}


export class CreatePricingPlanDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsEnum(SubscriptionPlan)
  tier: SubscriptionPlan;

  @IsInt()
  @Min(1)
  durationMonths: number;

  @IsString()
  @IsIn(['yearly', 'lifetime'])
  durationLabel: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  realPrice: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountedPrice: number;

  @IsString()
  @MaxLength(10)
  currency: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  benefits: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RegionalPriceDto)
  regionalPrices?: RegionalPriceDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsInt()
  displayOrder?: number;
}

export class UpdatePricingPlanDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(SubscriptionPlan)
  tier?: SubscriptionPlan;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMonths?: number;

  @IsOptional()
  @IsString()
  @IsIn(['yearly', 'lifetime'])
  durationLabel?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  realPrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountedPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  benefits?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RegionalPriceDto)
  regionalPrices?: RegionalPriceDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsInt()
  displayOrder?: number;
}
