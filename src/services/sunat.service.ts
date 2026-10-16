import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import * as XLSX from 'xlsx';
import { SunatData } from '../entity/sunat/sunat-data.entity';
import { DetalleMov } from '../entity/sunat/detalle-mov.entity';
import { DetalleMovService } from './detalle-mov.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SunatResponse, ProcessError, ProcessDetail } from '../interfaces/sunat/sunat.interface';
import { performance } from 'perf_hooks';
import * as sql from 'mssql'; // Import mssql
import { SqlServerDriver } from 'typeorm/driver/sqlserver/SqlServerDriver'; // Import SqlServerDriver for pool access

// Removed ValidationResult, ProcessResults from sunat.interface import as they are not used in this file after changes.

// This interface is derived from ExcelSunatRow, but made specific for import processing
// and avoids `[key: string]: any` to ensure strong typing for used keys.
interface SunatImportRecord {
    // Fields used for validation
    'Nro Doc Identidad': string;
    'CTA_CONTABLE': string;
    'CENTRO_COSTO': string;

    // Fields for parsing and calculations
    'Fecha de emisión': string;
    'Fecha Vcto/Pago': string;
    'Moneda': string;
    'Tipo de Cambio': number;
    'Total CP': number;
    'BI Gravado DG': number;
    'IGV / IPM DG': number;
    'Tipo CP/Doc.': string; // Document type, e.g., for credit notes
    'Serie del CDP': string;
    'Nro CP o Doc. Nro Inicial (Rango)': string;

    // Optional fields that might be passed from frontend or derived
    yearPer?: string; // Year for processing period
    monthPer?: string; // Month for processing period

    // Other relevant fields from ExcelSunatRow can be added if needed
    'RUC'?: string; // Often the same as 'Nro Doc Identidad'
    'Periodo'?: string; // Raw period string if yearPer/monthPer are not directly provided
}

interface ExcelSunatRow {
    RUC: string;
    'Apellidos y Nombres o Razón social': string;
    Periodo: string;
    'CAR SUNAT': string;
    'Fecha de emisión': string;
    'Fecha Vcto/Pago': string;
    'Tipo CP/Doc.': string;
    'Serie del CDP': string;
    'Año': string;
    'Nro CP o Doc. Nro Inicial (Rango)': string;
    'Nro Final (Rango)': string;
    'Tipo Doc Identidad': string;
    'Nro Doc Identidad': string;
    'Apellidos Nombres/ Razón  Social': string;
    'BI Gravado DG': number;
    'IGV / IPM DG': number;
    'Valor Adq. NG': number;
    'Total CP': number;
    'Moneda': string;
    'Tipo de Cambio': number;
    'CTA_CONTABLE': string;
    'CENTRO_COSTO': string;
    'VENDEDOR': string;
    'Fecha Emisión Doc Modificado': string;
    'Tipo CP Modificado': string;
    'Serie CP Modificado': string;
    'Nro CP Modificado': string;
    [key: string]: any;
}

// Interface for a failed record entry for internal tracking
interface FailedRecordEntry {
    record: SunatImportRecord; // Changed to SunatImportRecord
    error: string;
}

@Injectable()
export class SunatService {
    private readonly logger = new Logger(SunatService.name);

    constructor(
        @InjectConnection()
        private connection: Connection,
        private detalleMovService: DetalleMovService,
        @InjectRepository(SunatData)
        private sunatDataRepository: Repository<SunatData>,
        @InjectRepository(DetalleMov)
        private detalleMovRepository: Repository<DetalleMov>,
    ) {
        this.logger.log('SunatService initialized');
    }

    private convertCurrency(data: { moneda: string | null; totalCp: number | null; tipoCambio: number | null }): { mn: number | null; me: number | null } {
        this.logger.debug(`Converting currency - Input: Moneda=${data.moneda}, TotalCP=${data.totalCp}, TipoCambio=${data.tipoCambio}`);
        
        if (data.totalCp === null || data.totalCp === undefined || data.tipoCambio === null || data.tipoCambio === undefined) {
            this.logger.warn('Missing totalCp or tipoCambio for currency conversion');
            return { mn: null, me: null };
        }

        if (data.moneda === 'USD') {
            const result = {
                mn: data.totalCp * data.tipoCambio,
                me: data.totalCp
            };
            this.logger.debug(`Currency conversion result (USD): MN=${result.mn}, ME=${result.me}`);
            return result;
        }
        
        const result = {
            mn: data.totalCp,
            me: data.tipoCambio !== 0 ? data.totalCp / data.tipoCambio : null // Avoid division by zero
        };
        this.logger.debug(`Currency conversion result (PEN): MN=${result.mn}, ME=${result.me}`);
        return result;
    }

