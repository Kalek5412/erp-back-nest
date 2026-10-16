import { IsDateString } from 'class-validator';

export class UploadPlanProduccionDto {
    @IsDateString()
    fechaDesde: string;

    @IsDateString()
    fechaHasta: string;
}
