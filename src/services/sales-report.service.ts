import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { SalesReportItem } from '../interfaces/sales-report.interface';
import { DatabaseService } from './database.service';

@Injectable()
export class SalesReportService {
    private readonly logger = new Logger(SalesReportService.name);

    constructor(
        @InjectConnection('comunDb')
        private connection: Connection,
        private databaseService: DatabaseService
    ) {}

    private formatDate(dateStr: string): string {
        // Convert YYYYMMDD to YYYY-MM-DD
        if (dateStr.length === 8) {
            return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
        }
        return dateStr;
    }

    async getSalesByDateRange(startDate: string, endDate: string, usuEmpresa: string): Promise<SalesReportItem[]> {
        try {
            const dbName = this.databaseService.getDatabaseName(usuEmpresa);
            // Convert YYYYMMDD to SQL Server date format
            const formattedStartDate = `${startDate.substring(0, 4)}${startDate.substring(4, 6)}${startDate.substring(6, 8)}`;
            const formattedEndDate = `${endDate.substring(0, 4)}${endDate.substring(4, 6)}${endDate.substring(6, 8)}`;
            
            const result = await this.connection.query(`
                DECLARE @StartDate VARCHAR(8) = @0
                DECLARE @EndDate VARCHAR(8) = @1

                SELECT 
                    afamilia AS F_Código, 
                    FAM_NOMBRE AS F_Descripción, 
                    AMODELO AS L_Código, 
                    lin_nombre AS L_Descripción, 
                    agrupo AS G_Código, 
                    gru_nombre AS G_Descripción,  
                    SUM(dfcantid) AS Cantidad, 
                    SUM(dfimpus / 1.18) AS USD, 
                    SUM(DFIMPMN / 1.18) AS PEN, 
                    SUM(STKPREPRO * dfcantid) AS Costo_PEN, 
                    SUM(DFIMPMN / 1.18) - SUM(STKPREPRO * dfcantid) AS Margen_PEN,  
                    CASE 
                        WHEN NULLIF(SUM(DFIMPMN / 1.18), 0) IS NULL THEN 0 
                        ELSE (SUM(DFIMPMN / 1.18) - SUM(STKPREPRO * dfcantid)) / NULLIF(SUM(DFIMPMN / 1.18), 0) * 100 
                    END AS Margen_Por
                FROM [${dbName}].[dbo].[FACCAB] a 
                INNER JOIN [${dbName}].[dbo].[FACDET] b 
                    ON a.cftd = b.dftd 
                    AND a.cfnumser = b.dfnumser 
                    AND a.cfnumdoc = b.dfnumdoc 
                INNER JOIN [${dbName}].[dbo].[MAEART] 
                    ON dfcodigo = ACODIGO 
                INNER JOIN [${dbName}].[dbo].[FAMILIA] 
                    ON AFAMILIA = FAM_CODIGO 
                LEFT OUTER JOIN [${dbName}].[dbo].[LINEAS] l 
                    ON AFAMILIA = l.FAM_CODIGO 
                    AND AMODELO = LIN_CODIGO 
                LEFT OUTER JOIN [${dbName}].[dbo].[GRUPO] g 
                    ON AFAMILIA = g.FAM_CODIGO 
                    AND AMODELO = g.LIN_CODIGO 
                    AND AGRUPO = GRU_CODIGO   
                LEFT OUTER JOIN [${dbName}].[dbo].[stkart] 
                    ON dfcodigo = stcodigo 
                    AND dfalma = STALMA 
                WHERE 
                    a.cffecdoc BETWEEN @StartDate AND @EndDate
                    AND dfestado = 'V' 
                    AND afamilia <> '05' 
                    AND AGRUPO <> ' ' 
                GROUP BY
                    AFAMILIA, 
                    FAM_NOMBRE, 
                    AMODELO, 
                    LIN_NOMBRE, 
                    AGRUPO, 
                    GRU_NOMBRE  
                HAVING 
                    SUM(DFCANTID) <> 0 
                ORDER BY 
                    AFAMILIA, 
                    AMODELO, 
                    AGRUPO`,
                [formattedStartDate, formattedEndDate]
            );

            return result.map(row => ({
                fCodigo: row.F_Código,
                fDescripcion: row.F_Descripción,
                lCodigo: row.L_Código,
                lDescripcion: row.L_Descripción,
                gCodigo: row.G_Código,
                gDescripcion: row.G_Descripción,
                cantidad: Number(row.Cantidad),
                usd: Number(row.USD),
                pen: Number(row.PEN),
                costoPen: Number(row.Costo_PEN),
                margenPen: Number(row.Margen_PEN),
                margenPor: Number(row.Margen_Por)
            }));
        } catch (error) {
            this.logger.error(`Error getting sales report: ${error.message}`);
            throw error;
        }
    }
}
