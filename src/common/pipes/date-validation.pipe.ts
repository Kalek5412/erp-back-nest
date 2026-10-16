import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import moment from 'moment';

@Injectable()
export class DateValidationPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (!value) {
      throw new BadRequestException(`El parámetro de fecha [${metadata.data}] no puede estar vacío.`);
    }

    // Intenta parsear la fecha con varios formatos comunes, incluyendo YYYYMMDD
                const date = moment(value, ['YYYY-MM-DD', 'DD-MM-YYYY', 'YYYY/MM/DD', 'YYYYMMDD'], true);

    if (!date.isValid()) {
      throw new BadRequestException(`Formato de fecha inválido para [${metadata.data}]. Use YYYY-MM-DD, DD-MM-YYYY o YYYYMMDD.`);
    }

    // Devuelve la fecha en el formato que la base de datos necesita
    return date.format('YYYYMMDD');
  }
}
