import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LabValue } from "../entities/lab-value.entity";
import { LabValuesService } from "./lab-values.service";
import { LabValuesController } from "./lab-values.controller";

@Module({
  imports: [TypeOrmModule.forFeature([LabValue])],
  controllers: [LabValuesController],
  providers: [LabValuesService],
  exports: [LabValuesService],
})
export class LabValuesModule {}
