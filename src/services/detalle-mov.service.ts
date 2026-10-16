import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { DetalleMov } from '../entity/sunat/detalle-mov.entity';
import { SunatData } from '../entity/sunat/sunat-data.entity';

@Injectable()
export class DetalleMovService {
    private readonly logger = new Logger(DetalleMovService.name);

    constructor(
        @InjectConnection()
        private connection: Connection
    ) {}

    private generateSecuencia(num: number): string {
        return num.toString().padStart(5, '0');
    }

    private getCuentaContable(secuencia: string, moneda: string, ctaContable: string): string {
        switch (secuencia) {
            case '00001':
                return '4011100';
            case '00002':
                return moneda === 'ME' ? '6021102' : '6021101';
            case '00003':
                return ctaContable || '';
            default:
                return '';
        }
    }

    private getAnexo(secuencia: string, nroDocIdentidad: string): string {
        if (secuencia === '00002') {
            return `03${nroDocIdentidad || ''}`;
        }
        return '';
    }

    private getCentroCosto(secuencia: string, centroCosto: string): string {
        if (secuencia === '00003') {
            return centroCosto || '';
        }
        return '';
    }

    private calculateDebe(secuencia: string, biGravadoDg: number | null, igvIpmDg: number | null): number {
        let result = 0;
        switch (secuencia) {
            case '00003':
                result = biGravadoDg || 0; // Base imponible gravada
                this.logger.debug(`calculateDebe for sequence ${secuencia}: biGravadoDg=${biGravadoDg}, result=${result}`);
                break;
            case '00001':
                result = igvIpmDg || 0; // IGV
                this.logger.debug(`calculateDebe for sequence ${secuencia}: igvIpmDg=${igvIpmDg}, result=${result}`);
                break;
            case '00002':
                result = 0;
                this.logger.debug(`calculateDebe for sequence ${secuencia}: hardcoded to 0`);
                break;
            default:
                this.logger.warn(`calculateDebe called with unknown sequence: ${secuencia}`);
                result = 0;
        }
        return result;
    }

    private calculateDebus(secuencia: string, biGravadoDg: number | null, igvIpmDg: number | null, tipoCambio: number | null): number {
        if (!tipoCambio || tipoCambio === 0) return 0;
        
        switch (secuencia) {
            case '00003':
                // For third sequence, use base imponible gravada in foreign currency
                return biGravadoDg ? Math.round((biGravadoDg / tipoCambio) * 1000) / 1000 : 0;
            case '00001':
                return igvIpmDg ? igvIpmDg / tipoCambio : 0;
            case '00002':
                return 0;
            default:
                return 0;
        }
    }

    private calculateHaber(secuencia: string, totalCp: number | null): number {
        switch (secuencia) {
            case '00001':
            case '00003':
                return 0;
            case '00002':
                return totalCp || 0;
            default:
                return 0;
        }
    }

    private calculateHabus(secuencia: string, totalCpME: number | null): number {
        switch (secuencia) {
            case '00001':
            case '00003':
                return 0;
            case '00002':
                return totalCpME || 0;
            default:
                return 0;
        }
    }

