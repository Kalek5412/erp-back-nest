import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RentabilidadVendedorService } from './rentabilidad-vendedor.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { GetRentabilidadDto } from './dto/get-rentabilidad.dto';

@Controller('rentabilidad-vendedor')
@UseGuards(JwtAuthGuard)
export class RentabilidadVendedorController {
  constructor(private readonly rentabilidadVendedorService: RentabilidadVendedorService) {}

  @Get()
  async getRentabilidadData(@Query() getRentabilidadDto: GetRentabilidadDto) {
    const { fechaInicio, fechaFin } = getRentabilidadDto;
    return this.rentabilidadVendedorService.getRentabilidadData(fechaInicio, fechaFin);
  }
}
