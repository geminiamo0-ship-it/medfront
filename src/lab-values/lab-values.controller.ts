import { Controller, Get } from "@nestjs/common";
import { LabValuesService } from "./lab-values.service";

@Controller("lab-values")
export class LabValuesController {
  constructor(private readonly labValuesService: LabValuesService) {}

  @Get()
  async getLabValues() {
    return this.labValuesService.findAllGroupedByCategory();
  }
}
