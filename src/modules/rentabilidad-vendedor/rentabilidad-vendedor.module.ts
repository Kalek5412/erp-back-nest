import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RentabilidadVendedorService } from './rentabilidad-vendedor.service';
import { RentabilidadVendedorController } from './rentabilidad-vendedor.controller';

@Module({
    imports: [TypeOrmModule.forFeature([], 'comunDb')],
  controllers: [RentabilidadVendedorController],
  providers: [RentabilidadVendedorService],
})
export class RentabilidadVendedorModule {}
