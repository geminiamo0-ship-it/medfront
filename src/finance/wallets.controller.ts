import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AdminGateGuard } from "../admin/admin-gate.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../entities/user.entity";
import { WalletsService } from "./wallets.service";
import { WalletType } from "../entities/wallet.entity";
import { AdminHistoryService } from "../admin/admin-history.service";

@ApiTags("Admin - Wallets")
@Controller("admin/wallets")
@UseGuards(JwtAuthGuard, RolesGuard, AdminGateGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class WalletsController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly historyService: AdminHistoryService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List all wallets with computed balances" })
  async listWallets(@Query("from") from?: string, @Query("to") to?: string) {
    return this.walletsService.listWallets(from, to);
  }

  @Get("summary")
  @ApiOperation({ summary: "Total balance per currency + grand total converted" })
  async getSummary(@Query("from") from?: string, @Query("to") to?: string) {
    return this.walletsService.getSummary(from, to);
  }

  @Get("reconciliation")
  @ApiOperation({ summary: "Reconciliation status per currency" })
  async getReconciliation(@Query("from") from?: string, @Query("to") to?: string) {
    return this.walletsService.getReconciliation(from, to);
  }

  @Get(":id/ledger")
  @ApiOperation({ summary: "Get ledger entries for a wallet" })
  async getLedger(
    @Param("id", ParseIntPipe) id: number,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.walletsService.getWalletLedger(id, Number(limit) || 20, Number(offset) || 0);
  }

  @Post()
  @ApiOperation({ summary: "Create a wallet" })
  async createWallet(
    @Request() req,
    @Body() body: { name: string; type: WalletType; accountNumber?: string; baseCurrency: string },
  ) {
    const wallet = await this.walletsService.createWallet(body);
    await this.historyService.record(
      req.user.email || req.user.id?.toString(),
      "CREATE_WALLET",
      "Wallet",
      wallet.id.toString(),
      body,
      "Wallets",
    );
    return { success: true, data: wallet };
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a wallet" })
  async updateWallet(
    @Request() req,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: Partial<{ name: string; type: WalletType; accountNumber: string; baseCurrency: string; isActive: boolean }>,
  ) {
    const wallet = await this.walletsService.updateWallet(id, body);
    await this.historyService.record(
      req.user.email || req.user.id?.toString(),
      "UPDATE_WALLET",
      "Wallet",
      id.toString(),
      body,
      "Wallets",
    );
    return { success: true, data: wallet };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Deactivate a wallet" })
  async deleteWallet(@Request() req, @Param("id", ParseIntPipe) id: number) {
    await this.walletsService.deleteWallet(id);
    await this.historyService.record(
      req.user.email || req.user.id?.toString(),
      "DEACTIVATE_WALLET",
      "Wallet",
      id.toString(),
      null,
      "Wallets",
    );
    return { success: true };
  }

  @Post(":id/adjust")
  @ApiOperation({ summary: "Manually adjust wallet balance (opening balance or correction)" })
  async adjustBalance(
    @Request() req,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { amount: number; currency: string; note?: string },
  ) {
    const adminEmail = req.user.email || req.user.id?.toString();
    const entry = await this.walletsService.adjustBalance(id, Number(body.amount), body.currency, body.note || "", adminEmail);
    await this.historyService.record(adminEmail, "MANUAL_WALLET_ADJUSTMENT", "Wallet", id.toString(), body, "Wallets");
    return { success: true, data: entry };
  }

  @Post(":id/transfer")
  @ApiOperation({ summary: "Transfer balance from this wallet to another, then optionally deactivate source" })
  async transferBalance(
    @Request() req,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { destWalletId: number; amount: number; deactivateAfter?: boolean },
  ) {
    const adminEmail = req.user.email || req.user.id?.toString();
    const result = await this.walletsService.transferBalance(id, Number(body.destWalletId), Number(body.amount), adminEmail);
    if (body.deactivateAfter) {
      await this.walletsService.deleteWallet(id);
    }
    await this.historyService.record(adminEmail, "WALLET_TRANSFER", "Wallet", id.toString(), body, "Wallets");
    return { success: true, ...result, deactivated: !!body.deactivateAfter };
  }
}