    private calculateCmovCames(data: { moneda: string | null; tipoCambio: number | null }): number {
        this.logger.debug(`Calculating CMOV_CAMES - Input: Moneda=${data.moneda}, TipoCambio=${data.tipoCambio}`);
        if (data.tipoCambio === null || data.tipoCambio === undefined) {
            this.logger.warn('Missing tipoCambio for CMOV_CAMES calculation');
            return 0;
        }
        const result = data.moneda === 'PEN' ? data.tipoCambio : 0; // Assuming 0 if not PEN, adjust if logic is different for USD
        this.logger.debug(`CMOV_CAMES calculation result: ${result}`);
        return result;
    }

    private adjustTotalForNotaCredito(data: { tipoCpDoc: string | null; totalCp: number | null }): number | null {
        if (data.totalCp === null || data.totalCp === undefined) return null;
        // Assuming '07' is Nota de Crédito for compras. Adjust if different for sales.
        const isNotaCredito = data.tipoCpDoc === '07';
        const adjustedTotal = isNotaCredito ? data.totalCp * -1 : data.totalCp;
        this.logger.debug(`Adjusting Total CP for Nota Credito (${data.tipoCpDoc}): Original=${data.totalCp}, Adjusted=${adjustedTotal}`);
        return adjustedTotal;
    }

    private calculateTipoCambio(data: { moneda: string | null; tipoCambio: number | null }): number {
        if (data.tipoCambio === null || data.tipoCambio === undefined) return 0;
        // If currency is MN (PEN), CMOV_TIPCA is 1/TC from excel. If USD, it's TC from excel.
        // This logic might depend on specific accounting rules for CMOV_TIPCA.
        // The current DetalleMovService uses sunatData.tipoCambio directly for some calcs,
        // implying sunatData.tipoCambio stores the original TC.
        // CMOV_TIPCA often stores the TC used for conversion to local currency.
        const result = data.moneda === 'PEN' && data.tipoCambio !== 0 ? 1 / data.tipoCambio : data.tipoCambio;
        this.logger.debug(`Calculated CMOV_TIPCA: Moneda=${data.moneda}, Input TC=${data.tipoCambio}, Result TC=${result}`);
        return result;
    }

    private calculateTotalCpME(data: { moneda: string | null; totalCp: number | null; tipoCambio: number | null }): number | null {
        if (data.totalCp === null || data.totalCp === undefined || data.tipoCambio === null || data.tipoCambio === undefined || data.tipoCambio === 0) return null;

        // If currency is PEN (MN), convert to ME (USD)
        if (data.moneda === 'PEN') {
            return data.totalCp / data.tipoCambio;
        }
        // If currency is USD (ME), it's already in ME
        if (data.moneda === 'USD') {
            return data.totalCp;
        }
        return null; // Should not happen if moneda is always PEN or USD
    }

