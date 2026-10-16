import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseService } from '../../services/database.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mssql',
      host: 'NS1012130',
      port: 1433,
      username: 'SISINDUSPROD',
      password: 'Indusquimica2025//**',
      database: 'STARPLAN',
      entities: [__dirname + '/../../entity/user/**/*.entity{.ts,.js}', __dirname + '/../../entity/produccion/**/*.entity{.ts,.js}'],
      synchronize: false,
      options: { encrypt: false, trustServerCertificate: false },
      logging: false,
    }),
    TypeOrmModule.forRoot({
      name: 'comunDb',
      type: 'mssql',
      host: 'NS1012130',
      port: 1433,
      username: 'SISINDUSPROD',
      password: 'Indusquimica2025//**',
      database: '004BDCOMUN',
      entities: [__dirname + '/../../entity/comun/**/*.entity{.ts,.js}'],
      synchronize: false,
      options: { encrypt: false, trustServerCertificate: false },
      logging: false,
    }),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
