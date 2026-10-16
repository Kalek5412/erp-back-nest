import { Controller, Post, UploadedFile, UseInterceptors, HttpException, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PriceListService } from '../../services/price-list/price-list.service';
import { Express } from 'express'; // Import Express namespace
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@Controller('price-list')
@UseGuards(JwtAuthGuard)
export class PriceListController {
  constructor(private readonly priceListService: PriceListService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    // Add file filter if needed, e.g., to accept only .xlsx files
    // fileFilter: (req, file, callback) => {
    //   if (!file.originalname.match(/\.(xlsx)$/)) {
    //     return callback(new HttpException('Only .xlsx files are allowed!', HttpStatus.BAD_REQUEST), false);
    //   }
    //   callback(null, true);
    // },
  }))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any
  ): Promise<{ success: boolean; message?: string }> {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    // Get usuEmpresa from request
    const usuEmpresa = req.user?.usuEmpresa;
    if (!usuEmpresa) {
      throw new HttpException('User empresa not found', HttpStatus.UNAUTHORIZED);
    }

    // Basic check for excel file type based on MIME or original name
    // For more robust validation, consider checking magic numbers or using a library
    if (file.mimetype !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && !file.originalname.endsWith('.xlsx')) {
        throw new HttpException('Invalid file type. Only XLSX files are allowed.', HttpStatus.BAD_REQUEST);
    }

    try {
      const success = await this.priceListService.processExcelFile(file, usuEmpresa);
      if (success) {
        return { success: true, message: 'File processed successfully' };
      } else {
        // Consider providing more specific error messages based on service response
        throw new HttpException('Failed to process file', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    } catch (error) {
      // Log the error for server-side debugging
      console.error('Error in uploadFile controller:', error);
      if (error instanceof HttpException) {
        throw error; // Re-throw if already an HttpException
      }
      throw new HttpException(error.message || 'An unexpected error occurred during file processing', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
} 