    private async checkDatabaseExists(yearPer: string): Promise<boolean> {
        const dbName = `002BDCONT${yearPer}`;
        this.logger.debug(`Checking if database exists: ${dbName}`);
        const startTime = performance.now();
        
        try {
            const result = await this.connection.query(
                `SELECT DB_ID(N'${dbName}') as dbId`
            );
            const exists = result[0].dbId !== null;
            const duration = Math.round(performance.now() - startTime);
            
            this.logger.debug(`Database check completed in ${duration}ms. Database ${dbName} ${exists ? 'exists' : 'does not exist'}`);
            return exists;
        } catch (error) {
            this.logger.error(`Error checking database existence: ${error.message}`, error.stack);
            throw new HttpException('Error checking database', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private async getNextComprobante(monthPer: string, yearPer: string): Promise<string> {
        this.logger.debug(`Getting next comprobante number for month: ${monthPer}`);
        const startTime = performance.now();
        
        try {
            // Ensure this query targets the correct database, potentially dynamic based on yearPer
            const result = await this.connection.query(
                `SELECT MAX(CAST(CMOV_C_COMPR AS INT)) as lastCompr FROM [002BDCONT${yearPer}].dbo.[CABMOV${monthPer}] WHERE SUBDIAR_CODIGO = '04'`
            );
            const lastNumber = result[0]?.lastCompr || 0;
            const nextNumber = (lastNumber + 1).toString().padStart(4, '0');
            
            const duration = Math.round(performance.now() - startTime);
            this.logger.debug(`Next comprobante generated in ${duration}ms: ${nextNumber}`);
            return nextNumber;
        } catch (error) {
            this.logger.error(`Error getting next comprobante: ${error.message}`, error.stack);
            return '0001'; // Fallback, consider implications
        }
    }

    private parseDate(dateStr: string | null | undefined): Date | null {
        if (!dateStr) return null;
        // Frontend sends dates formatted as 'dd/mm/yyyy' due to XLSX.utils.sheet_to_json with dateNF: 'dd/mm/yyyy'
        this.logger.debug(`Attempting to parse date string: "${dateStr}" (expected dd/mm/yyyy)`);

        try {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                const dayStr = parts[1];     // Corrected: parts[0] is day
                const monthStr = parts[0];   // Corrected: parts[1] is month
                const yearStr = parts[2];    // parts[2] is year

                const day = parseInt(dayStr, 10);
                const month = parseInt(monthStr, 10);
                let year = parseInt(yearStr, 10);

                if (isNaN(day) || isNaN(month) || isNaN(year)) {
                    this.logger.warn(`Invalid date components after parsing "${dateStr}" (expected dd/mm/yyyy): D=${dayStr}, M=${monthStr}, Y=${yearStr}. Will attempt fallback.`);
                    // Fall through to standard new Date(dateStr)
                } else {
                    // Adjust year if it's two digits (e.g., 25 -> 2025) - this might not be needed if yearStr is always YYYY
                    if (yearStr.length === 2 && year >= 0 && year <= 99) { 
                        year += 2000; 
                    }

                    // Validate month (1-12) and day (1-31 range, specific check later)
                    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                        const parsed = new Date(year, month - 1, day); // JS Date constructor month is 0-indexed
                        
                        if (parsed.getFullYear() === year &&
                            parsed.getMonth() === month - 1 &&
                            parsed.getDate() === day) {
                            this.logger.debug(`Successfully parsed "${dateStr}" as dd/mm/yyyy to: ${parsed.toISOString()}`);
                            return parsed;
                        } else {
                            this.logger.warn(`Date components for "${dateStr}" (D=${day}, M=${month}, Y=${year}) resulted in an invalid date or rollover by constructor.`);
                        }
                    } else {
                        this.logger.warn(`Day or Month out of basic range for "${dateStr}" (parsed as D=${day}, M=${month}). Will attempt fallback.`);
                    }
                }
            }

            this.logger.debug(`Falling back to new Date("${dateStr}") for string: "${dateStr}"`);
            const genericParsedDate = new Date(dateStr);
            if (!isNaN(genericParsedDate.getTime())) {
                this.logger.debug(`Fallback new Date("${dateStr}") successfully parsed to: ${genericParsedDate.toISOString()}`);
                return genericParsedDate;
            }

            this.logger.error(`Could not parse date string: "${dateStr}" using dd/mm/yyyy or fallback.`);
            return null;
        } catch (error) {
            this.logger.error(`Exception during parsing date string: "${dateStr}"`, error);
            return null;
        }
    }

    private parseNumber(value: string | number | null | undefined): number | null {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value === 'number') return value;
        try {
            const parsed = parseFloat(value.toString().replace(/,/g, ''));
            return isNaN(parsed) ? null : parsed;
        } catch (error) {
            this.logger.warn(`Error parsing number: ${value}, ${error}`);
            return null;
        }
    }

    private convertMonedaCode(moneda: string | null | undefined): string {
        if (!moneda) return 'MN'; // Default to MN (Moneda Nacional - PEN)
        return moneda.toUpperCase() === 'USD' ? 'ME' : 'MN'; // ME for Moneda Extranjera (USD)
    }

    private convertTipoCpDoc(tipoCpDoc: string | null): string {
        if (!tipoCpDoc) return '';
        switch (tipoCpDoc) {
            case '1': return 'FT'; // Factura
            case '7': return 'CC'; // Nota de Crédito
            case '8': return 'CD'; // Nota de Débito
            default: return tipoCpDoc;
        }
    }

