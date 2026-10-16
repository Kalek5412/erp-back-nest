import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';

@Injectable()
export class InventariosService {
  constructor(private dbSvc: DatabaseService) {}

  async getInventario(usuEmpresa: string): Promise<any> {
    console.log('usuEmpresa received:', usuEmpresa);
    const dbName = this.dbSvc.getDatabaseName(usuEmpresa);
    console.log('Database name:', dbName);
    const query = `
      SELECT 
          a.ACODIGO AS Código,
          a.ADESCRI AS Descripción,
          c.STSKDIS AS Stock,
          a.AUNIDAD AS U_Medida,
          c.STSKMIN AS Cantidad_Mínima,
          c.STSKDIS - c.STSKMIN AS Cantidad_Reponer,
          c.STPUNREP AS Punto_Reposicion,
          c.STSEMREP AS Tiempo_Reposicion_Semanas
      FROM 
          [${dbName}].[dbo].[MAEART] a
          INNER JOIN [${dbName}].[dbo].[STKART] c ON a.ACODIGO = c.STCODIGO
      WHERE  
          a.ATIPO IN ('03', '04') AND 
          c.STALMA = '05' AND 
          a.AESTADO = 'V' AND 
          c.STSKDIS < c.STSKMIN
      ORDER BY 
          a.ACODIGO;`;
    const result = await this.dbSvc.getConnection(usuEmpresa).query(query);
    console.log('Query result:', result);
    return result;
  }
} 