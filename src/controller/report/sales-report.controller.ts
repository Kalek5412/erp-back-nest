import { Controller, Get, Query, UseGuards, UnauthorizedException, BadRequestException, Logger, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { SalesReportService } from '../../services/sales-report.service';
import { SalesReportItem } from '../../interfaces/sales-report.interface';
import { Request } from 'express';

@Controller('sales-report')
@UseGuards(JwtAuthGuard)
export class SalesReportController {
    private readonly logger = new Logger(SalesReportController.name);
    
    constructor(
        private readonly salesReportService: SalesReportService
    ) {}

    @Get()
    async getSalesReport(
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Req() req: Request
    ): Promise<SalesReportItem[]> {
        this.logger.debug(`User requesting sales report with dates: ${startDate} - ${endDate}`);
        
        if (!startDate || !endDate) {
            throw new BadRequestException('Both startDate and endDate are required');
        }

        // Validate date format (YYYYMMDD)
        const dateRegex = /^\d{8}$/;
        if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
            throw new BadRequestException('Dates must be in YYYYMMDD format');
        }

        // Validate date range
        if (startDate > endDate) {
            throw new BadRequestException('Start date cannot be after end date');
        }

        // Get usuEmpresa from request
        const usuEmpresa = (req as any).user?.usuEmpresa;
        if (!usuEmpresa) {
            throw new UnauthorizedException('User empresa not found');
        }

        try {
            return await this.salesReportService.getSalesByDateRange(startDate, endDate, usuEmpresa);
        } catch (error) {
            this.logger.error(`Error in getSalesReport: ${error.message}`);
            if (error instanceof UnauthorizedException) {
                throw error;
            }
            throw new BadRequestException(`Failed to get sales report: ${error.message}`);
        }
    }
}
