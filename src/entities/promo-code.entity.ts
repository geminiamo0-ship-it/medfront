import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";

@Entity("promo_codes")
export class PromoCode {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "owner_user_id" })
  ownerUser: User | null;

  @Column({ type: "int", nullable: true, name: "owner_user_id" })
  ownerUserId: number | null;

  @Column({ unique: true })
  code: string;

  @Column({ type: "int" })
  discountPercent: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: "timestamp", nullable: true })
  expiresAt: Date | null;

  @Column({ type: "int", nullable: true })
  maxUses: number | null;

  @Column({ default: 0 })
  usedCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  isValid(): boolean {
    if (!this.isActive) return false;

    if (this.expiresAt && new Date() > this.expiresAt) {
      return false;
    }

    if (this.maxUses !== null && this.usedCount >= this.maxUses) {
      return false;
    }

    return true;
  }
}
