import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';

@Injectable()
export class VentasService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getVentasData(usuEmpresa: string): Promise<any> {
    const connection = this.databaseService.getConnection(usuEmpresa);
    const dbName = this.databaseService.getDatabaseName(usuEmpresa);

    const query = `
      SELECT 
        A.DFTD, 
        A.DFNUMSER, 
        A.DFNUMDOC, 
        A.DFSECUEN, 
        A.DFCODIGO, 
        A.DFDESCRI, 
        SUM(A.DFCANTID) AS CANTIDAD, 
        SUM(A.DFIMPMN) AS TOTAL, 
        A.DFUNIDAD, 
        B.CFVENDE
      FROM [${dbName}].[dbo].[FACDET] AS A 
      INNER JOIN [${dbName}].[dbo].[FACCAB] AS B 
        ON A.DFTD = B.CFTD 
        AND A.DFNUMSER = B.CFNUMSER 
        AND A.DFNUMDOC = B.CFNUMDOC
      WHERE 
        A.DFESTADO = 'V' 
        AND A.DFALMA = '01' 
        AND B.CFFECDOC BETWEEN '20250701' AND '20250731'
      GROUP BY 
        B.CFVENDE, 
        A.DFTD, 
        A.DFNUMSER, 
        A.DFNUMDOC, 
        A.DFSECUEN, 
        A.DFCODIGO, 
        A.DFDESCRI, 
        A.DFUNIDAD
    `;

    return connection.query(query);
  }
}
