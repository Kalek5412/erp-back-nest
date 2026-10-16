import { Controller, Get, Param } from '@nestjs/common';
import { VentasService } from '../../services/ventas/ventas.service';

@Controller('ventas')
export class VentasController {
  constructor(private readonly ventasService: VentasService) {}

  @Get(':usuEmpresa')
  async getVentas(@Param('usuEmpresa') usuEmpresa: string) {
    return this.ventasService.getVentasData(usuEmpresa);
  }
}
