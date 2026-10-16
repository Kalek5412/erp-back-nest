import { Controller, Get, UseGuards, Req, UnauthorizedException, BadRequestException, Logger, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { ReporteVencimientosService } from '../../services/reporte-vencimientos/reporte-vencimientos.service';
import { Request } from 'express';

@Controller('reporte-vencimientos')
@UseGuards(JwtAuthGuard)
export class ReporteVencimientosController {
    private readonly logger = new Logger(ReporteVencimientosController.name);

    constructor(private readonly reporteVencimientosService: ReporteVencimientosService) {}

    @Get()
    async getReporte(
        @Req() req: Request,
        @Query('fechaDesde') fechaDesde: string,
    ): Promise<any[]> {
        this.logger.debug(`User requesting reporte de vencimientos from date ${fechaDesde}`);
        const usuEmpresa = (req as any).user?.usuEmpresa;
        if (!usuEmpresa) {
            throw new UnauthorizedException('User empresa not found');
        }
        if (!fechaDesde) {
            throw new BadRequestException('El parámetro fechaDesde es requerido.');
        }
        try {
            return await this.reporteVencimientosService.getReporteVencimientos(usuEmpresa, fechaDesde);
        } catch (error) {
            this.logger.error(`Error in getReporte: ${error.message}`);
            throw new BadRequestException(`Failed to get reporte de vencimientos: ${error.message}`);
        }
    }
} 