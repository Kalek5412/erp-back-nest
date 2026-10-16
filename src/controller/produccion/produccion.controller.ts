import { Controller, Post, UseInterceptors, UploadedFile, Body, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProduccionService } from '../../services/produccion.service';
import { UploadPlanProduccionDto } from '../../dto/produccion/upload-plan-produccion.dto';
import { PlanProduccionResponse } from '../../interfaces/plan-produccion-response.interface';
import { Express } from 'express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('produccion')
export class ProduccionController {
    constructor(private readonly produccionService: ProduccionService) {}

    @Post('plan')
    @UseInterceptors(FileInterceptor('file', {
        fileFilter: (req, file, callback) => {
            const ext = extname(file.originalname).toLowerCase();
            if (ext !== '.xlsx' && ext !== '.xls') {
                return callback(new BadRequestException('Solo se permiten archivos Excel (.xlsx o .xls)'), false);
            }
            callback(null, true);
        },
        limits: {
            fileSize: 5 * 1024 * 1024, // 5MB limit
        }
    }))
    async uploadPlanProduccion(
        @UploadedFile() file: Express.Multer.File,
        @Body() dto: UploadPlanProduccionDto
    ): Promise<PlanProduccionResponse> {
        if (!file) {
            return {
                success: false,
                mensaje: 'No se ha proporcionado ningún archivo'
            };
        }

        const fechaDesde = new Date(dto.fechaDesde);
        const fechaHasta = new Date(dto.fechaHasta);

        // Validate dates
        if (isNaN(fechaDesde.getTime()) || isNaN(fechaHasta.getTime())) {
            return {
                success: false,
                mensaje: 'Formato de fecha inválido. Use el formato ISO (YYYY-MM-DD)'
            };
        }

        if (fechaHasta < fechaDesde) {
            return {
                success: false,
                mensaje: 'La fecha hasta no puede ser menor que la fecha desde'
            };
        }

        return await this.produccionService.processPlanProduccionExcel(file, fechaDesde, fechaHasta);
    }
}
