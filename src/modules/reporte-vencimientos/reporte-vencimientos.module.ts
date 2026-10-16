import { Module } from '@nestjs/common';
import { ReporteVencimientosController } from '../../controller/reporte-vencimientos/reporte-vencimientos.controller';
import { ReporteVencimientosService } from '../../services/reporte-vencimientos/reporte-vencimientos.service';
import { DatabaseService } from 'src/services/database.service';
 
@Module({
    controllers: [ReporteVencimientosController],
    providers: [ReporteVencimientosService, DatabaseService],
})
export class ReporteVencimientosModule {} 