    private async validateDocIdentidad(nroDocIdentidad: string | null | undefined): Promise<boolean> {
        if (!nroDocIdentidad) return false;
        try {
            const result = await this.connection.query(
                `SELECT [ANEX_RUC] FROM [002BDCONTABILIDAD].[dbo].[ANEXO] 
                WHERE TIPOANEX_CODIGO = '03' AND ANEX_RUC = @0`,
                [nroDocIdentidad]
            );
            return result.length > 0;
        } catch (error) {
            this.logger.error(`Error validating documento identidad '${nroDocIdentidad}': ${error.message}`);
            return false; // Or throw, depending on desired error handling
        }
    }

    private async validateCentroCosto(centroCosto: string | null | undefined): Promise<boolean> {
        if (!centroCosto) return true; // Or false if mandatory
        try {
            const result = await this.connection.query(
                `SELECT [CENCOST_CODIGO] FROM [002BDCONTABILIDAD].[dbo].[CENTRO_COSTOS] 
                WHERE CENCOST_CODIGO = @0`,
                [centroCosto]
            );
            return result.length > 0;
        } catch (error) {
            this.logger.error(`Error validating centro costo '${centroCosto}': ${error.message}`);
            return false;
        }
    }

    private async validateCtaContable(ctaContable: string | null | undefined): Promise<boolean> {
        if (!ctaContable) return false;
        try {
            const result = await this.connection.query(
                `SELECT [PLANCTA_CODIGO] FROM [002BDCONTABILIDAD].[dbo].[PLAN_CUENTA_NACIONAL] 
                WHERE PLANCTA_CODIGO = @0`,
                [ctaContable]
            );
            return result.length > 0;
        } catch (error) {
            this.logger.error(`Error validating cuenta contable '${ctaContable}': ${error.message}`);
            return false;
        }
    }

    private valueToSqlString(value: any): string {
        if (value === null || value === undefined) {
            return "NULL";
        }
        if (typeof value === 'string') {
            return `'${value.replace(/'/g, "''")}'`; // Escape single quotes
        }
        if (typeof value === 'number') {
            if (!Number.isFinite(value)) {
                this.logger.warn(`Attempting to convert non-finite number to SQL string: ${value}. Returning NULL.`);
                return "NULL";
            }
            return value.toString();
        }
        if (typeof value === 'boolean') {
            return value ? '1' : '0';
        }
        if (value instanceof Date) {
            if (isNaN(value.getTime())) {
                this.logger.warn(`Attempting to convert invalid Date to SQL string. Returning NULL.`);
                return "NULL";
            }
            // Format to YYYYMMDD, enclosed in quotes for SQL string literal
            const year = value.getFullYear();
            const month = (value.getMonth() + 1).toString().padStart(2, '0');
            const day = value.getDate().toString().padStart(2, '0');
            return `'${year}${month}${day}'`; // Reverted to YYYYMMDD format as string literal
        }
        
        this.logger.warn(`valueToSqlString encountered unhandled type for value: ${JSON.stringify(value)} of type ${typeof value}. Converting to string literal.`);
        return `'${String(value).replace(/'/g, "''")}'`; // Default fallback
    }

    private async getTipoCambioSunatByFecha(fecha: Date): Promise<number | null> {
        if (!fecha) {
            this.logger.warn('getTipoCambioSunatByFecha called with null fecha.');
            return null;
        }
        // Ensure date is valid before formatting
        if (isNaN(fecha.getTime())) {
            this.logger.warn(`getTipoCambioSunatByFecha called with invalid date object: ${fecha}`);
            return null;
        }
        
        this.logger.debug(`Querying TIPO_CAMBIO_SUNAT for FECHA = '${fecha}'`);
        try {
            const result = await this.connection.query(
                // Assuming FECHA column might be DATETIME, so CONVERT to date for comparison
                `SELECT VENTA FROM [BDWENCO].[dbo].[TIPO_CAMBIO_SUNAT] WHERE CONVERT(date, FECHA) = @0`,
                [fecha]
            );
            if (result && result.length > 0 && result[0].VENTA !== null && result[0].VENTA !== undefined) {
                const venta = parseFloat(result[0].VENTA);
                if (!isNaN(venta) && venta > 0) { // Ensure TC is a positive number
                    this.logger.debug(`Found TIPO_CAMBIO_SUNAT.VENTA = ${venta} for FECHA = '${fecha}'`);
                    return venta;
                }
                this.logger.warn(`Invalid or non-positive VENTA value found in TIPO_CAMBIO_SUNAT for FECHA = '${fecha}': ${result[0].VENTA}`);
            } else {
                this.logger.warn(`No TIPO_CAMBIO_SUNAT.VENTA found or value is null/undefined for FECHA = '${fecha}'`);
            }
            return null;
        } catch (error) {
            this.logger.error(`Error querying TIPO_CAMBIO_SUNAT for FECHA = '${fecha}': ${error.message}`, error.stack);
            return null; 
        }
    }

