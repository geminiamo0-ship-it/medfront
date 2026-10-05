import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export enum WalletType {
  VODAFONE_CASH = "VODAFONE_CASH",
  ORANGE_CASH = "ORANGE_CASH",
  ETISALAT_CASH = "ETISALAT_CASH",
  WE_CASH = "WE_CASH",
  PAYPAL = "PAYPAL",
  BINANCE = "BINANCE",
  INSTAPAY = "INSTAPAY",
  BANK = "BANK",
  OTHER = "OTHER",
}

@Entity("wallets")
export class Wallet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 120 })
  name: string;

  @Column({ type: "varchar", length: 30, default: WalletType.OTHER })
  type: WalletType;

  @Column({ type: "varchar", length: 255, nullable: true, name: "account_number" })
  accountNumber: string | null;

  @Column({ type: "varchar", length: 10, default: "EGP", name: "base_currency" })
  baseCurrency: string;

  @Column({ type: "boolean", default: true, name: "is_active" })
  isActive: boolean;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updatedAt: Date;
}
