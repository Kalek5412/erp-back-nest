import { Controller, Get, Query, UsePipes, ValidationPipe, Logger } from '@nestjs/common';
import { ProduccionConsultaService } from '../../services/produccion-consulta.service';
import { FechaDisponibleDto } from '../../dto/produccion/fecha-disponible.dto';
import { ProduccionDetalleDto } from '../../dto/produccion/produccion-detalle.dto';
import { ConsultaDetallesDto } from '../../dto/produccion/consulta-detalles.dto';
import { ProduccionResumenDto } from '../../dto/produccion/produccion-resumen.dto';

@Controller('produccion-consulta')
export class ProduccionConsultaController {
  private readonly logger = new Logger(ProduccionConsultaController.name);

  constructor(private readonly produccionConsultaService: ProduccionConsultaService) {}

  @Get('fechas-disponibles')
  async getFechasDisponibles(): Promise<FechaDisponibleDto[]> {
    this.logger.log('Received request for /fechas-disponibles');
    return this.produccionConsultaService.getFechasDisponibles();
  }

  @Get('detalles-por-fecha')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getDetallesPorFecha(@Query() consultaDto: ConsultaDetallesDto): Promise<ProduccionDetalleDto[]> {
    this.logger.log(`Received request for /detalles-por-fecha with query: ${JSON.stringify(consultaDto)}`);
    return this.produccionConsultaService.getDetallesPorFecha(consultaDto);
  }

  @Get('resume-prod')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getResumenProduccion(@Query() consultaDto: ConsultaDetallesDto): Promise<ProduccionResumenDto[]> {
    this.logger.log(`Received request for /resume-prod with query: ${JSON.stringify(consultaDto)}`);
    return this.produccionConsultaService.getResumenProduccion(consultaDto);
  }
}