    private async checkAndSaveDetalle(detalle: DetalleMov, monthPer: string, yearPer: string): Promise<void> {
        let tableName = `[002BDCONT${yearPer}].dbo.[DETMOV${monthPer}]`;
        this.logger.debug(`--- checkAndSaveDetalle Invoked ---`);
        this.logger.debug(`Year: ${yearPer}, Month: ${monthPer}`);
        this.logger.debug(`Table Name: ${tableName}`);
        this.logger.debug(`DetalleMov Input: ${JSON.stringify(detalle)}`);

        try {
            const selectQuery = `
                SELECT COUNT(*) as count 
                FROM ${tableName} 
                WHERE DMOV_DOCUM = @0 
                AND DMOV_ANEXO = @1`;
            const selectParams = [detalle.dmovDocum, detalle.dmovAnexo];
            this.logger.debug(`Executing SELECT Query: ${selectQuery}`);
            this.logger.debug(`SELECT Params: ${JSON.stringify(selectParams)}`);
            
            const existingRecord = await this.connection.query(selectQuery, selectParams);
            this.logger.debug(`Existing record count: ${existingRecord[0].count}`);

            const params = [
                detalle.subdiarCodigo,
                detalle.dmovCCompr,
                detalle.dmovSecue,
                detalle.dmovFecha,
                detalle.dmovCuent,
                detalle.dmovAnexo,
                detalle.dmovDocum,
                detalle.dmovFecdc,
                detalle.dmovCenco,
                detalle.dmovDebe,
                detalle.dmovHaber,
                detalle.dmovDebus,
                detalle.dmovHabus,
                detalle.dmovGlosa,
                detalle.dmovLCompr,
                detalle.dmovCDesti,
                detalle.dmovFecven,
                detalle.dinterface
            ];
            this.logger.debug(`Common DB Params for INSERT/UPDATE: ${JSON.stringify(params)}`);

            if (existingRecord[0].count > 0) {
                const updateSql = `
                    DECLARE @SQL NVARCHAR(MAX)
                    SET @SQL = N'
                        UPDATE ${tableName} SET
                            DMOV_C_COMPR = @dmovCCompr,
                            DMOV_FECHA = @dmovFecha,
                            DMOV_CUENT = @dmovCuent,
                            DMOV_FECDC = @dmovFecdc,
                            DMOV_CENCO = @dmovCenco,
                            DMOV_DEBE = @dmovDebe,
                            DMOV_HABER = @dmovHaber,
                            DMOV_DEBUS = @dmovDebus,
                            DMOV_HABUS = @dmovHabus,
                            DMOV_GLOSA = @dmovGlosa,
                            DMOV_L_COMPR = @dmovLCompr,
                            DMOV_C_DESTI = @dmovCDesti,
                            DMOV_FECVEN = @dmovFecven,
                            DINTERFACE = @dinterface
                        WHERE DMOV_DOCUM = @dmovDocum 
                        AND DMOV_ANEXO = @dmovAnexo
                        AND SUBDIAR_CODIGO = @subdiarCodigo 
                        AND DMOV_SECUE = @dmovSecue'

                    EXEC sp_executesql @SQL,
                        N'@subdiarCodigo VARCHAR(2),
                          @dmovCCompr VARCHAR(4),
                          @dmovSecue VARCHAR(5),
                          @dmovFecha SMALLDATETIME,
                          @dmovCuent VARCHAR(18),
                          @dmovAnexo VARCHAR(13),
                          @dmovDocum VARCHAR(23),
                          @dmovFecdc SMALLDATETIME,
                          @dmovCenco VARCHAR(10),
                          @dmovDebe NUMERIC(20,2),
                          @dmovHaber NUMERIC(20,2),
                          @dmovDebus NUMERIC(20,2),
                          @dmovHabus NUMERIC(20,2),
                          @dmovGlosa VARCHAR(60),
                          @dmovLCompr BIT,
                          @dmovCDesti VARCHAR(18),
                          @dmovFecven SMALLDATETIME,
                          @dinterface VARCHAR(2)',
                        @0,  
                        @1,  
                        @2,  
                        @3,  
                        @4, 
                        @5,  
                        @6,  
                        @7,  
                        @8,  
                        @9, 
                        @10, 
                        @11,
                        @12, 
                        @13, 
                        @14, 
                        @15, 
                        @16, 
                        @17  
                        `;
                this.logger.debug(`Executing UPDATE Query: ${updateSql.replace(/\n\s*/g, ' ')}`);
                await this.connection.query(updateSql, params);
                this.logger.debug(`UPDATE successful for DMOV_DOCUM: ${detalle.dmovDocum}, DMOV_ANEXO: ${detalle.dmovAnexo}`);
            } else {
                const insertSql = `
                    DECLARE @SQL NVARCHAR(MAX)
                    SET @SQL = N'
                        INSERT INTO ${tableName} (
                            SUBDIAR_CODIGO, DMOV_C_COMPR, DMOV_SECUE, DMOV_FECHA,
                            DMOV_CUENT, DMOV_ANEXO, DMOV_DOCUM, DMOV_FECDC,
                            DMOV_CENCO, DMOV_DEBE, DMOV_HABER, DMOV_DEBUS,
                            DMOV_HABUS, DMOV_GLOSA, DMOV_L_COMPR, DMOV_C_DESTI,
                            DMOV_FECVEN, DINTERFACE
                        ) VALUES (
                            @subdiarCodigo, @dmovCCompr, @dmovSecue, @dmovFecha,
                            @dmovCuent, @dmovAnexo, @dmovDocum, @dmovFecdc,
                            @dmovCenco, @dmovDebe, @dmovHaber, @dmovDebus,
                            @dmovHabus, @dmovGlosa, @dmovLCompr, @dmovCDesti,
                            @dmovFecven, @dinterface
                        )'

                    EXEC sp_executesql @SQL,
                        N'@subdiarCodigo VARCHAR(2),
                          @dmovCCompr VARCHAR(4),
                          @dmovSecue VARCHAR(5),
                          @dmovFecha SMALLDATETIME,
                          @dmovCuent VARCHAR(18),
                          @dmovAnexo VARCHAR(13),
                          @dmovDocum VARCHAR(23),
                          @dmovFecdc SMALLDATETIME,
                          @dmovCenco VARCHAR(10),
                          @dmovDebe NUMERIC(20,2),
                          @dmovHaber NUMERIC(20,2),
                          @dmovDebus NUMERIC(20,2),
                          @dmovHabus NUMERIC(20,2),
                          @dmovGlosa VARCHAR(60),
                          @dmovLCompr BIT,
                          @dmovCDesti VARCHAR(18),
                          @dmovFecven SMALLDATETIME,
                          @dinterface VARCHAR(2)',
                        @0, 
                        @1, 
                        @2,  
                        @3, 
                        @4,  
                        @5, 
                        @6,  
                        @7, 
                        @8,  
                        @9, 
                        @10, 
                        @11, 
                        @12, 
                        @13, 
                        @14, 
                        @15, 
                        @16,
                        @17 
                        `;
                this.logger.debug(`Executing INSERT Query: ${insertSql.replace(/\n\s*/g, ' ')}`);
                await this.connection.query(insertSql, params);
                this.logger.debug(`INSERT successful for DMOV_DOCUM: ${detalle.dmovDocum}, DMOV_ANEXO: ${detalle.dmovAnexo}`);
            }
        } catch (error) {
            this.logger.error(`Error in checkAndSaveDetalle for ${tableName}: ${error.message}`, error.stack);
            if (error.originalError) {
                this.logger.error(`Original DB Error (checkAndSaveDetalle): Code: ${error.originalError.info?.number || error.originalError.code}, Message: ${error.originalError.info?.message || error.originalError.message}`, error.originalError);
            }
            throw error;
        }
    }

