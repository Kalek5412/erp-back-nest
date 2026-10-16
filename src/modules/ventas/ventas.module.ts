import { Module } from '@nestjs/common';
import { VentasController } from '../../controller/ventas/ventas.controller';
import { VentasService } from '../../services/ventas/ventas.service';
import { DatabaseService } from 'src/services/database.service';

@Module({
    controllers: [VentasController],
    providers: [VentasService, DatabaseService],
})
export class VentasModule {}
