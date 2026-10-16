import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriceListController } from '../../controller/price-list/price-list.controller';
import { PriceListService } from '../../services/price-list/price-list.service';
import { MAEART } from '../../entity/comun/maeart.entity';
import { ListaPrecios } from '../../entity/comun/lista-precios.entity';
import { DatabaseService } from '../../services/database.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MAEART, ListaPrecios], 'comunDb'), // Specify comunDb connection
  ],
  controllers: [PriceListController],
  providers: [PriceListService, DatabaseService],
})
export class PriceListModule {} 