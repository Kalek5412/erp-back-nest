import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SunatService } from './services/sunat.service';
import { DetalleMovService } from './services/detalle-mov.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SunatData } from './entity/sunat/sunat-data.entity';
import { DetalleMov } from './entity/sunat/detalle-mov.entity';
import { DatabaseModule } from './modules/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { CarteraClientesModule } from './modules/cartera-clientes/cartera-clientes.module';
import { InventariosModule } from './modules/inventarios/inventarios.module';
import { PriceListModule } from './modules/price-list/price-list.module';
import { ProduccionModule } from './modules/produccion/produccion.module';
import { ReporteVencimientosModule } from './modules/reporte-vencimientos/reporte-vencimientos.module';
import { VentasModule } from './modules/ventas/ventas.module';
import { SalesReportModule } from './modules/sales-report/sales-report.module';
import { RentabilidadVendedorModule } from './modules/rentabilidad-vendedor/rentabilidad-vendedor.module';
import { PedidosModule } from './modules/pedidos/pedidos.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    CarteraClientesModule,
    InventariosModule,
    PriceListModule,
    ProduccionModule,
    ReporteVencimientosModule,
    RentabilidadVendedorModule,
    SalesReportModule,
    VentasModule,
    PedidosModule,
    AuthModule, // Movido al final para asegurar que los guardias se apliquen correctamente
    TypeOrmModule.forFeature([SunatData, DetalleMov]),
  ],
  controllers: [AppController],
  providers: [AppService, SunatService, DetalleMovService],
})
export class AppModule {}