import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MAEART } from '../../entity/comun/maeart.entity';
import { ListaPrecios } from '../../entity/comun/lista-precios.entity';
import * as xlsx from 'xlsx';
import { Express } from 'express'; // For Express.Multer.File type
import { DatabaseService } from '../database.service';

// Define an interface for the expected structure of an Excel row
interface PriceListExcelRow {
  COD_LISPRE: string;
  COD_ARTI: string;
  PRE_ACT: number;
  PRE_ANT?: number;
  USUA_RES?: string;
  FLAG_IGVACT: any; // Will be parsed to boolean
  FLAG_IGVANT: any; // Will be parsed to boolean
  UNI_LISPRE?: string;
  CANMAX?: number;
  CANMIN?: number;
  MON_PRE?: string;
}

@Injectable()
export class PriceListService {
  private readonly logger = new Logger(PriceListService.name);

  constructor(
    @InjectRepository(MAEART, 'comunDb')
    private readonly maeArtRepository: Repository<MAEART>,
    @InjectRepository(ListaPrecios, 'comunDb')
    private readonly listaPreciosRepository: Repository<ListaPrecios>,
    @InjectDataSource('comunDb')
    private readonly comunDbDataSource: DataSource,
    private readonly databaseService: DatabaseService
  ) {}

  private parseBoolean(value: any): boolean {
    if (value === null || value === undefined) {
      throw new Error('Boolean value cannot be null or undefined for required flag fields.');
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true' || value === '1') return true;
      if (value.toLowerCase() === 'false' || value === '0') return false;
    }
    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
    }
    throw new Error(`Invalid boolean value: ${value}`);
  }

  async processExcelFile(file: Express.Multer.File, usuEmpresa: string): Promise<boolean> {
    this.logger.log(`Starting processing of Excel file: ${file.originalname} for empresa: ${usuEmpresa}`);
    let data: PriceListExcelRow[];

    try {
      const workbook = xlsx.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        this.logger.error('No sheets found in the Excel file.');
        return false;
      }
      const sheet = workbook.Sheets[sheetName];
      data = xlsx.utils.sheet_to_json<PriceListExcelRow>(sheet, { rawNumbers: false }); // rawNumbers: false attempts to parse numbers
    } catch (error) {
      this.logger.error('Failed to read or parse Excel file.', error.stack);
      return false;
    }

    if (!data || data.length === 0) {
      this.logger.log('No data found in the Excel file.');
      return true; // Or false, depending on desired behavior for empty files
    }

    // Use the directly injected DataSource for transactions
    try {
      await this.comunDbDataSource.transaction(async (transactionalEntityManager) => {
        const maeArtRepo = transactionalEntityManager.getRepository(MAEART);
        const listaPreciosRepo = transactionalEntityManager.getRepository(ListaPrecios);

        for (const [index, row] of data.entries()) {
          const currentRowNum = index + 2; // Assuming header is row 1, data starts row 2
          this.logger.debug(`Processing row ${currentRowNum}: ${JSON.stringify(row)}`);

          // Validate required fields
          if (!row.COD_LISPRE || !row.COD_ARTI || row.PRE_ACT === undefined || row.FLAG_IGVACT === undefined || row.FLAG_IGVANT === undefined) {
            throw new Error(`Missing required fields in row ${currentRowNum}. Required: COD_LISPRE, COD_ARTI, PRE_ACT, FLAG_IGVACT, FLAG_IGVANT`);
          }
          
          const codArtiStr = String(row.COD_ARTI); // Ensure COD_ARTI is treated as string

          // Validate COD_ARTI against MAEART table
          const articleExists = await maeArtRepo.findOne({ where: { ACODIGO: codArtiStr } });
          if (!articleExists) {
            throw new Error(`COD_ARTI '${codArtiStr}' not found in MAEART table (row ${currentRowNum}).`);
          }

          // Update MAEART fields
          await maeArtRepo.update(
            { ACODIGO: codArtiStr },
            {
              ACODMON: 'MN',
              ACODMONC: 'MN',
              ADESCTO: 0,
              AIGVPOR: 18,
              AFPRELIB: 'S',
              APCOM: 0,
              APRECOM: 0.000000,
              AFLAGIGV: 1,
              FLG_EXONERADO_IGV: 0
            }
          );

          const existingPriceEntry = await listaPreciosRepo.findOne({
            where: { COD_LISPRE: row.COD_LISPRE, COD_ARTI: codArtiStr },
          });

          let priceEntry: ListaPrecios; // Explicitly type priceEntry

          if (!existingPriceEntry) {
            priceEntry = listaPreciosRepo.create();
            priceEntry.COD_LISPRE = row.COD_LISPRE;
            priceEntry.COD_ARTI = codArtiStr;
            priceEntry.PRE_ANT = row.PRE_ANT !== undefined ? Number(row.PRE_ANT) : null;
          } else {
            priceEntry = existingPriceEntry;
            priceEntry.PRE_ANT = priceEntry.PRE_ACT; // Save current PRE_ACT as PRE_ANT before update
          }

          // Map data from Excel row to entity
          priceEntry.PRE_ACT = Number(row.PRE_ACT);
          try {
            priceEntry.FLAG_IGVACT = this.parseBoolean(row.FLAG_IGVACT);
            priceEntry.FLAG_IGVANT = this.parseBoolean(row.FLAG_IGVANT);
          } catch (e) {
             throw new Error(`Invalid boolean value for FLAG_IGVACT or FLAG_IGVANT in row ${currentRowNum}: ${e.message}`);
          }
          
          priceEntry.DIA_HORA = new Date();
          priceEntry.USUA_RES = row.USUA_RES || 'EXCEL_IMPORT';
          priceEntry.UNI_LISPRE = row.UNI_LISPRE || null;
          priceEntry.CANMAX = row.CANMAX !== undefined ? Number(row.CANMAX) : null;
          priceEntry.CANMIN = row.CANMIN !== undefined ? Number(row.CANMIN) : null;
          priceEntry.MON_PRE = row.MON_PRE || null;

          await listaPreciosRepo.save(priceEntry);
          this.logger.debug(`Successfully processed and saved row ${currentRowNum}`);
        }
      });
      this.logger.log(`Successfully processed Excel file: ${file.originalname}`);
      return true;
    } catch (error) {
      this.logger.error(`Error processing Excel file in transaction: ${file.originalname}. Process aborted.`, error.stack);
      return false;
    }
  }
}