import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import * as XLSX from 'xlsx';
import { PlanProduccion } from '../entity/produccion/plan-produccion.entity';
import { PlanProduccionExcelRow } from '../interfaces/plan-produccion.interface';
import { PlanProduccionResponse } from '../interfaces/plan-produccion-response.interface';

@Injectable()
export class ProduccionService {
    private readonly logger = new Logger(ProduccionService.name);

    constructor(
        @InjectConnection()
        private connection: Connection
    ) {}

    private normalizeDate(date: Date): Date {
        // Create a new date in local timezone
        const normalized = new Date(date.getTime());
        // Add timezone offset to ensure correct date
        normalized.setMinutes(normalized.getMinutes() + normalized.getTimezoneOffset());
        // Set time to midnight
        normalized.setHours(0, 0, 0, 0);
        return normalized;
    }

    async processPlanProduccionExcel(file: Express.Multer.File, fechaDesde: Date, fechaHasta: Date): Promise<PlanProduccionResponse> {
        const queryRunner = this.connection.createQueryRunner();
        await queryRunner.connect();

        // Normalize dates to midnight
        const normalizedFechaDesde = this.normalizeDate(fechaDesde);
        const normalizedFechaHasta = this.normalizeDate(fechaHasta);

        try {
            // Read the Excel file
            const workbook = XLSX.read(file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            if (!sheetName) {
                return {
                    success: false,
                    mensaje: 'El archivo Excel está vacío o no es válido'
                };
            }

            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json<PlanProduccionExcelRow>(worksheet);

            // Validate data
            this.validateExcelData(jsonData);

            let rowsProcessed = 0;

            // Process each row
            for (const row of jsonData) {
                const aCodigo = String(row.ACODIGO);
                const cantProd = typeof row.CANT_PROD === 'string' ? parseFloat(row.CANT_PROD) : row.CANT_PROD;

                if (!aCodigo || isNaN(cantProd)) {
                    return {
                        success: false,
                        mensaje: `Datos inválidos: ACODIGO o CANT_PROD están ausentes o no son válidos`
                    };
                }

                try {
                    // Try to update first, using CONVERT to ensure date comparison is correct
                    const updateQuery = `
                        UPDATE [003BDPRODUCCION].[dbo].[PLAN_PRODUCCION] 
                        SET CANT_PROD = @0 
                        WHERE CONVERT(date, FECHA_DESDE) = CONVERT(date, @1)
                        AND CONVERT(date, FECHA_HASTA) = CONVERT(date, @2)
                        AND ACODIGO = @3`;

                    const updateResult = await queryRunner.query(
                        updateQuery,
                        [cantProd, normalizedFechaDesde, normalizedFechaHasta, aCodigo]
                    );

                    // SQL Server returns an array with rowsAffected property
                    const rowsAffected = updateResult && updateResult.rowsAffected ? updateResult.rowsAffected[0] : 0;

                    if (rowsAffected === 0) {
                        // No existing record found, insert new one using the normalized dates
                        const insertQuery = `
                            INSERT INTO [003BDPRODUCCION].[dbo].[PLAN_PRODUCCION] 
                            (FECHA_DESDE, FECHA_HASTA, ACODIGO, CANT_PROD)
                            VALUES (CONVERT(smalldatetime, @0), CONVERT(smalldatetime, @1), @2, @3)`;

                        await queryRunner.query(
                            insertQuery,
                            [normalizedFechaDesde, normalizedFechaHasta, aCodigo, cantProd]
                        );
                    }
                    rowsProcessed++;
                } catch (queryError) {
                    this.logger.error(`Error executing query for ACODIGO ${aCodigo}: ${queryError.message}`);
                    throw queryError;
                }
            }

            await queryRunner.release();

            return {
                success: true,
                mensaje: `Se procesaron ${rowsProcessed} registros exitosamente`
            };

        } catch (error) {
            this.logger.error(`Error processing plan produccion excel: ${error.message}`);
            await queryRunner.release();
            return {
                success: false,
                mensaje: `Error al procesar el archivo: ${error.message}`
            };
        }
    }

    private validateExcelData(jsonData: PlanProduccionExcelRow[]): void {
        if (!jsonData || jsonData.length === 0) {
            throw new BadRequestException('El archivo Excel está vacío o tiene un formato inválido');
        }

        // Check if required columns exist
        const requiredColumns = ['ACODIGO', 'CANT_PROD'];
        const firstRow = jsonData[0];
        
        for (const column of requiredColumns) {
            if (!(column in firstRow)) {
                throw new BadRequestException(`La columna requerida ${column} no está presente en el archivo Excel`);
            }
        }
    }
}
