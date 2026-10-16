import { Module } from '@nestjs/common';
import { SalesReportController } from '../../controller/report/sales-report.controller';
import { SalesReportService } from '../../services/sales-report.service';

@Module({
  imports: [],
  controllers: [SalesReportController],
  providers: [SalesReportService],
})
export class SalesReportModule {}
