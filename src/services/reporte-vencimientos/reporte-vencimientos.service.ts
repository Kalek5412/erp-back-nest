import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { DatabaseService } from '../database.service';

@Injectable()
export class ReporteVencimientosService {
    private readonly logger = new Logger(ReporteVencimientosService.name);

    constructor(
        @InjectConnection('comunDb')
        private connection: Connection,
        private databaseService: DatabaseService,
    ) {}

    async getReporteVencimientos(usuEmpresa: string, fechaDesde: string): Promise<any[]> {
        this.logger.debug(`Fetching reporte de vencimientos for empresa ${usuEmpresa} from date ${fechaDesde}`);
        const dbName = this.databaseService.getDatabaseName(usuEmpresa);
        
        const query = `
            SELECT 
                CDOCODCLI, 
                L.CNOMCLI, 
                CDOTIPDOC, 
                CDONRODOC, 
                CDOFECDOC, 
                CDOFECVEN,
                CDOCODVEN, 
                CDOIMPORTE, 
                CDOSALDO, 
                CDOTIPMON 
            FROM [${dbName}].[dbo].[CARTERA]
            INNER JOIN [${dbName}].[dbo].[MAECLI] AS L ON CDOCODCLI = L.CCODCLI
            WHERE CDOFECVEN >= @0 AND CDOSALDO <> 0
            ORDER BY CDOFECVEN ASC
        `;
        
        const params = [fechaDesde];

        try {
            return await this.connection.query(query, params);
        } catch (error) {
            this.logger.error(`Error in getReporteVencimientos: ${error.message}`);
            throw error;
        }
    }
} 