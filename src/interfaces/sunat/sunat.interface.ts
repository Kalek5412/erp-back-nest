export interface Sunat {}
import { SunatData } from '../../entity/sunat/sunat-data.entity';
import { DetalleMov } from '../../entity/sunat/detalle-mov.entity';

export interface ValidationResult {
    row: number;
    anexoValid: boolean;
    cuentaValid: boolean;
    cencoValid: boolean;
    missingData: string[];
}

export interface ProcessDetail {
    cabecera: SunatData;
    detalles: DetalleMov[];
}

export interface ProcessError {
    row: string;
    error: string;
}

export interface ProcessResults {
    updates: number;
    inserts: number;
    errors: ProcessError[];
    details: ProcessDetail[];
}

export interface SunatResponse {
    success: boolean;
    message?: string;
    validationErrors?: ValidationResult[];
    errors?: ProcessError[];
    data?: ProcessDetail[];
    processedRecords?: number;
    yearPer: string;
    monthPer: string;
}