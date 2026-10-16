import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { DatabaseService } from '../database.service';

@Injectable()
export class CarteraClientesService {
    private readonly logger = new Logger(CarteraClientesService.name);

    constructor(
        @InjectConnection('comunDb')
        private connection: Connection,
        private databaseService: DatabaseService,
    ) {}

    async getCarteraPorDocumento(
        usuEmpresa: string, 
        cliente?: string, 
        vendedor?: string, 
        fechaDesde?: string, 
        fechaHasta?: string
    ): Promise<any[]> {
        this.logger.debug(`Fetching cartera por documento for empresa ${usuEmpresa}`);
        const dbName = this.databaseService.getDatabaseName(usuEmpresa);
        
        let query = `
            SELECT
                RTRIM(C.CDOTIPDOC) AS TIPO_DOC,
                RTRIM(C.CDONRODOC) AS NUM_DOC,
                MC.CNOMCLI AS NOMBRE_CLIENTE,
                CONVERT(VARCHAR, C.CDOFECDOC, 103) AS FECHA_EMISION,
                C.CDOIMPORTE AS IMPORTE_TOTAL,
                C.CDOSALDO AS SALDO,
                V.DES_VEN AS VENDEDOR,
                C.CDOCODVEN AS COD_VENDEDOR
            FROM
                [${dbName}].[dbo].[cartera] C
            INNER JOIN
                [${dbName}].[dbo].[VENDEDOR] V ON C.CDOCODVEN = V.COD_VEN
            INNER JOIN
                [${dbName}].[dbo].[MAECLI] MC ON C.CDOCODCLI = MC.CCODCLI
            WHERE C.CDOSALDO <> 0
        `;
        
        const params: any[] = [];
        if (cliente) {
            query += ` AND (MC.CNOMCLI LIKE @${params.length} OR C.CDOCODCLI LIKE @${params.length})`;
            params.push(`%${cliente}%`);
        }
        if (vendedor) {
            query += ` AND C.CDOCODVEN = @${params.length}`;
            params.push(vendedor);
        }
        if (fechaDesde) {
            query += ` AND C.CDOFECDOC >= @${params.length}`;
            params.push(fechaDesde);
        }
        if (fechaHasta) {
            query += ` AND C.CDOFECDOC <= @${params.length}`;
            params.push(fechaHasta);
        }

        query += ` ORDER BY C.CDOFECDOC DESC;`;

        try {
            const result = await this.connection.query(query, params);
            return result.map(item => ({
                documento: `${item.TIPO_DOC} ${item.NUM_DOC}`,
                tipoDoc: item.TIPO_DOC,
                nroDoc: item.NUM_DOC,
                cliente: item.NOMBRE_CLIENTE,
                fechaEmision: item.FECHA_EMISION,
                monto: parseFloat(item.IMPORTE_TOTAL).toFixed(2),
                saldo: parseFloat(item.SALDO).toFixed(2),
                vendedor: item.VENDEDOR,
                cdoCodVen: item.COD_VENDEDOR,
            }));
        } catch (error) {
            this.logger.error(`Error in getCarteraPorDocumento: ${error.message}`);
            throw error;
        }
    }

    async updateVendedor(usuEmpresa: string, tipoDoc: string, nroDoc: string, codVen: string): Promise<any> {
        this.logger.debug(`Updating vendedor for doc ${tipoDoc}-${nroDoc} in empresa ${usuEmpresa} to vendor ${codVen}`);
        const dbName = this.databaseService.getDatabaseName(usuEmpresa);
        const query = `
            UPDATE [${dbName}].[dbo].[CARTERA]
            SET [CDOCODVEN] = @0
            WHERE RTRIM(CDOTIPDOC) = @1 AND RTRIM(CDONRODOC) = @2
        `;
        const params = [codVen, tipoDoc, nroDoc];
        this.logger.log(`Executing query: ${query} with params: ${JSON.stringify(params)}`);

        try {
            await this.connection.query(query, params);
            this.logger.log(`Update query for vendor by document finished successfully.`);
            return { success: true, message: 'Vendedor actualizado correctamente por documento.' };
        } catch (error) {
            this.logger.error(`Error in updateVendedor: ${error.message}`);
            throw error;
        }
    }

    async getVendedores(usuEmpresa: string): Promise<any[]> {
        this.logger.debug(`Fetching vendedores for empresa ${usuEmpresa}`);
        const dbName = this.databaseService.getDatabaseName(usuEmpresa);
        const query = `SELECT COD_VEN, DES_VEN FROM [${dbName}].[dbo].[VENDEDOR] ORDER BY DES_VEN`;
        try {
            return await this.connection.query(query);
        } catch (error) {
            this.logger.error(`Error in getVendedores: ${error.message}`);
            throw error;
        }
    }

    async getCarteraPorCliente(usuEmpresa: string, cliente?: string, vendedor?: string): Promise<any[]> {
        this.logger.debug(`Fetching cartera por cliente for empresa ${usuEmpresa}`);
        const dbName = this.databaseService.getDatabaseName(usuEmpresa);
        let query = `
            SELECT
                MC.CCODCLI AS COD_CLIENTE,
                MC.CNOMCLI AS NOMBRE_CLIENTE,
                MAX(V.DES_VEN) AS VENDEDOR,
                MAX(C.CDOCODVEN) AS COD_VENDEDOR,
                SUM(C.CDOSALDO) AS SALDO_TOTAL
            FROM
                [${dbName}].[dbo].[cartera] C
            INNER JOIN
                [${dbName}].[dbo].[MAECLI] MC ON C.CDOCODCLI = MC.CCODCLI
            INNER JOIN
                [${dbName}].[dbo].[VENDEDOR] V ON C.CDOCODVEN = V.COD_VEN
            WHERE
                C.CDOSALDO <> 0
        `;

        const params: any[] = [];
        if (cliente) {
            query += ` AND (MC.CNOMCLI LIKE @${params.length} OR C.CDOCODCLI LIKE @${params.length})`;
            params.push(`%${cliente}%`);
        }
        if (vendedor) {
            query += ` AND C.CDOCODVEN = @${params.length}`;
            params.push(vendedor);
        }

        query += `
            GROUP BY
                MC.CCODCLI,
                MC.CNOMCLI
            ORDER BY
                NOMBRE_CLIENTE;
        `;
        
        try {
            return await this.connection.query(query, params);
        } catch (error) {
            this.logger.error(`Error in getCarteraPorCliente: ${error.message}`);
            throw error;
        }
    }

    async updateVendedorPorCliente(usuEmpresa: string, codCli: string, codVen: string): Promise<any> {
        this.logger.debug(`Updating vendedor for cliente ${codCli} in empresa ${usuEmpresa} to vendor ${codVen}`);
        const dbName = this.databaseService.getDatabaseName(usuEmpresa);
        const query = `
            UPDATE [${dbName}].[dbo].[CARTERA]
            SET [CDOCODVEN] = @0
            WHERE RTRIM(CDOCODCLI) = @1 AND CDOSALDO <> 0
        `;
        const params = [codVen, codCli];
        this.logger.log(`Executing query: ${query} with params: ${JSON.stringify(params)}`);
        try {
            await this.connection.query(query, params);
            this.logger.log(`Update query for vendor by client finished successfully.`);
            return { success: true, message: 'Vendedor actualizado correctamente por cliente.' };
        } catch (error) {
            this.logger.error(`Error in updateVendedorPorCliente: ${error.message}`);
            throw error;
        }
    }
} 