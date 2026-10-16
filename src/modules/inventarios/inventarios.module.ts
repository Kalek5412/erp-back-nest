import { Module } from '@nestjs/common';
import { InventariosController } from 'src/controller/inventarios/inventarios.controller';
import { InventariosService } from 'src/services/inventarios/inventarios.service';
import { DatabaseService } from 'src/services/database.service';
import { AuthModule } from 'src/modules/auth/auth.module';
 
@Module({
  imports: [AuthModule],
  controllers: [InventariosController],
  providers: [InventariosService, DatabaseService],
})
export class InventariosModule {}