    async processExcelFile(file: Express.Multer.File, usuCodigo: number): Promise<SunatResponse> {
        this.logger.debug(`Processing Excel file: ${file.originalname} by user ${usuCodigo}`);
        throw new HttpException('processExcelFile is deprecated for the new frontend parsing flow. Use /process-impcompras-data.', HttpStatus.METHOD_NOT_ALLOWED);
    }

    async processImportedData(data: SunatImportRecord[], usuCodigo: number): Promise<SunatResponse> {
        const startTime = performance.now();
        this.logger.log(`Starting data processing for user ${usuCodigo}. Total records: ${data.length}`);

        if (!data || data.length === 0) {
            this.logger.warn('No data provided to process');
            throw new HttpException('No data provided to process.', HttpStatus.BAD_REQUEST);
        }

        let successfullyProcessed = 0;
        const failedRecordsInternal: FailedRecordEntry[] = [];
        const errorsForResponse: ProcessError[] = [];
        const processedDetails: ProcessDetail[] = [];

        let commonYearPer: string | undefined;
        let commonMonthPer: string | undefined;

        if (data.length > 0 && typeof data[0]?.yearPer === 'string' && data[0].yearPer.length > 0 &&
            typeof data[0]?.monthPer === 'string' && data[0].monthPer.length > 0) {
            commonYearPer = data[0].yearPer;
            commonMonthPer = data[0].monthPer;
        } else if (data.length > 0) {
            const firstRecordPeriod = data[0]?.Periodo;
            if (typeof firstRecordPeriod === 'string' && firstRecordPeriod.length === 6) {
                commonYearPer = firstRecordPeriod.substring(0, 4);
                commonMonthPer = firstRecordPeriod.substring(4, 6);
            } else {
                commonYearPer = new Date().getFullYear().toString();
                commonMonthPer = (new Date().getMonth() + 1).toString().padStart(2, '0');
                this.logger.warn(`Defaulting to current year/month: ${commonYearPer}/${commonMonthPer}`);
            }
        } else {
            commonYearPer = new Date().getFullYear().toString();
            commonMonthPer = (new Date().getMonth() + 1).toString().padStart(2, '0');
            this.logger.warn(`Defaulting to current year/month as input data array is empty`);
        }

        this.logger.log(`Final Processing period: Year=${commonYearPer}, Month=${commonMonthPer}`);
        
        let dbExists = false;
        try {
            dbExists = await this.checkDatabaseExists(commonYearPer as string);
            if (!dbExists) {
               throw new HttpException(`Database for year ${commonYearPer} not found.`, HttpStatus.BAD_REQUEST);
            }
        } catch (errorAroundDbCheck) {
            this.logger.error(`CRITICAL ERROR during DB check: ${errorAroundDbCheck.message}`, errorAroundDbCheck.stack);
            throw errorAroundDbCheck;
        }

        for (let i = 0; i < data.length; i++) {
            const recordStartTime = performance.now();
            const record: SunatImportRecord = data[i];
            const currentRow = (i + 1).toString();

            try {
                this.logger.debug(`Processing record ${currentRow}/${data.length}: ${JSON.stringify(record)}`);
                const nroDocIdentidad = record['Nro Doc Identidad'] || record['RUC'];
                const ctaContable = record['CTA_CONTABLE'];
                const centroCosto = record['CENTRO_COSTO'];

                const [isDocValid, isCtaValid, isCencoValid] = await Promise.all([
                    this.validateDocIdentidad(nroDocIdentidad),
                    this.validateCtaContable(ctaContable),
                    this.validateCentroCosto(centroCosto)
                ]);
                const validationErrors: string[] = [];
                if (!nroDocIdentidad) validationErrors.push('Nro Doc Identidad/RUC is missing.');
                else if (!isDocValid) validationErrors.push(`Nro Doc Identidad '${nroDocIdentidad}' not found.`);
                if (!ctaContable) validationErrors.push('CTA_CONTABLE is missing.');
                else if (!isCtaValid) validationErrors.push(`CTA_CONTABLE '${ctaContable}' not found.`);
                if (centroCosto && !isCencoValid) validationErrors.push(`CENTRO_COSTO '${centroCosto}' not found.`);
                if (!record['Fecha de emisión']) validationErrors.push('Fecha de emisión is missing.');
                if (record['Total CP'] === null || record['Total CP'] === undefined) validationErrors.push('Total CP is missing.');
                if (validationErrors.length > 0) throw new Error(`Validation failed: ${validationErrors.join('; ')}`);

                const fechaEmision = this.parseDate(record['Fecha de emisión']);
                const fechaVctoPago = this.parseDate(record['Fecha Vcto/Pago']);
                const monedaOriginal = record['Moneda'];
                let tipoCambioOriginal = this.parseNumber(record['Tipo de Cambio']);
                let totalCpOriginal = this.parseNumber(record['Total CP']);

                if (fechaEmision === null) throw new Error('Invalid Fecha de emisión.');
                if (tipoCambioOriginal === null) throw new Error('Invalid Tipo de Cambio.');
                if (totalCpOriginal === null) throw new Error('Invalid Total CP.');
                
                let effectiveTipoCambio = tipoCambioOriginal;
                if (tipoCambioOriginal === 1) {
                    if (!fechaEmision || isNaN(fechaEmision.getTime())) {
                        throw new Error(`Fecha de emisión inválida o faltante ('${record['Fecha de emisión']}') para obtener TC de BD.`);
                    }
                    const tcFromDb = await this.getTipoCambioSunatByFecha(fechaEmision);
                    if (tcFromDb !== null && tcFromDb > 0) {
                        effectiveTipoCambio = tcFromDb;
                    } else {
                        throw new Error(`El Tipo de Cambio (originalmente 1) no pudo ser obtenido de BD para fecha ${record['Fecha de emisión']}.`);
                    }
                }
                totalCpOriginal = this.adjustTotalForNotaCredito({ tipoCpDoc: record['Tipo CP/Doc.'], totalCp: totalCpOriginal }) ?? totalCpOriginal;

                const cmovMoned = this.convertMonedaCode(monedaOriginal);
                const currencyConversion = this.convertCurrency({ moneda: monedaOriginal, totalCp: totalCpOriginal, tipoCambio: effectiveTipoCambio });
                const cmovCames = this.calculateCmovCames({ moneda: monedaOriginal, tipoCambio: effectiveTipoCambio });
                const cmovTipca = this.calculateTipoCambio({ moneda: monedaOriginal, tipoCambio: effectiveTipoCambio });
                const totalCpME = this.calculateTotalCpME({ moneda: monedaOriginal, totalCp: totalCpOriginal, tipoCambio: effectiveTipoCambio });

                const sunatData = new SunatData();
                sunatData.cmovCCompr = await this.getNextComprobante(commonMonthPer as string, commonYearPer as string);
                sunatData.cmovFecha = fechaEmision; // JS Date
                sunatData.cmovGlosa = 'IMPORTACION COMPRAS';
                sunatData.cmovMoned = cmovMoned;
                sunatData.cmovConve = 'VTA';
                sunatData.cmovCames = typeof cmovCames === 'number' && Number.isFinite(cmovCames) ? Math.round(cmovCames * 1000) / 1000 : cmovCames;
                sunatData.cmovFecca = fechaEmision; // JS Date
                sunatData.cmovTipca = typeof cmovTipca === 'number' && Number.isFinite(cmovTipca) ? Math.round(cmovTipca * 1000) / 1000 : cmovTipca;
                sunatData.cmovDebe = currencyConversion.mn;
                sunatData.cmovHaber = currencyConversion.mn; // Equal to CMOV_DEBE
                sunatData.cmovDebus = typeof currencyConversion.me === 'number' && Number.isFinite(currencyConversion.me) ? Math.round(currencyConversion.me * 1000) / 1000 : currencyConversion.me;
                sunatData.cmovHabus = typeof currencyConversion.me === 'number' && Number.isFinite(currencyConversion.me) ? Math.round(currencyConversion.me * 1000) / 1000 : currencyConversion.me; // Equal to CMOV_DEBUS
                sunatData.cmovLCompr = true;
                sunatData.fechVcto = fechaVctoPago; // JS Date
                sunatData.cinterface = '01';
                sunatData.cUsuario = usuCodigo.toString();
                sunatData.moneda = monedaOriginal;
                sunatData.tipoCambio = effectiveTipoCambio;
                sunatData.fechaEmision = fechaEmision;
                sunatData.fechaVctoPago = fechaVctoPago;
                sunatData.totalCp = totalCpOriginal;
                sunatData.totalCpME = totalCpME;
                sunatData.ctaContable = ctaContable;
                sunatData.nroDocIdentidad = nroDocIdentidad ?? null;
                sunatData.centroCosto = centroCosto;
                sunatData.biGravadoDg = this.parseNumber(record['BI Gravado DG']);
                sunatData.igvIpmDg = this.parseNumber(record['IGV / IPM DG']);
                sunatData.tipoCpDoc = this.convertTipoCpDoc(record['Tipo CP/Doc.']);
                sunatData.serieCdp = record['Serie del CDP'];
                sunatData.nroCpInicial = record['Nro CP o Doc. Nro Inicial (Rango)'];

                const cabmovTable = `[002BDCONT${commonYearPer}].dbo.[CABMOV${commonMonthPer}]`;
                
                // Define all DB columns for the insert, excluding date fields as per user request
                const allCabMovDbColumnNames = [
                    'CMOV_C_COMPR', 'CMOV_FECHA', 'CMOV_GLOSA', 'CMOV_MONED',
                    'CMOV_CONVE', 'CMOV_CAMES', 'CMOV_FECCA', 'CMOV_TIPCA',
                    'CMOV_DEBE', 'CMOV_HABER', 'CMOV_DEBUS', 'CMOV_HABUS',
                    'CMOV_L_COMPR', 'FECH_VCTO', 'CINTERFACE', 'C_USUARIO',
                    'SUBDIAR_CODIGO', 'C_FECREGSISTEMA'
                ];

                // Include all columns, including date columns
                const cabMovDbColumnNamesListFiltered = allCabMovDbColumnNames;
                const actualColumnsString = cabMovDbColumnNamesListFiltered.join(', ');

                // The entire try-catch block for mssql.Request based insert is replaced by the raw SQL insert below.
                try {
                    // --- BEGIN RAW SQL INSERT --- 
                    this.logger.error(
                        `Original Date values for insert CMOV_C_COMPR ${sunatData.cmovCCompr} (JS Date objects will be treated as NULL): ` +
                        `CMOV_FECHA: ${sunatData.cmovFecha ? sunatData.cmovFecha.toISOString() : 'null'}, ` +
                        `CMOV_FECCA: ${sunatData.cmovFecca ? sunatData.cmovFecca.toISOString() : 'null'}, ` +
                        `FECH_VCTO: ${sunatData.fechVcto ? sunatData.fechVcto.toISOString() : 'null'}`
                    );

                    // Map sunatData properties to their SQL string representations, excluding dates
                    const valuesForSql = cabMovDbColumnNamesListFiltered.map(colName => {
                        switch (colName) {
                            case 'CMOV_C_COMPR': return this.valueToSqlString(sunatData.cmovCCompr);
                            case 'CMOV_GLOSA': return this.valueToSqlString(sunatData.cmovGlosa);
                            case 'CMOV_MONED': return this.valueToSqlString(sunatData.cmovMoned);
                            case 'CMOV_CONVE': return this.valueToSqlString(sunatData.cmovConve);
                            case 'CMOV_CAMES': return this.valueToSqlString(sunatData.cmovCames);
                            case 'CMOV_TIPCA': return this.valueToSqlString(sunatData.cmovTipca);
                            case 'CMOV_DEBE': return this.valueToSqlString(sunatData.cmovDebe);
                            case 'CMOV_HABER': return this.valueToSqlString(sunatData.cmovHaber);
                            case 'CMOV_DEBUS': return this.valueToSqlString(sunatData.cmovDebus);
                            case 'CMOV_HABUS': return this.valueToSqlString(sunatData.cmovHabus);
                            case 'CMOV_L_COMPR': return this.valueToSqlString(sunatData.cmovLCompr);
                            case 'CINTERFACE': return this.valueToSqlString(sunatData.cinterface);
                            case 'C_USUARIO': return this.valueToSqlString(sunatData.cUsuario);
                            case 'SUBDIAR_CODIGO': return this.valueToSqlString('04'); // Hardcoded
                            case 'C_FECREGSISTEMA': return this.valueToSqlString(new Date());
                            case 'CMOV_FECHA': return this.valueToSqlString(sunatData.cmovFecha);
                            case 'CMOV_FECCA': return this.valueToSqlString(sunatData.cmovFecca);
                            case 'FECH_VCTO': return this.valueToSqlString(sunatData.fechVcto);
                            // Date columns (CMOV_FECHA, CMOV_FECCA, FECH_VCTO) are intentionally omitted from this mapping if excluded above
                            default: 
                                this.logger.warn(`Unhandled column name in valuesForSql mapping: ${colName}`);
                                return "NULL"; // Should not happen if cabMovDbColumnNamesListFiltered is correct
                        }
                    });
                    const valuesSqlString = valuesForSql.join(', ');
                    
                    const rawInsertQuery = `INSERT INTO ${cabmovTable} (${actualColumnsString}) VALUES (${valuesSqlString})`;

                    this.logger.debug(`Attempting raw insert (dates excluded). Query: "${rawInsertQuery}"`);
                    await this.connection.query(rawInsertQuery); 
                    this.logger.debug(`Successfully inserted SunatData into ${cabmovTable} (raw query) for CMOV_C_COMPR: ${sunatData.cmovCCompr}`);
                    // --- END RAW SQL INSERT ---                   
                    
                    const savedSunatData = sunatData; // Assuming sunatData is sufficient as savedSunatData for subsequent logic
                                                    // If an ID or other data is returned from insert, adjust here.
                    const detallesMov = await this.detalleMovService.generateDetalleMovimientos(savedSunatData, commonMonthPer as string, commonYearPer as string);
                    this.logger.debug(`Generated ${detallesMov.length} DetalleMov records for SunatData ID: ${savedSunatData.cmovCCompr}`);
                    this.logger.debug('DetallesMov sequences:', detallesMov.map(d => ({ 
                        sequence: d.dmovSecue,
                        debe: d.dmovDebe,
                        haber: d.dmovHaber,
                        debus: d.dmovDebus,
                        habus: d.dmovHabus,
                        cenco: d.dmovCenco,
                        cuenta: d.dmovCuent
                    })));
                    processedDetails.push({ cabecera: savedSunatData, detalles: detallesMov });
                    successfullyProcessed++;

                } catch (dbError) {
                    this.logger.error(`Database error inserting into ${cabmovTable}: ${dbError.message}`, dbError.stack);
                    if (dbError.originalError) {
                         this.logger.error(`Original DB Error: Code: ${dbError.originalError.info?.number || dbError.originalError.code}, Message: ${dbError.originalError.info?.message || dbError.originalError.message}`, dbError.originalError);
                    }
                    throw new Error(`DB insert failed for ${cabmovTable}: ${dbError.message}`); 
                }
                 const recordDuration = Math.round(performance.now() - recordStartTime);
                this.logger.debug(`Record ${currentRow} processed in ${recordDuration}ms (final status might be error)`);

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error during processing';
                this.logger.error(`Failed to process record ${currentRow}: ${errorMessage}`, {
                    record: JSON.stringify(record),
                    errorStack: error instanceof Error ? error.stack : undefined
                });
                errorsForResponse.push({ row: currentRow, error: errorMessage });
                this.logger.warn(`Processing stopped due to an error on record ${currentRow}. ${successfullyProcessed} records were processed before this error.`);
                return {
                    success: false,
                    message: `Processing halted at record ${currentRow}. Error: ${errorMessage}. Processed before halt: ${successfullyProcessed}.`,
                    errors: errorsForResponse,
                    processedRecords: successfullyProcessed,
                    yearPer: commonYearPer as string,
                    monthPer: commonMonthPer as string,
                    data: processedDetails
                };
            }
        }

        const totalDuration = Math.round(performance.now() - startTime);
        this.logger.log(`Processing completed in ${totalDuration}ms. Success: ${successfullyProcessed}, Failed: ${failedRecordsInternal.length > 0 ? failedRecordsInternal.length : errorsForResponse.length}`);

        return {
            success: successfullyProcessed > 0 && errorsForResponse.length === 0,
            message: `Processed ${successfullyProcessed} records. Failed: ${errorsForResponse.length}.`,
            errors: errorsForResponse,
            processedRecords: successfullyProcessed,
            yearPer: commonYearPer as string,
            monthPer: commonMonthPer as string,
            data: processedDetails
        };
    }
}