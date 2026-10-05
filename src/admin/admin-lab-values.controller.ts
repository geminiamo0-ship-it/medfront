import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AdminGateGuard } from "./admin-gate.guard";
import { UserRole } from "../entities/user.entity";
import { LabValuesService } from "../lab-values/lab-values.service";
import { AdminHistoryService } from "./admin-history.service";

class LabValuePayloadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  referenceRange?: string;

  @IsOptional()
  @IsString()
  siReferenceInterval?: string;
}

@ApiTags("Admin - Lab Values")
@Controller("admin/lab-values")
@UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminLabValuesController {
  constructor(
    private readonly labValuesService: LabValuesService,
    private readonly historyService: AdminHistoryService,
  ) {}

  private checkAdminRole(user: any) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException("Admin access required");
    }
  }

  @Get()
  @ApiOperation({ summary: "List lab values (Admin)" })
  @ApiResponse({ status: 200, description: "Lab values retrieved" })
  async listLabValues(
    @Request() req,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("search") search?: string,
    @Query("category") category?: string,
  ) {
    this.checkAdminRole(req.user);
    const parsedLimit = Math.max(1, Number(limit) || 20);
    const parsedOffset = Math.max(0, Number(offset) || 0);
    return this.labValuesService.findPaged({
      limit: parsedLimit,
      offset: parsedOffset,
      search: search?.trim() || undefined,
      category: category?.trim() || undefined,
    });
  }

  @Post()
  @ApiOperation({ summary: "Create lab value (Admin)" })
  @ApiResponse({ status: 201, description: "Lab value created" })
  async createLabValue(@Request() req, @Body() body: LabValuePayloadDto) {
    this.checkAdminRole(req.user);
    const data = await this.labValuesService.createLabValue(body);
    await this.historyService.record(
      req.user.email || req.user.id?.toString() || "admin",
      "CREATE_LAB_VALUE",
      "LabValue",
      data.id,
      body,
      "Lab Values",
    );
    return { success: true, data };
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update lab value (Admin)" })
  @ApiResponse({ status: 200, description: "Lab value updated" })
  async updateLabValue(
    @Request() req,
    @Param("id") id: string,
    @Body() body: LabValuePayloadDto,
  ) {
    this.checkAdminRole(req.user);
    const data = await this.labValuesService.updateLabValue(id, body);
    await this.historyService.record(
      req.user.email || req.user.id?.toString() || "admin",
      "UPDATE_LAB_VALUE",
      "LabValue",
      id,
      body,
      "Lab Values",
    );
    return { success: true, data };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete lab value (Admin)" })
  @ApiResponse({ status: 200, description: "Lab value deleted" })
  async deleteLabValue(@Request() req, @Param("id") id: string) {
    this.checkAdminRole(req.user);
    const result = await this.labValuesService.deleteLabValue(id);
    await this.historyService.record(
      req.user.email || req.user.id?.toString() || "admin",
      "DELETE_LAB_VALUE",
      "LabValue",
      id,
      undefined,
      "Lab Values",
    );
    return result;
  }

  @Post("bulk")
  @ApiOperation({ summary: "Bulk import lab values (Admin)" })
  @ApiResponse({ status: 201, description: "Lab values imported" })
  async bulkCreate(
    @Request() req,
    @Body() body: { items?: LabValuePayloadDto[] } | LabValuePayloadDto[],
  ) {
    this.checkAdminRole(req.user);
    const items = Array.isArray(body) ? body : body?.items || [];
    const result = await this.labValuesService.createBulkLabValues(items);
    await this.historyService.record(
      req.user.email || req.user.id?.toString() || "admin",
      "BULK_IMPORT_LAB_VALUES",
      "LabValue",
      "bulk",
      {
        count: items.length,
        created: result.created,
        skippedExisting: result.skippedExisting,
        skippedDuplicate: result.skippedDuplicate,
      },
      "Lab Values",
    );
    return { success: true, data: result };
  }
}
