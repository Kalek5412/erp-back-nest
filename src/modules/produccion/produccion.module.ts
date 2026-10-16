import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProduccionController } from '../../controller/produccion/produccion.controller';
import { ProduccionService } from '../../services/produccion.service';
import { PlanProduccion } from '../../entity/produccion/plan-produccion.entity';
import { ProduccionConsultaService } from '../../services/produccion-consulta.service';
import { ProduccionConsultaController } from '../../controller/produccion/produccion-consulta.controller';

@Module({
    imports: [TypeOrmModule.forFeature([PlanProduccion])],
    controllers: [ProduccionController, ProduccionConsultaController],
    providers: [ProduccionService, ProduccionConsultaService],
    exports: [ProduccionService, ProduccionConsultaService]
})
export class ProduccionModule {}
