import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CarteraClientesController } from '../../controller/cartera-clientes/cartera-clientes.controller';
import { CarteraClientesService } from '../../services/cartera-clientes/cartera-clientes.service';
import { DatabaseService } from '../../services/database.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([], 'comunDb'),
  ],
  controllers: [CarteraClientesController],
  providers: [CarteraClientesService, DatabaseService],
})
export class CarteraClientesModule {} 