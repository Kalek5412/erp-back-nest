import { Controller, Get, Query, UseGuards, HttpException, HttpStatus, Req } from '@nestjs/common';
import { RentabilidadVendedorService } from './rentabilidad-vendedor.service';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { GetRentabilidadDto } from './dto/get-rentabilidad.dto';

@Controller('rentabilidad-vendedor')
@UseGuards(JwtAuthGuard)
export class RentabilidadVendedorController {
  constructor(private readonly rentabilidadVendedorService: RentabilidadVendedorService) {}

  @Get()
  async getRentabilidadData(@Query() getRentabilidadDto: GetRentabilidadDto, @Req() req: any) {
    try {
      const { fechaInicio, fechaFin } = getRentabilidadDto;
      // Tomar empresa del token (empresa o usuEmpresa), luego fallback a query/header
      let empresa = (req?.user?.empresa || req?.user?.usuEmpresa || '').toString().padStart(3, '0');
      if (!empresa || empresa === '000') {
        empresa = (req?.query?.empresa || req?.headers?.['x-empresa'] || '').toString().padStart(3, '0');
      }
      console.log('[RentabilidadController] Empresa detectada (token/query/header):', empresa || '(vacía)');
      if (!empresa) return [];
      const data = await this.rentabilidadVendedorService.getRentabilidadData(fechaInicio, fechaFin, empresa);
      return data;
    } catch (error) {
      console.error('Error en el controlador de rentabilidad:', error);
      throw new HttpException(error.message || 'Error interno del servidor', error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
