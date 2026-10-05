import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../entities/user.entity';

@Injectable()
export class AdminGateService {
  private readonly gateDurationSeconds = 15 * 60;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async verifyPassword(password: string, adminId: number) {
    const admin = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id: adminId })
      .getOne();

    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    if (
      admin.role !== UserRole.ADMIN &&
      admin.role !== UserRole.SUPER_ADMIN
    ) {
      throw new UnauthorizedException('Access denied');
    }

    if (admin.isActive === false) {
      throw new UnauthorizedException('Access denied');
    }

    const isPasswordValid = await bcrypt.compare(password || '', admin.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Access denied');
    }

    const secret = this.configService.get<string>('ADMIN_GATE_SECRET');
    if (!secret) {
      throw new Error('ADMIN_GATE_SECRET must be configured');
    }

    const expiresAt = new Date(Date.now() + this.gateDurationSeconds * 1000);

    const token = this.jwtService.sign(
      { type: 'admin_gate', sub: adminId },
      { secret, expiresIn: this.gateDurationSeconds },
    );

    return { token, expiresAt };
  }
}
