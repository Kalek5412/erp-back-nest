import { Module } from '@nestjs/common';
import { PedidosController } from '../../controller/pedidos/pedidos.controller';
import { PedidosService } from '../../services/pedidos/pedidos.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [PedidosController],
  providers: [PedidosService],
})
export class PedidosModule {}