    async generateDetalleMovimientos(sunatData: SunatData, monthPer: string, yearPer: string): Promise<DetalleMov[]> {
        this.logger.debug(`Generating DetalleMovimientos for SunatData CMOV_C_COMPR: ${sunatData.cmovCCompr}, Period: ${yearPer}-${monthPer}`);
        const detalles: DetalleMov[] = [];

        // Debug log sunatData values used for sequence generation
        this.logger.debug('SunatData values for sequence generation:', {
            biGravadoDg: sunatData.biGravadoDg,
            igvIpmDg: sunatData.igvIpmDg,
            totalCp: sunatData.totalCp,
            tipoCambio: sunatData.tipoCambio,
        });

        // Secuencia 00001
        const detalle1 = new DetalleMov();
        const secuencia1 = this.generateSecuencia(1);
        detalle1.subdiarCodigo = '04';
        detalle1.dmovCCompr = sunatData.cmovCCompr;
        detalle1.dmovSecue = secuencia1;
        detalle1.dmovFecha = sunatData.fechaEmision;
        detalle1.dmovFecdc = sunatData.fechaEmision;
        detalle1.dmovGlosa = sunatData.cmovGlosa;
        detalle1.dmovLCompr = sunatData.cmovLCompr;
        detalle1.dmovCDesti = '';
        detalle1.dmovFecven = sunatData.fechaVctoPago;
        detalle1.dinterface = '01';
        detalle1.dmovCuent = this.getCuentaContable(
            secuencia1,
            sunatData.moneda || 'MN',
            sunatData.ctaContable || ''
        );
        detalle1.dmovAnexo = this.getAnexo(
            secuencia1,
            sunatData.nroDocIdentidad || ''
        );
        detalle1.dmovCenco = this.getCentroCosto(
            secuencia1,
            sunatData.centroCosto || ''
        );
        detalle1.dmovDebe = this.calculateDebe(
            secuencia1,
            sunatData.biGravadoDg,
            sunatData.igvIpmDg
        );
        detalle1.dmovHaber = this.calculateHaber(
            secuencia1,
            sunatData.totalCp
        );
        detalle1.dmovDebus = this.calculateDebus(
            secuencia1,
            sunatData.biGravadoDg,
            sunatData.igvIpmDg,
            sunatData.tipoCambio
        );
        detalle1.dmovHabus = this.calculateHabus(
            secuencia1,
            sunatData.totalCpME
        );
        detalle1.dmovDocum = `${this.convertTipoCpDoc(sunatData.tipoCpDoc)}${sunatData.serieCdp || ''}${sunatData.nroCpInicial || ''}`;

        await this.checkAndSaveDetalle(detalle1, monthPer, yearPer);
        detalles.push(detalle1);

        // Secuencia 00002
        const detalle2 = new DetalleMov();
        const secuencia2 = this.generateSecuencia(2);
        detalle2.subdiarCodigo = '04';
        detalle2.dmovCCompr = sunatData.cmovCCompr;
        detalle2.dmovSecue = secuencia2;
        detalle2.dmovFecha = sunatData.fechaEmision;
        detalle2.dmovFecdc = sunatData.fechaEmision;
        detalle2.dmovGlosa = sunatData.cmovGlosa;
        detalle2.dmovLCompr = sunatData.cmovLCompr;
        detalle2.dmovCDesti = '';
        detalle2.dmovFecven = sunatData.fechaVctoPago;
        detalle2.dinterface = '01';
        detalle2.dmovCuent = this.getCuentaContable(
            secuencia2,
                sunatData.moneda || 'MN',
                sunatData.ctaContable || ''
            );
        detalle2.dmovAnexo = this.getAnexo(
            secuencia2,
            sunatData.nroDocIdentidad || ''
        );
        detalle2.dmovCenco = this.getCentroCosto(
            secuencia2,
            sunatData.centroCosto || ''
        );
        detalle2.dmovDebe = this.calculateDebe(
            secuencia2,
            sunatData.biGravadoDg,
            sunatData.igvIpmDg
        );
        detalle2.dmovHaber = this.calculateHaber(
            secuencia2,
            sunatData.totalCp
        );
        detalle2.dmovDebus = this.calculateDebus(
            secuencia2,
            sunatData.biGravadoDg,
            sunatData.igvIpmDg,
            sunatData.tipoCambio
        );
        detalle2.dmovHabus = this.calculateHabus(
            secuencia2,
            sunatData.totalCpME
        );
        detalle2.dmovDocum = `${this.convertTipoCpDoc(sunatData.tipoCpDoc)}${sunatData.serieCdp || ''}${sunatData.nroCpInicial || ''}`;

        await this.checkAndSaveDetalle(detalle2, monthPer, yearPer);
        detalles.push(detalle2);

        // Secuencia 00003
        const detalle3 = new DetalleMov();
        const secuencia3 = this.generateSecuencia(3);
        detalle3.subdiarCodigo = '04';
        detalle3.dmovCCompr = sunatData.cmovCCompr;
        detalle3.dmovSecue = secuencia3;
        detalle3.dmovFecha = sunatData.fechaEmision;
        detalle3.dmovFecdc = sunatData.fechaEmision;
        detalle3.dmovGlosa = sunatData.cmovGlosa;
        detalle3.dmovLCompr = sunatData.cmovLCompr;
        detalle3.dmovCDesti = '';
        detalle3.dmovFecven = sunatData.fechaVctoPago;
        detalle3.dinterface = '01';
        detalle3.dmovCuent = this.getCuentaContable(
            secuencia3,
            sunatData.moneda || 'MN',
            sunatData.ctaContable || ''
        );
        detalle3.dmovAnexo = this.getAnexo(
            secuencia3,
                sunatData.nroDocIdentidad || ''
            );
        detalle3.dmovCenco = this.getCentroCosto(
            secuencia3,
                sunatData.centroCosto || ''
            );
        detalle3.dmovDebe = this.calculateDebe(
            secuencia3,
                sunatData.biGravadoDg,
                sunatData.igvIpmDg
            );
        detalle3.dmovHaber = this.calculateHaber(
            secuencia3,
                sunatData.totalCp
            );
        detalle3.dmovDebus = this.calculateDebus(
            secuencia3,
                sunatData.biGravadoDg,
                sunatData.igvIpmDg,
                sunatData.tipoCambio
            );
        detalle3.dmovHabus = this.calculateHabus(
            secuencia3,
                sunatData.totalCpME
            );
        detalle3.dmovDocum = `${this.convertTipoCpDoc(sunatData.tipoCpDoc)}${sunatData.serieCdp || ''}${sunatData.nroCpInicial || ''}`;

        await this.checkAndSaveDetalle(detalle3, monthPer, yearPer);
        detalles.push(detalle3);
        
        this.logger.debug(`Generated ${detalles.length} DetalleMov records with sequences: ${detalles.map(d => d.dmovSecue).join(', ')}`);
        return detalles;
    }

