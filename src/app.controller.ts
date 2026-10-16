import { Controller, Get, Post, UseInterceptors, UploadedFile, HttpException, HttpStatus, UseGuards, Request, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppService } from './app.service';
import { SunatService } from './services/sunat.service';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdir, existsSync } from 'fs';
import { promisify } from 'util';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SunatResponse } from './interfaces/sunat/sunat.interface';

const mkdirAsync = promisify(mkdir);

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly sunatService: SunatService
  ) {
    // Ensure uploads directory exists
    const uploadPath = join(process.cwd(), 'uploads');
    if (!existsSync(uploadPath)) {
      mkdirAsync(uploadPath).catch(err => {
        console.error('Failed to create uploads directory:', err);
      });
    }
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('test') // Make sure you have this or another simple GET endpoint
  getTest(): string {
    return 'test endpoint is working';
  }

  @UseGuards(JwtAuthGuard)
  @Post('process-impcompras-data')
  async processImpcomprasData(@Body() data: any[], @Request() req): Promise<SunatResponse> {
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new HttpException('No data provided or data is not in expected format', HttpStatus.BAD_REQUEST);
    }
    try {
      const result = await this.sunatService.processImportedData(data, req.user.usuCodigo);
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('Error processing imported data:', error);
      throw new HttpException('Error processing imported data: ' + error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('uploadimpcompras')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, callback) => {
        if (!file) {
          return callback(new HttpException('No file uploaded', HttpStatus.BAD_REQUEST), '');
        }
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        callback(null, `${file.originalname.split('.')[0]}-${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
    fileFilter: (req, file, callback) => {
      const ext = extname(file.originalname).toLowerCase();
      if (ext !== '.xlsx' && ext !== '.xls') {
        return callback(new HttpException('Only Excel files are allowed', HttpStatus.BAD_REQUEST), false);
      }
      callback(null, true);
    },
  }))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Request() req): Promise<SunatResponse> {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.sunatService.processExcelFile(file, req.user.usuCodigo);
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Error processing Excel file: ' + error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