    //This function creates accounting entries when 'BI Gravado DG' is 0 or null
    private async generateBiGravadoCeroDetalles(sunatData: SunatData, monthPer: string, yearPer: string): Promise<DetalleMov[]> {
        this.logger.debug(`Generating BI Gravado Cero Detalles for SunatData CMOV_C_COMPR: ${sunatData.cmovCCompr}, Period: ${yearPer}-${monthPer}`);
        const detalles: DetalleMov[] = [];
        
        // Secuencia 00001 (IGV)
        const detalleIgv = new DetalleMov();
        const secuenciaIgv = this.generateSecuencia(1);
        detalleIgv.subdiarCodigo = '04';
        detalleIgv.dmovCCompr = sunatData.cmovCCompr;
        detalleIgv.dmovSecue = secuenciaIgv;
        detalleIgv.dmovFecha = sunatData.fechaEmision;
        detalleIgv.dmovFecdc = sunatData.fechaEmision;
        detalleIgv.dmovGlosa = sunatData.cmovGlosa;
        detalleIgv.dmovLCompr = sunatData.cmovLCompr;
        detalleIgv.dmovCDesti = '';
        detalleIgv.dmovFecven = sunatData.fechaVctoPago;
        detalleIgv.dinterface = '01';
        detalleIgv.dmovCuent = sunatData.moneda === 'ME' ? '4212102' : '4212101';
        detalleIgv.dmovAnexo = '03' + (sunatData.nroDocIdentidad || '');
        detalleIgv.dmovCenco = '';
        detalleIgv.dmovDebe = 0;
        detalleIgv.dmovHaber = sunatData.totalCp || 0;
        detalleIgv.dmovDebus = 0;
        detalleIgv.dmovHabus = sunatData.totalCpME || 0;
        detalleIgv.dmovDocum = `${this.convertTipoCpDoc(sunatData.tipoCpDoc)}${sunatData.serieCdp || ''}${sunatData.nroCpInicial || ''}`;

        await this.checkAndSaveDetalle(detalleIgv, monthPer, yearPer);
        detalles.push(detalleIgv);

        // Secuencia 00002 (Contrapartida - e.g., a specific expense or asset account)
        const detalleContrapartida = new DetalleMov();
        const secuenciaContrapartida = this.generateSecuencia(2);
        detalleContrapartida.subdiarCodigo = '04';
        detalleContrapartida.dmovCCompr = sunatData.cmovCCompr;
        detalleContrapartida.dmovSecue = secuenciaContrapartida;
        detalleContrapartida.dmovFecha = sunatData.fechaEmision;
        detalleContrapartida.dmovFecdc = sunatData.fechaEmision;
        detalleContrapartida.dmovGlosa = sunatData.cmovGlosa;
        detalleContrapartida.dmovLCompr = sunatData.cmovLCompr;
        detalleContrapartida.dmovCDesti = '';
        detalleContrapartida.dmovFecven = sunatData.fechaVctoPago;
        detalleContrapartida.dinterface = '01';
        detalleContrapartida.dmovCuent = sunatData.ctaContable || '';
        detalleContrapartida.dmovAnexo = '03' + (sunatData.nroDocIdentidad || '');
        detalleContrapartida.dmovCenco = sunatData.centroCosto || '';
        detalleContrapartida.dmovDebe = sunatData.totalCp || 0;
        detalleContrapartida.dmovHaber = 0;
        detalleContrapartida.dmovDebus = sunatData.totalCp && sunatData.tipoCambio ? 
                    sunatData.totalCp / sunatData.tipoCambio : 0;
        detalleContrapartida.dmovHabus = 0;
        detalleContrapartida.dmovDocum = `${this.convertTipoCpDoc(sunatData.tipoCpDoc)}${sunatData.serieCdp || ''}${sunatData.nroCpInicial || ''}`;

        await this.checkAndSaveDetalle(detalleContrapartida, monthPer, yearPer);
        detalles.push(detalleContrapartida);
        
        this.logger.debug(`Generated ${detalles.length} BI Gravado Cero DetalleMov records for CMOV_C_COMPR: ${sunatData.cmovCCompr}`);
        return detalles;
    }

    /**
     * Validates dmovAnexo, dmovCuent, and dmovCenco against their respective tables.
     * Returns validation status for each field and missing data information.
     */
    async validateDetalleMovFields(
        dmovAnexo: string,
        dmovCuent: string,
        dmovCenco: string
    ): Promise<{
        anexoValid: boolean;
        cuentaValid: boolean;
        cencoValid: boolean;
        missingData: string[];
    }> {
        const missingData: string[] = [];
        let anexoValid = false;
        let cuentaValid = false;
        let cencoValid = false;

        try {
            // Validate dmovAnexo
            const anexoResult = await this.connection.query(
                `SELECT ANEX_RUC FROM [002BDCONTABILIDAD].[dbo].[ANEXO] WHERE ANEX_RUC = ? AND ANEX_RUC != ''`,
                [dmovAnexo]
            );
            anexoValid = anexoResult.length > 0;
            if (!anexoValid) missingData.push('Anexo');

            // Validate dmovCuent
            const cuentaResult = await this.connection.query(
                `SELECT [PLANCTA_CODIGO] FROM [002BDCONTABILIDAD].[dbo].[PLAN_CUENTA_NACIONAL] WHERE PLANCTA_CODIGO = ?`,
                [dmovCuent]
            );
            cuentaValid = cuentaResult.length > 0;
            if (!cuentaValid) missingData.push('Cuenta');

            // Validate dmovCenco
            const cencoResult = await this.connection.query(
                `SELECT [CENCOST_CODIGO] FROM [002BDCONTABILIDAD].[dbo].[CENTRO_COSTOS] WHERE CENCOST_CODIGO = ?`,
                [dmovCenco]
            );
            cencoValid = cencoResult.length > 0;
            if (!cencoValid) missingData.push('Centro de Costo');

            return {
                anexoValid,
                cuentaValid,
                cencoValid,
                missingData
            };
        } catch (error) {
            this.logger.error(`Error validating detalle movimiento fields: ${error.message}`);
            throw error;
        }
    }

    private convertTipoCpDoc(tipoCpDoc: string | null): string {
        if (!tipoCpDoc) return '';
        switch (tipoCpDoc) {
          case '1': return 'FT';
          case '7': return 'CC';
          case '8': return 'CD';
          default: return tipoCpDoc;
        }
      }
}